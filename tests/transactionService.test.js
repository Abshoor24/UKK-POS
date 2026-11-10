const { createDB } = require('../src/db');
const {
  createTransaction,
  getTransactionById,
  normalizeItems,
  TransactionError,
} = require('../src/services/transactionService');

let db;
let kasirId;

const idOf = (name) => db.prepare('SELECT id FROM products WHERE name = ?').get(name).id;
const stockOf = (name) => db.prepare('SELECT stock FROM products WHERE name = ?').get(name).stock;
const countTransactions = () => db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n;

beforeEach(() => {
  db = createDB(':memory:');
  kasirId = db.prepare("SELECT id FROM users WHERE username = 'kasir'").get().id;
});

afterEach(() => {
  db.close();
});

describe('normalizeItems', () => {
  test('produk yang sama digabung dengan qty dijumlahkan', () => {
    const result = normalizeItems([
      { product_id: 1, qty: 1 },
      { product_id: 1, qty: 2 },
      { product_id: 2, qty: 1 },
    ]);
    expect(result).toEqual([
      { productId: 1, qty: 3 },
      { productId: 2, qty: 1 },
    ]);
  });

  test('keranjang kosong atau bukan array ditolak', () => {
    expect(() => normalizeItems([])).toThrow(TransactionError);
    expect(() => normalizeItems(undefined)).toThrow(TransactionError);
    expect(() => normalizeItems('abc')).toThrow(TransactionError);
  });

  test('qty nol, desimal, atau product_id bukan angka ditolak', () => {
    expect(() => normalizeItems([{ product_id: 1, qty: 0 }])).toThrow(TransactionError);
    expect(() => normalizeItems([{ product_id: 1, qty: 1.5 }])).toThrow(TransactionError);
    expect(() => normalizeItems([{ product_id: 'x', qty: 1 }])).toThrow(TransactionError);
    expect(() => normalizeItems([null])).toThrow(TransactionError);
  });
});

describe('createTransaction', () => {
  test('contoh slide: 58.000 -> diskon 5.800, pajak 5.220, total 57.420', () => {
    const receipt = createTransaction(db, kasirId, [
      { product_id: idOf('Nasi Goreng'), qty: 1 },
      { product_id: idOf('Ayam Bakar'), qty: 1 },
      { product_id: idOf('Es Teh'), qty: 1 },
    ]);

    expect(receipt.subtotal).toBe(58000);
    expect(receipt.discount).toBe(5800);
    expect(receipt.tax).toBe(5220);
    expect(receipt.total).toBe(57420);
    expect(receipt.items).toHaveLength(3);
    expect(receipt.cashier).toBe('kasir');
  });

  test('produk yang sama dua kali digabung menjadi satu baris', () => {
    const receipt = createTransaction(db, kasirId, [
      { product_id: idOf('Es Teh'), qty: 1 },
      { product_id: idOf('Es Teh'), qty: 1 },
    ]);

    expect(receipt.items).toHaveLength(1);
    expect(receipt.items[0].qty).toBe(2);
    expect(receipt.subtotal).toBe(10000);
    expect(receipt.total).toBe(11000);
  });

  test('stok berkurang setelah transaksi berhasil', () => {
    createTransaction(db, kasirId, [{ product_id: idOf('Nasi Goreng'), qty: 3 }]);
    expect(stockOf('Nasi Goreng')).toBe(47);
  });

  test('stok tidak cukup ditolak dan tidak ada data yang tersimpan', () => {
    const cart = [
      { product_id: idOf('Nasi Goreng'), qty: 1 },
      { product_id: idOf('Es Teh'), qty: 999 },
    ];

    expect(() => createTransaction(db, kasirId, cart)).toThrow('Stok Es Teh tidak cukup');
    expect(stockOf('Nasi Goreng')).toBe(50);
    expect(countTransactions()).toBe(0);
  });

  test('produk yang tidak ada ditolak', () => {
    expect(() => createTransaction(db, kasirId, [{ product_id: 9999, qty: 1 }]))
      .toThrow(TransactionError);
  });

  test('produk nonaktif ditolak', () => {
    db.prepare("UPDATE products SET is_active = 0 WHERE name = 'Es Teh'").run();
    expect(() => createTransaction(db, kasirId, [{ product_id: idOf('Es Teh'), qty: 1 }]))
      .toThrow(TransactionError);
  });

  test('harga di riwayat tidak berubah walau harga produk diubah', () => {
    const receipt = createTransaction(db, kasirId, [{ product_id: idOf('Es Teh'), qty: 1 }]);
    db.prepare("UPDATE products SET price = 99999 WHERE name = 'Es Teh'").run();

    const saved = getTransactionById(db, receipt.id);
    expect(saved.items[0].price).toBe(5000);
    expect(saved.total).toBe(receipt.total);
  });
});

describe('getTransactionById', () => {
  test('ID yang tidak ada menghasilkan null', () => {
    expect(getTransactionById(db, 12345)).toBeNull();
  });
});