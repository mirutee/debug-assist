// tests/routes/billing.test.js

// Garantir que variáveis de ambiente necessárias existam em CI (sem .env)
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_ci';
process.env.STRIPE_PRICE_PRO   = process.env.STRIPE_PRICE_PRO   || 'price_test_pro';
process.env.STRIPE_PRICE_SCALE = process.env.STRIPE_PRICE_SCALE || 'price_test_scale';

// Instância mock compartilhada — mesma referência usada pelo handler e pelos testes
const mockStripeInstance = {
  customers: {
    create: jest.fn().mockResolvedValue({ id: 'cus_test123' }),
  },
  checkout: {
    sessions: {
      create: jest.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/test' }),
      // retrieve com line_items expandidos — usado pela validação de price_id
      retrieve: jest.fn().mockResolvedValue({
        line_items: { data: [{ price: { id: 'price_test_pro' } }] },
      }),
    },
  },
  charges: {
    retrieve: jest.fn().mockResolvedValue({ customer: 'cus_test123' }),
  },
  webhooks: {
    constructEvent: jest.fn(),
  },
  billingPortal: {
    sessions: {
      create: jest.fn().mockResolvedValue({ url: 'https://billing.stripe.com/session/test' }),
    },
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

beforeEach(() => {
  jest.clearAllMocks();
  // clearAllMocks não reseta mockImplementation — resetar explicitamente
  // para que o throw do teste de assinatura inválida não persista
  mockStripeInstance.webhooks.constructEvent.mockReset();
  // Restaurar retrieve com price_id correto para pro (padrão dos testes de checkout)
  mockStripeInstance.checkout.sessions.retrieve.mockResolvedValue({
    line_items: { data: [{ price: { id: process.env.STRIPE_PRICE_PRO } }] },
  });
});

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
    const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    mockStripeInstance.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test123',
          customer: 'cus_test123',
          payment_status: 'paid',
          metadata: { usuario_id: VALID_UUID, plano: 'pro' },
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
    expect(updatePlanoBilling).toHaveBeenCalledWith(VALID_UUID, {
      plano_id: 'pro',
      stripe_customer_id: 'cus_test123',
    });
  });

  it('ignora checkout.session.completed com payment_status != paid', async () => {
    const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    mockStripeInstance.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test123',
          customer: 'cus_test123',
          payment_status: 'unpaid',
          metadata: { usuario_id: VALID_UUID, plano: 'pro' },
        },
      },
    });

    const res = await request(app)
      .post('/v1/billing/webhook')
      .set('stripe-signature', 'sig_valida')
      .set('Content-Type', 'application/json')
      .send(Buffer.from('{}'));

    expect(res.status).toBe(200);
    expect(updatePlanoBilling).not.toHaveBeenCalled();
  });

  it('rejeita checkout.session.completed com price_id diferente do plano no metadata', async () => {
    const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    mockStripeInstance.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test123',
          customer: 'cus_test123',
          payment_status: 'paid',
          // metadata diz "scale" mas retrieve vai retornar price_id de "pro"
          metadata: { usuario_id: VALID_UUID, plano: 'scale' },
        },
      },
    });
    // retrieve retorna price_id de pro (diferente do scale declarado no metadata)
    mockStripeInstance.checkout.sessions.retrieve.mockResolvedValueOnce({
      line_items: { data: [{ price: { id: process.env.STRIPE_PRICE_PRO } }] },
    });

    const res = await request(app)
      .post('/v1/billing/webhook')
      .set('stripe-signature', 'sig_valida')
      .set('Content-Type', 'application/json')
      .send(Buffer.from('{}'));

    expect(res.status).toBe(400);
    expect(updatePlanoBilling).not.toHaveBeenCalled();
  });

  it('retorna 200 ou 500 quando updatePlanoBilling lança erro', async () => {
    const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    mockStripeInstance.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test123',
          customer: 'cus_test123',
          payment_status: 'paid',
          metadata: { usuario_id: VALID_UUID, plano: 'pro' },
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

  it('não rebaixa plano para customer.subscription.updated com cancel_at (cancelamento agendado ainda dentro do período pago)', async () => {
    // cancel_at = data futura de cancelamento — usuário ainda está no período pago,
    // o downgrade só deve ocorrer em customer.subscription.deleted
    mockStripeInstance.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: { object: { customer: 'cus_test123', cancel_at: 1776909320, status: 'active' } },
    });

    const res = await request(app)
      .post('/v1/billing/webhook')
      .set('stripe-signature', 'sig_valida')
      .set('Content-Type', 'application/json')
      .send(Buffer.from('{}'));

    expect(res.status).toBe(200);
    expect(updatePlanoBilling).not.toHaveBeenCalled();
  });

  it('rebaixa plano para customer.subscription.updated com status unpaid', async () => {
    mockStripeInstance.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: { object: { customer: 'cus_test123', status: 'unpaid' } },
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

  it('rebaixa plano para customer.subscription.updated com status past_due', async () => {
    mockStripeInstance.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: { object: { customer: 'cus_test123', status: 'past_due' } },
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

  it('rebaixa plano para charge.refunded', async () => {
    mockStripeInstance.webhooks.constructEvent.mockReturnValue({
      type: 'charge.refunded',
      data: { object: { id: 'ch_test', customer: 'cus_test123' } },
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

  it('rebaixa plano para charge.dispute.created', async () => {
    mockStripeInstance.webhooks.constructEvent.mockReturnValue({
      type: 'charge.dispute.created',
      data: { object: { id: 'dp_test', charge: 'ch_test123' } },
    });
    // dispute.charge é charge_id; mock getUsuarioByStripeCustomerId falha na primeira
    // chamada (com charge_id) e sucede após retrieve retornar o customer_id
    getUsuarioByStripeCustomerId
      .mockResolvedValueOnce(null)            // chamada com charge_id (não encontra)
      .mockResolvedValueOnce({ id: 'user-uuid', plano_id: 'pro' }); // após lookup
    mockStripeInstance.charges.retrieve.mockResolvedValue({ customer: 'cus_test123' });
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

// --- portal ---

describe('POST /v1/billing/portal', () => {
  it('retorna 401 sem token', async () => {
    const res = await request(app).post('/v1/billing/portal');
    expect(res.status).toBe(401);
  });

  it('retorna 400 se usuário não tem stripe_customer_id', async () => {
    mockJwt(USUARIO_FREE);
    const res = await request(app)
      .post('/v1/billing/portal')
      .set('Authorization', 'Bearer token-valido');
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/assinatura/i);
  });

  it('retorna url do portal para usuário com assinatura', async () => {
    mockJwt(USUARIO_PRO);
    const res = await request(app)
      .post('/v1/billing/portal')
      .set('Authorization', 'Bearer token-valido');
    expect(res.status).toBe(200);
    expect(res.body.url).toContain('billing.stripe.com');
  });

  it('retorna 502 quando Stripe lança erro', async () => {
    mockJwt(USUARIO_PRO);
    mockStripeInstance.billingPortal.sessions.create.mockRejectedValueOnce(new Error('stripe error'));
    const res = await request(app)
      .post('/v1/billing/portal')
      .set('Authorization', 'Bearer token-valido');
    expect(res.status).toBe(502);
  });
});
