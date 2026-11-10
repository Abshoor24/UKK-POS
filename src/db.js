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

    seedUsers(db);
    seedProducts(db);
    return db;
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


module.exports = { createDB };