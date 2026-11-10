const {calculateTotal} = require('./calculator');
const {toNonNegativeInt} = require('./productValidator');

/**
 * Kesalahan yang disebabkan data transaksi (bukan kerusakan server).
 * Rute akan mengubahnya menjadi respons 400.
 */


class TransactionError extends Error {
    constructor (message) {
        super(message);
        this.name = 'TransactionError';
    }
}

/**
 * Mengubah nilai menjadi bilangan bulat positif.
 * @param {*} value - Nilai yang diperiksa.
 * @returns {number|null} Bilangan bulat > 0, atau null jika tidak valid.
 */

function toPositiveInt(value) {
    const number = toNonNegativeInt(value);
    return number !== null && number > 0 ? number : null;
}

/**
 * Memeriksa isi keranjang dan menggabungkan produk yang sama (qty dijumlahkan).
 * @param {*} rawItems - Array { product_id, qty } dari request.
 * @returns {Array<{productId: number, qty: number}>} Item yang sudah bersih dan unik.
 * @throws {TransactionError} Jika keranjang kosong atau ada item tidak valid.
 */

function normalizeItems(rawItems) {
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
        throw new TransactionError('Keranjang tidak boleh kosong');
    }

    const merged =  new Map();

    for (const raw of rawItems) {
        const productId = toPositiveInt(raw && raw.product_id);
        const qty =  toPositiveInt(raw && raw.qty);

        if (productId === null || qty === null) {
            throw new TransactionError(
                'Setiap item harus punya product_id dan qty berupa bilangan bulat positif'
            );
        }

        const mergedQty = (merged.get(productId) || 0) + qty;
        if (!Number.isSafeInteger(mergedQty)) {
            throw new TransactionError('Jumlah qty terlalu besar');
        }
        merged.set(productId, mergedQty);

    }
    return [...merged].map(([productId, qty]) => ({productId, qty}));
}

/**
 * Mengambil satu transaksi lengkap dengan item-itemnya.
 * @param {import('better-sqlite3').Database} db - Koneksi database.
 * @param {number} id - ID transaksi.
 * @returns {object|null} Data transaksi (struk), atau null jika tidak ada.
 */

function getTransactionById(db, id) {
    const header = db
    .prepare(`SELECT t.id, t.user_id, u.username AS cashier, t.subtotal, t.discount, t.tax, t.total, t.created_at FROM transactions t JOIN users u ON u.id = t.user_id WHERE t.id = ?`)
    .get(id);

    if (!header) return null;

    const items = db
        .prepare(`SELECT ti.product_id, p.name, ti.qty, ti.price,
                         ti.qty * ti.price AS line_total
                  FROM transaction_items ti
                  JOIN products p ON p.id = ti.product_id
                  WHERE ti.transaction_id = ?
                  ORDER BY ti.id`)
        .all(id);
    
    return {...header, items};
}

/**
 * Membuat transaksi baru: memeriksa produk dan stok, menghitung total,
 * menyimpan transaksi dan item, lalu mengurangi stok.
 * Semua penyimpanan dilakukan dalam satu database transaction:
 * jika satu langkah gagal, tidak ada perubahan yang tersimpan.
 * Harga selalu diambil dari database, bukan dari client.
 * @param {import('better-sqlite3').Database} db - Koneksi database.
 * @param {number} userId - ID kasir yang membuat transaksi.
 * @param {*} rawItems - Array { product_id, qty } dari request.
 * @returns {object} Struk transaksi yang baru dibuat.
 * @throws {TransactionError} Jika keranjang, produk, atau stok tidak valid.
 */

function createTransaction(db, userId, rawItems) {
    const items = normalizeItems(rawItems);

    const save = db.transaction(() => {
    const findProduct = db.prepare(`
            SELECT id, name, price, stock FROM products WHERE id = ? AND is_active = 1
            `);
    
    const lines = items.map(({productId, qty}) => {
        const product = findProduct.get(productId);
        if (!product) {
            throw new TransactionError(`Product dengan ID ${productId} not found`)
        }

        if (product.stock < qty) {
            throw new TransactionError(`Stok ${product.name} tidak cukup (tersisa ${product.stock})`);
        }
        return {productId: product.id, name: product.name, price: product.price, qty};
    });
    
    
    const totals = calculateTotal(lines);

    const header = db
        .prepare(`INSERT INTO transactions (user_id, subtotal, discount, tax, total) VALUES(?, ?, ?, ?, ?)`)
        .run(userId, totals.subTotal, totals.discount, totals.tax, totals.total);
        
        const transactionId = header.lastInsertRowid;
        
        const insertItem = db.prepare(
            'INSERT INTO transaction_items (transaction_id, product_id, qty, price) VALUES (?, ?, ?, ?)'
        );

        const reduceStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?');

        for (const line of lines) {
            insertItem.run(transactionId, line.productId, line.qty, line.price);

            const result = reduceStock.run(line.qty, line.productId, line.qty);

            if (result.changes === 0) {
                throw new TransactionError(`Stock ${line.name} tidak cukup`)
            }
        }

        return transactionId;
    });

    return getTransactionById(db, save());
}

module.exports = { createTransaction, getTransactionById, normalizeItems, TransactionError };