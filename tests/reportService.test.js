const { createDB } = require('../src/db');
const { createTransaction } = require('../src/services/transactionService');
const {
  validateHistoryQuery,
  listTransactions,
  getDashboardSummary,
} = require('../src/services/reportService');

let db;
let kasir;
let admin;

const noFilter = { from: null, to: null, limit: 50 };

const userOf = (username) =>
  db.prepare('SELECT id, role FROM users WHERE username = ?').get(username);
const idOf = (name) => db.prepare('SELECT id FROM products WHERE name = ?').get(name).id;
const buy = (user, name, qty) =>
  createTransaction(db, user.id, [{ product_id: idOf(name), qty }]);
const setDate = (transactionId, date) =>
  db.prepare('UPDATE transactions SET created_at = ? WHERE id = ?').run(date, transactionId);

beforeEach(() => {
  db = createDB(':memory:');
  kasir = userOf('kasir');
  admin = userOf('admin');
});

afterEach(() => {
  db.close();
});

describe('validateHistoryQuery', () => {
  test('query kosong memakai nilai bawaan', () => {
    const expected = { errors: [], value: { from: null, to: null, limit: 50 } };
    expect(validateHistoryQuery({})).toEqual(expected);
    expect(validateHistoryQuery(undefined)).toEqual(expected);
  });

  test('rentang tanggal dan limit teks dari URL diterima', () => {
    const result = validateHistoryQuery({ from: '2026-01-01', to: '2026-01-31', limit: '10' });
    expect(result.errors).toEqual([]);
    expect(result.value).toEqual({ from: '2026-01-01', to: '2026-01-31', limit: 10 });
  });

  test('format tanggal salah ditolak', () => {
    const result = validateHistoryQuery({ from: '01-01-2026', to: 'kemarin' });
    expect(result.errors).toContain('Tanggal awal harus berformat YYYY-MM-DD');
    expect(result.errors).toContain('Tanggal akhir harus berformat YYYY-MM-DD');
  });

  test('tanggal awal setelah tanggal akhir ditolak', () => {
    const result = validateHistoryQuery({ from: '2026-02-01', to: '2026-01-01' });
    expect(result.errors).toContain('Tanggal awal tidak boleh setelah tanggal akhir');
  });

  test('limit di luar 1 sampai 200 atau bukan angka ditolak', () => {
    expect(validateHistoryQuery({ limit: '0' }).errors).toHaveLength(1);
    expect(validateHistoryQuery({ limit: '201' }).errors).toHaveLength(1);
    expect(validateHistoryQuery({ limit: 'abc' }).errors).toHaveLength(1);
  });

  test('nilai ganda (array) ditolak', () => {
    const result = validateHistoryQuery({ from: ['2026-01-01', '2026-01-02'] });
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('listTransactions', () => {
  test('kasir hanya melihat transaksinya sendiri, admin melihat semua', () => {
    buy(kasir, 'Es Teh', 1);
    buy(admin, 'Es Teh', 1);

    const forKasir = listTransactions(db, kasir, noFilter);
    const forAdmin = listTransactions(db, admin, noFilter);

    expect(forKasir).toHaveLength(1);
    expect(forKasir[0].cashier).toBe('kasir');
    expect(forAdmin).toHaveLength(2);
  });

  test('urutan terbaru dulu', () => {
    const first = buy(kasir, 'Es Teh', 1);
    const second = buy(kasir, 'Es Teh', 1);

    const result = listTransactions(db, kasir, noFilter);
    expect(result.map((t) => t.id)).toEqual([second.id, first.id]);
  });

  test('filter tanggal hanya mengembalikan transaksi dalam rentang', () => {
    const old = buy(kasir, 'Es Teh', 1);
    const recent = buy(kasir, 'Es Teh', 1);
    setDate(old.id, '2000-01-15 10:00:00');

    const inOldRange = listTransactions(db, kasir, { from: '1999-12-01', to: '2000-01-31', limit: 50 });
    const fromNewer = listTransactions(db, kasir, { from: '2001-01-01', to: null, limit: 50 });

    expect(inOldRange.map((t) => t.id)).toEqual([old.id]);
    expect(fromNewer.map((t) => t.id)).toEqual([recent.id]);
  });

  test('limit membatasi jumlah hasil', () => {
    buy(kasir, 'Es Teh', 1);
    buy(kasir, 'Es Teh', 1);
    buy(kasir, 'Es Teh', 1);

    const result = listTransactions(db, kasir, { from: null, to: null, limit: 2 });
    expect(result).toHaveLength(2);
  });

  test('item_count menjumlahkan qty semua item', () => {
    createTransaction(db, kasir.id, [
      { product_id: idOf('Nasi Goreng'), qty: 2 },
      { product_id: idOf('Es Teh'), qty: 1 },
    ]);

    const [transaction] = listTransactions(db, kasir, noFilter);
    expect(transaction.item_count).toBe(3);
  });
});

describe('getDashboardSummary', () => {
  test('tanpa transaksi hari ini nilainya nol', () => {
    const summary = getDashboardSummary(db, admin);
    expect(summary.today).toEqual({ transactions: 0, revenue: 0 });
    expect(summary.low_stock).toEqual([]);
    expect(summary.active_products).toBe(6);
  });

  test('transaksi hari ini dihitung (Es Teh 5.000 + pajak 10% = 5.500)', () => {
    buy(kasir, 'Es Teh', 1);

    const summary = getDashboardSummary(db, admin);
    expect(summary.today).toEqual({ transactions: 1, revenue: 5500 });
  });

  test('kasir hanya melihat penjualannya sendiri', () => {
    buy(kasir, 'Es Teh', 1);

    expect(getDashboardSummary(db, kasir).today.transactions).toBe(1);
    expect(getDashboardSummary(db, { id: 9999, role: 'kasir' }).today.transactions).toBe(0);
  });

  test('transaksi tanggal lama tidak dihitung sebagai hari ini', () => {
    const old = buy(kasir, 'Es Teh', 1);
    setDate(old.id, '2000-01-15 10:00:00');

    expect(getDashboardSummary(db, admin).today.transactions).toBe(0);
  });

  test('produk stok menipis muncul, produk nonaktif tidak', () => {
    db.prepare("UPDATE products SET stock = 3 WHERE name = 'Es Teh'").run();
    db.prepare("UPDATE products SET stock = 0, is_active = 0 WHERE name = 'Matcha Latte'").run();

    const { low_stock: lowStock } = getDashboardSummary(db, admin);
    expect(lowStock).toEqual([{ id: idOf('Es Teh'), name: 'Es Teh', stock: 3 }]);
  });
});