// tests/routes/billing.test.js

// Instância mock compartilhada — mesma referência usada pelo handler e pelos testes
const mockStripeInstance = {
  customers: {
    create: jest.fn().mockResolvedValue({ id: 'cus_test123' }),
  },
  checkout: {
    sessions: {
      create: jest.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/test' }),
    },
  },
  webhooks: {
    constructEvent: jest.fn(),
  },
};

jest.mock('stripe', () => jest.fn().mockImplementation(() => mockStripeInstance));

jest.mock('../../src/db/supabase', () => ({
  getUserFromToken: jest.fn(),
  getUsuarioByAuthId: jest.fn(),
  updatePlanoBilling: jest.fn(),
  getUsuarioByStripeCustomerId: jest.fn(),
}));

const { getUserFromToken, getUsuarioByAuthId, updatePlanoBilling, getUsuarioByStripeCustomerId } = require('../../src/db/supabase');
const request = require('supertest');
const app = require('../../src/app');

const USUARIO_FREE = { id: 'user-uuid', email: 'user@test.com', plano_id: 'free', stripe_customer_id: null };
const USUARIO_PRO  = { id: 'user-uuid', email: 'user@test.com', plano_id: 'pro',  stripe_customer_id: 'cus_123' };

function mockJwt(usuario) {
  getUserFromToken.mockResolvedValue({ data: { user: { id: 'auth-uuid' } }, error: null });
  getUsuarioByAuthId.mockResolvedValue(usuario);
}

beforeEach(() => jest.clearAllMocks());

// --- checkout ---

describe('POST /v1/billing/checkout', () => {
  it('retorna 401 sem token', async () => {
    const res = await request(app).post('/v1/billing/checkout').send({ plano: 'pro' });
    expect(res.status).toBe(401);
  });

  it('retorna 400 para plano inválido', async () => {
    mockJwt(USUARIO_FREE);
    const res = await request(app)
      .post('/v1/billing/checkout')
      .set('Authorization', 'Bearer token-valido')
      .send({ plano: 'enterprise' });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/inválido/i);
  });

  it('retorna 400 se usuário já tem o plano', async () => {
    mockJwt(USUARIO_PRO);
    const res = await request(app)
      .post('/v1/billing/checkout')
      .set('Authorization', 'Bearer token-valido')
      .send({ plano: 'pro' });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/já possui/i);
  });

  it('retorna url do stripe para checkout válido', async () => {
    mockJwt(USUARIO_FREE);
    const res = await request(app)
      .post('/v1/billing/checkout')
      .set('Authorization', 'Bearer token-valido')
      .send({ plano: 'pro' });
    expect(res.status).toBe(200);
    expect(res.body.url).toContain('stripe.com');
  });
});

// --- webhook ---

describe('POST /v1/billing/webhook', () => {
  it('retorna 400 para assinatura inválida', async () => {
    mockStripeInstance.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('invalid signature');
    });

    const res = await request(app)
      .post('/v1/billing/webhook')
      .set('stripe-signature', 'sig_invalida')
      .set('Content-Type', 'application/json')
      .send(Buffer.from('{}'));

    expect(res.status).toBe(400);
  });

  it('retorna 200 e atualiza plano para checkout.session.completed', async () => {
    mockStripeInstance.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          customer: 'cus_test123',
          metadata: { usuario_id: 'user-uuid', plano: 'pro' },
        },
      },
    });
    updatePlanoBilling.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/v1/billing/webhook')
      .set('stripe-signature', 'sig_valida')
      .set('Content-Type', 'application/json')
      .send(Buffer.from('{}'));

    expect(res.status).toBe(200);
    expect(updatePlanoBilling).toHaveBeenCalledWith('user-uuid', {
      plano_id: 'pro',
      stripe_customer_id: 'cus_test123',
    });
  });

  it('retorna 200 ou 500 quando updatePlanoBilling lança erro', async () => {
    mockStripeInstance.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          customer: 'cus_test123',
          metadata: { usuario_id: 'uuid-inexistente', plano: 'pro' },
        },
      },
    });
    updatePlanoBilling.mockRejectedValue(new Error('not found'));

    const res = await request(app)
      .post('/v1/billing/webhook')
      .set('stripe-signature', 'sig_valida')
      .set('Content-Type', 'application/json')
      .send(Buffer.from('{}'));

    expect([200, 500]).toContain(res.status);
  });

  it('retorna 200 e rebaixa plano para customer.subscription.deleted', async () => {
    mockStripeInstance.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: { object: { customer: 'cus_test123' } },
    });
    getUsuarioByStripeCustomerId.mockResolvedValue({ id: 'user-uuid', plano_id: 'pro' });
    updatePlanoBilling.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/v1/billing/webhook')
      .set('stripe-signature', 'sig_valida')
      .set('Content-Type', 'application/json')
      .send(Buffer.from('{}'));

    expect(res.status).toBe(200);
    expect(updatePlanoBilling).toHaveBeenCalledWith('user-uuid', { plano_id: 'free' });
  });
});
