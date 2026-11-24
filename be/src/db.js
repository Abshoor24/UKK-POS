const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

/**
 * Data menu contoh yang diisi saat tabel products masih kosong.
 * Stok di sini hanya stok awal; stok sebenarnya diatur admin lewat CRUD produk.
 */
const sampleProducts = [
    { name: 'Nasi Goreng', category: 'Makanan', price: 25000, stock: 50 },
    { name: 'Ayam Bakar', category: 'Makanan', price: 28000, stock: 50 },
    { name: 'Mie Goreng', category: 'Makanan', price: 22000, stock: 50 },
    { name: 'Es Teh', category: 'Minuman', price: 5000, stock: 50 },
    { name: 'Es Kopi Susu', category: 'Minuman', price: 18000, stock: 50 },
    { name: 'Matcha Latte', category: 'Minuman', price: 20000, stock: 50 },
];

/**
 * @param {string} [file] lokasi file db buat memory
 * @returns {import('better-sqlite3').Database}  koneksi database
 */
function createDB(file = path.join(__dirname, '../pos.db')) {
    const db = new Database(file);
    return initializeDatabase(db);
}

/**
 * Menyiapkan skema, menjalankan migrasi, dan mengisi data awal.
 * @param {import('better-sqlite3').Database} db - Koneksi database.
 * @returns {import('better-sqlite3').Database} Koneksi database yang siap dipakai.
 * @throws {Error} Jika pembuatan skema, migrasi, atau seed gagal.
 */
function initializeDatabase(db) {
    db.pragma('foreign_keys = ON');

    db.exec(`
    CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'kasir' CHECK (role IN ('admin', 'kasir'))
    );
    
    CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price INTEGER NOT NULL CHECK (price >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    image BLOB,
    image_type TEXT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    );


    CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subtotal INTEGER NOT NULL,
    discount INTEGER NOT NULL,
    tax INTEGER NOT NULL,
    total INTEGER NOT NULL,
    created_at DATETIME DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id) 
    );

    CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    tax_rate REAL NOT NULL CHECK (tax_rate >= 0 AND tax_rate <= 1)
    );

    CREATE TABLE IF NOT EXISTS discount_tiers (
    min_subtotal INTEGER PRIMARY KEY NOT NULL CHECK (min_subtotal >= 0),
    rate REAL NOT NULL CHECK (rate >= 0 AND rate <= 1)
    );

    CREATE TABLE IF NOT EXISTS transaction_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    qty INTEGER NOT NULL CHECK (qty > 0),
    price INTEGER NOT NULL,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) 
    ); 
    `);

    const cols = db.prepare("PRAGMA table_info(products)").all().map(c => c.name);
    if (!cols.includes('image')) {
        db.exec("ALTER TABLE products ADD COLUMN image BLOB");
    }
    if (!cols.includes('image_type')) {
        db.exec("ALTER TABLE products ADD COLUMN image_type TEXT");
    }

    migrateTransactions(db);
    seedUsers(db);
    seedProducts(db);
    seedSettings(db);
    return db;
}

/**
 * Menambahkan kolom tarif dan mengisi tarif transaksi lama yang belum memilikinya.
 * Baris dengan pembagi nol dibiarkan NULL.
 * @param {import('better-sqlite3').Database} db - Koneksi database.
 * @returns {void}
 * @throws {Error} Jika perubahan skema atau pengisian tarif gagal.
 */
function migrateTransactions(db) {
    const migrate = db.transaction(() => {
        let columns = db.prepare('PRAGMA table_info(transactions)').all()
            .map((column) => column.name);

        if (!columns.includes('discount_rate')) {
            db.exec('ALTER TABLE transactions ADD COLUMN discount_rate REAL');
        }
        if (!columns.includes('tax_rate')) {
            db.exec('ALTER TABLE transactions ADD COLUMN tax_rate REAL');
        }

        db.exec(`
            UPDATE transactions
            SET discount_rate = ROUND(discount * 1.0 / subtotal, 4)
            WHERE discount_rate IS NULL AND subtotal <> 0;

            UPDATE transactions
            SET tax_rate = ROUND(tax * 1.0 / (subtotal - discount), 4)
            WHERE tax_rate IS NULL AND (subtotal - discount) <> 0;
        `);
    });

    migrate();
}

/**
 * Mengisi satu kali pengaturan bawaan dan tier diskon.
 * Baris settings menjadi penanda agar tier yang dikosongkan tidak di-seed ulang.
 * @param {import('better-sqlite3').Database} db - Koneksi database.
 * @returns {void}
 * @throws {Error} Jika penyimpanan pengaturan awal gagal.
 */
function seedSettings(db) {
    const seed = db.transaction(() => {
        const existing = db.prepare('SELECT id FROM settings WHERE id = 1').get();
        if (existing) return;

        db.prepare('INSERT INTO settings (id, tax_rate) VALUES (1, ?)')
            .run(0.1);

        const insertTier = db.prepare(
            'INSERT INTO discount_tiers (min_subtotal, rate) VALUES (?, ?)'
        );
        insertTier.run(20000, 0.05);
        insertTier.run(50000, 0.1);
        insertTier.run(100000, 0.15);
    });

    seed();
}

/**
 * @param {import('better-sqlite3').Database} *db - koneksi database
 * @return {void}
 */ 
 

function seedUsers(db) {
    const {total} = db.prepare('SELECT COUNT(*) AS total FROM users').get();
    if (total === 0) {
        const insert = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)');
        insert.run('admin', bcrypt.hashSync('admin', 10), 'admin');
        insert.run('kasir', bcrypt.hashSync('kasir', 10), 'kasir');
    }
}

/**
 * Mengisi produk contoh ketika tabel products masih kosong.
 * @param {import('better-sqlite3').Database} db - Koneksi database.
 * @returns {void}
 * @throws {Error} Jika pengambilan jumlah produk atau penyimpanan seed gagal.
 */
function seedProducts(db) {
    const {total} = db.prepare('SELECT COUNT(*) AS total FROM products').get();
    if (total === 0) {
        const insert =  db.prepare(`
            INSERT INTO products (name, category, price, stock) VALUES (@name, @category, @price, @stock)`);
            for (const product of sampleProducts) {
                insert.run(product)
            }
        }
    }


module.exports = { createDB, initializeDatabase, migrateTransactions };