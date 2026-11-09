const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

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
    role TEXT NOT NULL DEFAULT 'kasir' 
    );
    
    CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price INTEGER NOT NULL CHECK (price >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );


    CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subtotal INTEGER NOT NULL,
    discount INTEGER NOT NULL,
    tax INTEGER NOT NULL,
    total INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transaction_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    qty INTEGER NOT NULL CHECK (qty > 0),
    price INTEGER NOT NULL,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    ); 
    `);

    seedAdmin(db);
    return db;
}


/**
 * @param {import('better-sqlite3').Database} *db - koneksi database
 * @return {void}
 */ 
 

function seedAdmin(db) {
    const {total} = db.prepare('SELECT COUNT(*) AS total FROM users').get();
    if (total === 0) {
        const hash  = bcrypt.hashSync('admin', 10);
        db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
        .run('admin', hash, 'admin');
    }
}

module.exports = { createDB };