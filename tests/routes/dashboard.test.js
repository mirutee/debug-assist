// tests/routes/dashboard.test.js
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

const dashboardDir = path.join(__dirname, '../../public/dashboard');
const tempFiles = [];

function ensureFile(filename, content) {
  const filePath = path.join(dashboardDir, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content);
    tempFiles.push(filePath);
  }
}

beforeAll(() => {
  ensureFile('index.html', '<html><body>dashboard</body></html>');
  ensureFile('login.html', '<html><body>login</body></html>');
});

afterAll(() => {
  for (const f of tempFiles) {
    try { fs.unlinkSync(f); } catch (_) {}
  }
});

describe('Dashboard static files', () => {
  it('GET /dashboard/ retorna 200', async () => {
    const res = await request(app).get('/dashboard/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });

  it('GET /dashboard/login.html retorna 200', async () => {
    const res = await request(app).get('/dashboard/login.html');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });

  it('GET /dashboard/naoexiste.html retorna 404', async () => {
    const res = await request(app).get('/dashboard/naoexiste.html');
    expect(res.status).toBe(404);
  });

  it('GET /dashboard/ contém botão theme-toggle', async () => {
    const res = await request(app).get('/dashboard/');
    expect(res.text).toContain('id="theme-toggle"');
  });

  it('GET /dashboard/ contém script de inicialização de tema', async () => {
    const res = await request(app).get('/dashboard/');
    expect(res.text).toContain('da_theme');
  });
});
