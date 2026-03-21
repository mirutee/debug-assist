// tests/middleware/antiAbuse.test.js
const { validarDominio, signupLimiter } = require("../../src/middleware/antiAbuse");

function makeReqRes(email, ip = "1.2.3.4") {
  const req = { body: { email }, ip };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

describe("validarDominio", () => {
  it("chama next() para email válido", () => {
    const { req, res, next } = makeReqRes("user@gmail.com");
    validarDominio(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("retorna 400 para domínio descartável", () => {
    const { req, res, next } = makeReqRes("user@mailinator.com");
    validarDominio(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ erro: "Email não permitido" });
    expect(next).not.toHaveBeenCalled();
  });

  it("retorna 400 para email sem @", () => {
    const { req, res, next } = makeReqRes("invalido");
    validarDominio(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ erro: "Email inválido" });
    expect(next).not.toHaveBeenCalled();
  });

  it("retorna 400 se email não enviado", () => {
    const { req, res, next } = makeReqRes(undefined);
    validarDominio(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ erro: "Email inválido" });
    expect(next).not.toHaveBeenCalled();
  });

  it("retorna 400 para yopmail.com", () => {
    const { req, res, next } = makeReqRes("user@yopmail.com");
    validarDominio(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });
});
