// tests/routes/health.test.js
const request = require("supertest");
const app = require("../../src/app");

describe("GET /health", () => {
  it("retorna status 200 com ok: true", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
