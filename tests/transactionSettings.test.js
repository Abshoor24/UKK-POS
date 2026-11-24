const { createDB } = require('../src/db');
const {
  createTransaction,
  getTransactionById,
  previewTransaction,
} = require('../src/services/transactionService');
const { saveSettings } = require('../src/services/settingsService');

let db;
let cashierId;

/**
 * Membuat keranjang dengan subtotal Rp58.000 dari produk seed.
 * @param {import('better-sqlite3').Database} database - Koneksi database test.
 * @returns {Array<{product_id: number, qty: number}>} Daftar item keranjang.
 */
function cartOf58000(database) {
  const productIds = database.prepare(
    "SELECT id, name FROM products WHERE name IN ('Nasi Goreng', 'Ayam Bakar', 'Es Teh')"
  ).all();
  const idByName = new Map(productIds.map((product) => [product.name, product.id]));

  return [
    { product_id: idByName.get('Nasi Goreng'), qty: 1 },
    { product_id: idByName.get('Ayam Bakar'), qty: 1 },
    { product_id: idByName.get('Es Teh'), qty: 1 },
  ];
}

beforeEach(() => {
  db = createDB(':memory:');
  cashierId = db.prepare(
    "SELECT id FROM users WHERE username = 'kasir'"
  ).get().id;
});

afterEach(() => {
  db.close();
});

describe('transaction settings', () => {
  test('aturan bawaan tersimpan bersama transaksi', () => {
    const receipt = createTransaction(db, cashierId, cartOf58000(db));
    const savedRates = db.prepare(
      'SELECT discount_rate, tax_rate FROM transactions WHERE id = ?'
    ).get(receipt.id);

    expect(receipt).toMatchObject({
      subtotal: 58000,
      discount: 5800,
      tax: 5220,
      total: 57420,
      discount_rate: 0.1,
      tax_rate: 0.1,
    });
    expect(savedRates).toEqual({ discount_rate: 0.1, tax_rate: 0.1 });
  });

  test('preview dan simpan memakai aturan kustom serta tarif tersimpan', () => {
    saveSettings(db, {
      tax_percent: 12,
      discount_tiers: [{ min_subtotal: 50000, rate_percent: 12 }],
    });
    const cart = cartOf58000(db);

    const preview = previewTransaction(db, cart);
    const receipt = createTransaction(db, cashierId, cart);
    const savedRates = db.prepare(
      'SELECT discount_rate, tax_rate FROM transactions WHERE id = ?'
    ).get(receipt.id);

    expect(preview).toMatchObject({
      subtotal: 58000,
      discount: 6960,
      tax: 6125,
      total: 57165,
      discount_rate: 0.12,
      tax_rate: 0.12,
    });
    expect(receipt).toMatchObject(preview);
    expect(savedRates).toEqual({ discount_rate: 0.12, tax_rate: 0.12 });
  });

  test('preview dan transaksi tersimpan menghasilkan angka identik', () => {
    const cart = cartOf58000(db);
    const preview = previewTransaction(db, cart);
    const receipt = createTransaction(db, cashierId, cart);

    expect(receipt).toMatchObject(preview);
  });

  test('riwayat mempertahankan tarif lama dan transaksi berikutnya memakai aturan baru', () => {
    const first = createTransaction(db, cashierId, cartOf58000(db));

    saveSettings(db, { tax_percent: 5, discount_tiers: [] });

    const oldTransaction = getTransactionById(db, first.id);
    const nextTransaction = createTransaction(db, cashierId, cartOf58000(db));

    expect(oldTransaction).toMatchObject({
      subtotal: 58000,
      discount: 5800,
      tax: 5220,
      total: 57420,
      discount_rate: 0.1,
      tax_rate: 0.1,
    });
    expect(nextTransaction).toMatchObject({
      subtotal: 58000,
      discount: 0,
      tax: 2900,
      total: 60900,
      discount_rate: 0,
      tax_rate: 0.05,
    });
  });

  test('tier kosong menghasilkan diskon nol dan pajak tetap dihitung', () => {
    saveSettings(db, { tax_percent: 12, discount_tiers: [] });

    const preview = previewTransaction(db, cartOf58000(db));

    expect(preview).toMatchObject({
      subtotal: 58000,
      discount: 0,
      tax: 6960,
      total: 64960,
      discount_rate: 0,
      tax_rate: 0.12,
    });
  });

  test('subtotal di bawah tier terendah menyimpan discount_rate nol', () => {
    const teaId = db.prepare(
      "SELECT id FROM products WHERE name = 'Es Teh'"
    ).get().id;

    const receipt = createTransaction(db, cashierId, [
      { product_id: teaId, qty: 1 },
    ]);

    expect(receipt.subtotal).toBe(5000);
    expect(receipt.discount).toBe(0);
    expect(receipt.discount_rate).toBe(0);
  });

  test('detail meneruskan tarif NULL tanpa mengubah nominal transaksi', () => {
    const receipt = createTransaction(db, cashierId, cartOf58000(db));
    db.prepare(`
      UPDATE transactions
      SET discount_rate = NULL, tax_rate = NULL
      WHERE id = ?
    `).run(receipt.id);

    const detail = getTransactionById(db, receipt.id);

    expect(detail).toMatchObject({
      subtotal: 58000,
      discount: 5800,
      tax: 5220,
      total: 57420,
      discount_rate: null,
      tax_rate: null,
    });
  });

  test('kegagalan menyimpan item membatalkan transaksi dan perubahan stok', () => {
    const cart = [
      { product_id: db.prepare(
        "SELECT id FROM products WHERE name = 'Nasi Goreng'"
      ).get().id, qty: 1 },
      { product_id: db.prepare(
        "SELECT id FROM products WHERE name = 'Es Teh'"
      ).get().id, qty: 1 },
    ];
    const stockBefore = db.prepare(
      'SELECT id, stock FROM products WHERE id IN (?, ?) ORDER BY id'
    ).all(cart[0].product_id, cart[1].product_id);

    db.exec(`
      CREATE TRIGGER reject_second_item
      BEFORE INSERT ON transaction_items
      WHEN NEW.product_id = ${cart[1].product_id}
      BEGIN
        SELECT RAISE(ABORT, 'penyimpanan item gagal');
      END;
    `);

    expect(() => createTransaction(db, cashierId, cart))
      .toThrow('penyimpanan item gagal');

    expect(db.prepare('SELECT id, stock FROM products WHERE id IN (?, ?) ORDER BY id')
      .all(cart[0].product_id, cart[1].product_id)).toEqual(stockBefore);
    expect(db.prepare('SELECT COUNT(*) AS count FROM transactions').get().count)
      .toBe(0);
  });
});
