jest.mock('../../src/db/supabase', () => ({
  getUserFromToken: jest.fn(),
  getUsuarioById: jest.fn(),
}));

const { getUserFromToken, getUsuarioById } = require('../../src/db/supabase');
const authJwt = require('../../src/middleware/authJwt');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

it('retorna 401 se não há header Authorization', async () => {
  const req = { headers: {} };
  const res = mockRes();
  const next = jest.fn();

  await authJwt(req, res, next);

  expect(res.status).toHaveBeenCalledWith(401);
  expect(next).not.toHaveBeenCalled();
});

it('retorna 401 se token inválido', async () => {
  getUserFromToken.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } });

  const req = { headers: { authorization: 'Bearer token-invalido' } };
  const res = mockRes();
  const next = jest.fn();

  await authJwt(req, res, next);

  expect(res.status).toHaveBeenCalledWith(401);
  expect(next).not.toHaveBeenCalled();
});

it('retorna 401 se usuário não encontrado no banco', async () => {
  getUserFromToken.mockResolvedValue({ data: { user: { id: 'auth-uuid' } }, error: null });
  getUsuarioById.mockResolvedValue(null);

  const req = { headers: { authorization: 'Bearer token-valido' } };
  const res = mockRes();
  const next = jest.fn();

  await authJwt(req, res, next);

  expect(res.status).toHaveBeenCalledWith(401);
});

it('popula req.usuario e chama next() com token válido', async () => {
  getUserFromToken.mockResolvedValue({ data: { user: { id: 'auth-uuid' } }, error: null });
  getUsuarioById.mockResolvedValue({ id: 'user-uuid', email: 'user@test.com', plano_id: 'free', stripe_customer_id: null });

  const req = { headers: { authorization: 'Bearer token-valido' } };
  const res = mockRes();
  const next = jest.fn();

  await authJwt(req, res, next);

  expect(next).toHaveBeenCalled();
  expect(req.usuario).toMatchObject({ id: 'user-uuid', plano_id: 'free' });
});
