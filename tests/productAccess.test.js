const { createDB } = require('../src/db');
const { login } = require('../src/services/authService');
const { productAccess } = require('../src/middleware/productAccess');

let adminToken;
let kasirToken;

beforeAll(() => {
  process.env.JWT_SECRET = 'rahasia-untuk-test';

  const db = createDB(':memory:');
  adminToken = login(db, 'admin', 'admin', process.env.JWT_SECRET).token;
  kasirToken = login(db, 'kasir', 'kasir', process.env.JWT_SECRET).token;
  db.close();
});

function makeReq(method, path, token) {
  return {
    method,
    path,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  };
}

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function run(req) {
  const res = makeRes();
  const next = jest.fn();
  productAccess(req, res, next);
  return { req, res, next };
}

function expectAllowed({ res, next }) {
  expect(next).toHaveBeenCalledTimes(1);
  expect(res.status).not.toHaveBeenCalled();
}

function expectDenied({ res, next }, statusCode) {
  expect(next).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(statusCode);
}

describe('gambar produk', () => {
  test('GET gambar boleh tanpa token', () => {
    expectAllowed(run(makeReq('GET', '/3/image')));
  });

  test('jalur yang mirip gambar tetapi ID bukan angka tetap butuh login', () => {
    expectDenied(run(makeReq('GET', '/abc/image')), 401);
  });
});

describe('membaca produk (GET)', () => {
  test('tanpa token ditolak 401', () => {
    expectDenied(run(makeReq('GET', '/')), 401);
  });

  test('token tidak valid ditolak 401', () => {
    expectDenied(run(makeReq('GET', '/', 'token-asal')), 401);
  });

  test('format header bukan Bearer ditolak 401', () => {
    const req = { method: 'GET', path: '/', headers: { authorization: `Token ${kasirToken}` } };
    expectDenied(run(req), 401);
  });

  test('kasir boleh melihat daftar dan detail', () => {
    expectAllowed(run(makeReq('GET', '/', kasirToken)));
    expectAllowed(run(makeReq('GET', '/1', kasirToken)));
  });

  test('data pengguna disimpan di req.user', () => {
    const { req } = run(makeReq('GET', '/', adminToken));
    expect(req.user.username).toBe('admin');
    expect(req.user.role).toBe('admin');
  });
});

describe('mengubah produk (POST, PUT, DELETE)', () => {
  test('tanpa token ditolak 401', () => {
    expectDenied(run(makeReq('POST', '/')), 401);
  });

  test('kasir ditolak 403 untuk POST, PUT, dan DELETE', () => {
    expectDenied(run(makeReq('POST', '/', kasirToken)), 403);
    expectDenied(run(makeReq('PUT', '/1', kasirToken)), 403);
    expectDenied(run(makeReq('DELETE', '/1', kasirToken)), 403);
  });

  test('admin boleh POST, PUT, dan DELETE', () => {
    expectAllowed(run(makeReq('POST', '/', adminToken)));
    expectAllowed(run(makeReq('PUT', '/1', adminToken)));
    expectAllowed(run(makeReq('DELETE', '/1', adminToken)));
  });
});