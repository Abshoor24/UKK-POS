const Database = require('better-sqlite3');
const {
  createDB,
  initializeDatabase,
  migrateTransactions,
} = require('../src/db');

describe('database settings and migrations', () => {
  let db;

  afterEach(() => {
    if (db && db.open) db.close();
  });

  test('database baru memiliki tabel dan seed pengaturan yang benar', () => {
    db = createDB(':memory:');

    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table'"
    ).all().map((row) => row.name);
    const settings = db.prepare('SELECT id, tax_rate FROM settings').all();
    const tiers = db.prepare(
      'SELECT min_subtotal, rate FROM discount_tiers ORDER BY min_subtotal'
    ).all();

    expect(tables).toContain('settings');
    expect(tables).toContain('discount_tiers');
    expect(settings).toEqual([{ id: 1, tax_rate: 0.1 }]);
    expect(tiers).toEqual([
      { min_subtotal: 20000, rate: 0.05 },
      { min_subtotal: 50000, rate: 0.1 },
      { min_subtotal: 100000, rate: 0.15 },
    ]);
  });

  test('inisialisasi ulang tidak mengisi tier yang sengaja dikosongkan', () => {
    db = createDB(':memory:');
    db.prepare('DELETE FROM discount_tiers').run();

    initializeDatabase(db);

    expect(db.prepare('SELECT COUNT(*) AS count FROM discount_tiers').get().count)
      .toBe(0);
    expect(db.prepare('SELECT COUNT(*) AS count FROM settings').get().count)
      .toBe(1);
  });

  test('migrasi database lama mengisi tarif tanpa mengubah nominal transaksi', () => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE transactions (
        id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL,
        subtotal INTEGER NOT NULL,
        discount INTEGER NOT NULL,
        tax INTEGER NOT NULL,
        total INTEGER NOT NULL,
        created_at TEXT
      );
      INSERT INTO transactions
        (id, user_id, subtotal, discount, tax, total)
      VALUES (1, 1, 58000, 5800, 5220, 57420);
    `);

    migrateTransactions(db);

    expect(db.prepare(
      'SELECT subtotal, discount, tax, total, discount_rate, tax_rate FROM transactions WHERE id = 1'
    ).get()).toEqual({
      subtotal: 58000,
      discount: 5800,
      tax: 5220,
      total: 57420,
      discount_rate: 0.1,
      tax_rate: 0.1,
    });
  });

  test('migrasi berulang tidak mengubah data dan pembagi nol tetap NULL', () => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE transactions (
        id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL,
        subtotal INTEGER NOT NULL,
        discount INTEGER NOT NULL,
        tax INTEGER NOT NULL,
        total INTEGER NOT NULL,
        created_at TEXT
      );
      INSERT INTO transactions
        (id, user_id, subtotal, discount, tax, total)
      VALUES
        (1, 1, 58000, 5800, 5220, 57420),
        (2, 1, 0, 0, 0, 0);
    `);

    migrateTransactions(db);
    const firstMigration = db.prepare(
      'SELECT * FROM transactions ORDER BY id'
    ).all();

    migrateTransactions(db);

    expect(db.prepare('SELECT * FROM transactions ORDER BY id').all())
      .toEqual(firstMigration);
    expect(firstMigration[1].discount_rate).toBeNull();
    expect(firstMigration[1].tax_rate).toBeNull();
  });
});
