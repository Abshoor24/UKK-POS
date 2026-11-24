const express = require('express');
const http = require('node:http');
const { createDB } = require('../src/db');
const { login } = require('../src/services/authService');
const { getSettings } = require('../src/services/settingsService');
const { previewTransaction } = require('../src/services/transactionService');
const createSettingsRouter = require('../src/routes/settings');
const { apiErrorHandler } = require('../src/middleware/apiErrorHandler');

const SECRET = 'settings-route-test-secret';
let db;
let server;
let baseUrl;
let adminToken;
let cashierToken;
let previousSecret;

/**
 * Mengirim request HTTP ke aplikasi test dan membaca respons JSON.
 * @param {string} method - Metode HTTP.
 * @param {string} path - Path request.
 * @param {string} [token] - Token JWT untuk header Authorization.
 * @param {*} [body] - Objek yang akan dikirim sebagai JSON.
 * @param {string} [rawBody] - Isi mentah untuk pengujian JSON rusak.
 * @returns {Promise<{status: number, body: object|null}>} Status dan isi respons.
 * @throws {Error} Jika request jaringan atau parsing respons gagal.
 */
function sendRequest(method, path, token, body, rawBody) {
  const payload = rawBody === undefined
    ? body === undefined ? undefined : JSON.stringify(body)
    : rawBody;

  return new Promise((resolve, reject) => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (payload !== undefined) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const request = http.request(`${baseUrl}${path}`, {
      method,
      headers,
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        try {
          resolve({
            status: response.statusCode,
            body: text ? JSON.parse(text) : null,
          });
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on('error', reject);
    if (payload !== undefined) request.write(payload);
    request.end();
  });
}

/**
 * Membuat keranjang dengan subtotal Rp58.000 dari produk seed.
 * @returns {Array<{product_id: number, qty: number}>} Item untuk preview.
 */
function cartOf58000() {
  const products = db.prepare(
    "SELECT id, name FROM products WHERE name IN ('Nasi Goreng', 'Ayam Bakar', 'Es Teh')"
  ).all();
  const idByName = new Map(products.map((product) => [product.name, product.id]));

  return [
    { product_id: idByName.get('Nasi Goreng'), qty: 1 },
    { product_id: idByName.get('Ayam Bakar'), qty: 1 },
    { product_id: idByName.get('Es Teh'), qty: 1 },
  ];
}

beforeAll((done) => {
  previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = SECRET;
  db = createDB(':memory:');
  adminToken = login(db, 'admin', 'admin', SECRET).token;
  cashierToken = login(db, 'kasir', 'kasir', SECRET).token;

  const app = express();
  app.use(express.json());
  app.use('/api/settings', createSettingsRouter(db));
  app.use(apiErrorHandler);

  server = app.listen(0, '127.0.0.1', () => {
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    done();
  });
});

beforeEach(() => {
  db.prepare('DELETE FROM transaction_items').run();
  db.prepare('DELETE FROM transactions').run();
  db.prepare('UPDATE products SET stock = 50').run();
  db.prepare('UPDATE settings SET tax_rate = 0.1 WHERE id = 1').run();
  db.prepare('DELETE FROM discount_tiers').run();
  db.prepare(`
    INSERT INTO discount_tiers (min_subtotal, rate)
    VALUES (20000, 0.05), (50000, 0.1), (100000, 0.15)
  `).run();
});

afterAll((done) => {
  server.close(() => {
    db.close();
    if (previousSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousSecret;
    }
    done();
  });
});

describe('/api/settings', () => {
  test.each(['GET', 'PUT'])('tanpa token, %s ditolak 401', async (method) => {
    const response = await sendRequest(method, '/api/settings');

    expect(response.status).toBe(401);
  });

  test('token tidak valid ditolak 401', async () => {
    const response = await sendRequest('GET', '/api/settings', 'token-salah');

    expect(response.status).toBe(401);
  });

  test('kasir ditolak 403 dan PUT tidak mengubah database', async () => {
    const before = getSettings(db);
    const getResponse = await sendRequest('GET', '/api/settings', cashierToken);
    const putResponse = await sendRequest(
      'PUT',
      '/api/settings',
      cashierToken,
      { tax_percent: 'bukan angka', discount_tiers: [] }
    );

    expect(getResponse.status).toBe(403);
    expect(putResponse.status).toBe(403);
    expect(getSettings(db)).toEqual(before);
  });

  test('admin GET menerima pengaturan seed', async () => {
    const response = await sendRequest('GET', '/api/settings', adminToken);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      tax_percent: 10,
      discount_tiers: [
        { min_subtotal: 20000, rate_percent: 5 },
        { min_subtotal: 50000, rate_percent: 10 },
        { min_subtotal: 100000, rate_percent: 15 },
      ],
    });
  });

  test('admin PUT valid menyimpan pengaturan dan GET membacanya kembali', async () => {
    const input = {
      tax_percent: 12,
      discount_tiers: [{ min_subtotal: 50000, rate_percent: 12 }],
    };

    const putResponse = await sendRequest('PUT', '/api/settings', adminToken, input);
    const getResponse = await sendRequest('GET', '/api/settings', adminToken);

    expect(putResponse.status).toBe(200);
    expect(putResponse.body).toEqual(input);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toEqual(input);
  });

  test('admin PUT menerima tier kosong', async () => {
    const response = await sendRequest(
      'PUT',
      '/api/settings',
      adminToken,
      { tax_percent: 10, discount_tiers: [] }
    );

    expect(response.status).toBe(200);
    expect(response.body.discount_tiers).toEqual([]);
    expect(db.prepare('SELECT COUNT(*) AS count FROM discount_tiers').get().count)
      .toBe(0);
  });

  test('admin PUT tidak valid mengembalikan semua error dan tidak mengubah database', async () => {
    const before = getSettings(db);
    const response = await sendRequest('PUT', '/api/settings', adminToken, {
      tax_percent: 101,
      discount_tiers: [
        { min_subtotal: -1, rate_percent: 101 },
        { min_subtotal: -1, rate_percent: 12.345 },
      ],
    });

    expect(response.status).toBe(400);
    expect(response.body.errors.length).toBeGreaterThan(1);
    expect(getSettings(db)).toEqual(before);
  });

  test('admin PUT tanpa body mengembalikan 400', async () => {
    const response = await sendRequest('PUT', '/api/settings', adminToken);

    expect(response.status).toBe(400);
    expect(Array.isArray(response.body.errors)).toBe(true);
  });

  test('admin PUT menolak tax_percent berbentuk string', async () => {
    const response = await sendRequest('PUT', '/api/settings', adminToken, {
      tax_percent: '12',
      discount_tiers: [],
    });

    expect(response.status).toBe(400);
    expect(response.body.errors).toContain('Pajak harus berupa angka');
  });

  test('JSON rusak mengembalikan error JSON berbahasa Indonesia', async () => {
    const response = await sendRequest(
      'PUT',
      '/api/settings',
      adminToken,
      undefined,
      '{'
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ errors: ['Format JSON tidak valid'] });
  });

  test('preview memakai pengaturan yang disimpan melalui endpoint', async () => {
    await sendRequest('PUT', '/api/settings', adminToken, {
      tax_percent: 12,
      discount_tiers: [{ min_subtotal: 50000, rate_percent: 12 }],
    });

    const preview = previewTransaction(db, cartOf58000());

    expect(preview).toMatchObject({
      subtotal: 58000,
      discount: 6960,
      tax: 6125,
      total: 57165,
    });
  });

  test('error database menghasilkan 500 umum tanpa detail SQL', async () => {
    db.exec('DROP TABLE settings');
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const response = await sendRequest('GET', '/api/settings', adminToken);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        errors: ['Terjadi kesalahan pada server'],
      });
      expect(errorLog).toHaveBeenCalledTimes(1);
    } finally {
      errorLog.mockRestore();
    }
  });
});
