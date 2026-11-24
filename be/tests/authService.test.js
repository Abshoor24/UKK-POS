const { createDB } = require('../src/db');
const { login, verifyToken } = require('../src/services/authService');

const SECRET = 'rahasia-untuk-test';
let db;

beforeEach(() => {
  db = createDB(':memory:');
});

afterEach(() => {
  db.close();
});

describe('login', () => {
  test('login berhasil mengembalikan token dan data pengguna', () => {
    const result = login(db, 'kasir', 'kasir', SECRET);
    expect(result.user).toEqual({ id: expect.any(Number), username: 'kasir', role: 'kasir' });
    expect(typeof result.token).toBe('string');
  });

  test('hash password tidak ikut dikembalikan', () => {
    const result = login(db, 'admin', 'admin', SECRET);
    expect(result.user.password_hash).toBeUndefined();
  });

  test('password salah ditolak', () => {
    expect(login(db, 'kasir', 'salah', SECRET)).toBeNull();
  });

  test('username yang tidak ada ditolak', () => {
    expect(login(db, 'hantu', 'kasir', SECRET)).toBeNull();
  });

  test('username atau password bukan teks ditolak', () => {
    expect(login(db, undefined, 'kasir', SECRET)).toBeNull();
    expect(login(db, 'admin', 123, SECRET)).toBeNull();
  });
});

describe('verifyToken', () => {
  test('token valid menghasilkan data pengguna', () => {
    const { token } = login(db, 'admin', 'admin', SECRET);
    const payload = verifyToken(token, SECRET);
    expect(payload.username).toBe('admin');
    expect(payload.role).toBe('admin');
  });

  test('kunci rahasia yang berbeda ditolak', () => {
    const { token } = login(db, 'admin', 'admin', SECRET);
    expect(verifyToken(token, 'kunci-lain')).toBeNull();
  });

  test('token asal-asalan atau kosong ditolak', () => {
    expect(verifyToken('bukan-token', SECRET)).toBeNull();
    expect(verifyToken(undefined, SECRET)).toBeNull();
  });
});