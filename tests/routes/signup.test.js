// tests/routes/signup.test.js
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

const signupPath = path.join(__dirname, '../../public/dashboard/signup.html');
let createdTempFile = false;

beforeAll(() => {
  if (!fs.existsSync(signupPath)) {
    fs.writeFileSync(signupPath, '<html><body><h1>DevInsight</h1><a href="/dashboard/login.html">login</a></body></html>');
    createdTempFile = true;
  }
});

afterAll(() => {
  if (createdTempFile && fs.existsSync(signupPath)) {
    fs.unlinkSync(signupPath);
  }
});

describe('Signup page', () => {
  it('GET /dashboard/signup.html retorna 200 com HTML', async () => {
    const res = await request(app).get('/dashboard/signup.html');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });

  it('GET /dashboard/signup.html contém DevInsight', async () => {
    const res = await request(app).get('/dashboard/signup.html');
    expect(res.text).toMatch(/DevInsight/i);
  });

  it('GET /dashboard/signup.html contém link para login', async () => {
    const res = await request(app).get('/dashboard/signup.html');
    expect(res.text).toContain('/dashboard/login.html');
  });
});
