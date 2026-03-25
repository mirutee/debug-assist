// tests/routes/landing.test.js
const request = require('supertest');
const fs = require('fs');
const path = require('path');

jest.mock('../../src/db/supabase', () => ({
  saveDiagnostico: jest.fn(),
  getUsuarioByApiKey: jest.fn(),
  incrementarUso: jest.fn(),
  getUsuarioByAuthId: jest.fn(),
  signUpUser: jest.fn(),
  signInUser: jest.fn(),
  getUserFromToken: jest.fn(),
}));

const app = require('../../src/app');

const publicDir = path.join(__dirname, '../../public');
const indexPath = path.join(publicDir, 'index.html');
let createdTempFile = false;

beforeAll(() => {
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, '<html><body><h1>DevInsight</h1><a href="/docs">Docs</a><a href="/dashboard/signup.html">signup</a></body></html>');
    createdTempFile = true;
  }
});

afterAll(() => {
  if (createdTempFile && fs.existsSync(indexPath)) {
    fs.unlinkSync(indexPath);
  }
});

describe('Landing page', () => {
  it('GET / retorna 200 com HTML', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });

  it('GET / contém DEBUG_Assist', async () => {
    const res = await request(app).get('/');
    expect(res.text).toMatch(/DEBUG_Assist/i);
  });

  it('GET / contém link para /docs', async () => {
    const res = await request(app).get('/');
    expect(res.text).toContain('/docs');
  });

  it('GET / contém link para /dashboard/signup.html', async () => {
    const res = await request(app).get('/');
    expect(res.text).toContain('/dashboard/signup.html');
  });

  it('GET /health ainda retorna 200 (rotas de API não afetadas)', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  it('POST /v1/diagnosticos ainda é roteado (não retorna 404)', async () => {
    const res = await request(app)
      .post('/v1/diagnosticos')
      .set('Authorization', 'Bearer token-invalido')
      .send({ tipo: 'request_error', categoria: 'frontend' });
    expect(res.status).not.toBe(404);
  });
});
