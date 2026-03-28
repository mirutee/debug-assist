jest.mock('../../src/email/resend', () => ({
  sendWelcomeEmail: jest.fn(),
  sendFeedbackEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/db/supabase', () => ({
  saveDiagnostico: jest.fn(),
  getUsuarioByApiKey: jest.fn(),
  incrementarUso: jest.fn(),
  getUsuarioByAuthId: jest.fn().mockResolvedValue(null),
  getUserFromToken: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
  getDiagnosticosByUsuario: jest.fn(),
}));

const request = require('supertest');
const app = require('../../src/app');
const { sendFeedbackEmail } = require('../../src/email/resend');

describe('POST /v1/feedback', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna 200 com mensagem válida', async () => {
    const res = await request(app)
      .post('/v1/feedback')
      .send({ mensagem: 'Adorei a ferramenta!' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(sendFeedbackEmail).toHaveBeenCalledWith(
      expect.objectContaining({ mensagem: 'Adorei a ferramenta!' })
    );
  });

  it('retorna 400 sem mensagem', async () => {
    const res = await request(app)
      .post('/v1/feedback')
      .send({});
    expect(res.status).toBe(400);
  });

  it('retorna 400 com mensagem vazia', async () => {
    const res = await request(app)
      .post('/v1/feedback')
      .send({ mensagem: '   ' });
    expect(res.status).toBe(400);
  });

  it('retorna 400 com mensagem acima de 2000 chars', async () => {
    const res = await request(app)
      .post('/v1/feedback')
      .send({ mensagem: 'x'.repeat(2001) });
    expect(res.status).toBe(400);
  });

  it('funciona sem autenticação (usuário anônimo)', async () => {
    const res = await request(app)
      .post('/v1/feedback')
      .send({ mensagem: 'Feedback anônimo' });

    expect(res.status).toBe(200);
    expect(sendFeedbackEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: null, plano: null })
    );
  });
});
