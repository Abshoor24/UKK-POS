const {toNonNegativeInt} = require('./productValidator');

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const LOW_STOCK = 10;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Memeriksa apakah nilai adalah teks tanggal berformat YYYY-MM-DD.
 * @param {*} value - Nilai yang diperiksa.
 * @returns {boolean} True jika formatnya benar.
 */


function isDateTime(value) {
    return typeof value === 'string' && DATE_PATTERN.test(value);
}

/**
 * Memvalidasi parameter query untuk riwayat transaksi (from, to, limit).
 * @param {{from?: *, to?: *, limit?: *}} query - Isi req.query.
 * @returns {{errors: string[], value: {from: string|null, to: string|null, limit: number}}}
 *          Daftar kesalahan (kosong jika valid) dan nilai yang sudah dibersihkan.
 */


function validateHistoryQuery(query) {
    const input = query || {};
    const errors = [];

    const from = input.from === undefined ? null : input.from;

    const to = input.to === undefined ? null : input.to;

    if (from !== null && !isDateText(from)) {
        errors.push('Tanggal awal harus berformat YYY-MM-DD');
    }

    if (to !== null && !isDateText(to)) {
        errors.push('Tanggal akhir harus berformat YYYY-MM-DD');
    }

    if (errors.length === 0 && from !== null && to !== null && from > to) {
        errors.push('Tanggal awal tidak boleh setelah tanggal akhir');
    }

    let limit = DEFAULT_LIMIT;
    if (input.limit !== undefined) {
        const parsed = toNonNegativeInt(input.limit);
        if (parsed === null || parsed < 1 || parsed > MAX_LIMIT) {
            errors.push(`Limit harus bilangan bulat 1 sampai ${MAX_LIMIT}`);
        } else {
            limit = parsed;
        }
    }

    return {errors, value: {from, to, limit}};
}

/**
 * Mengambil daftar transaksi (terbaru dulu).
 * Kasir hanya melihat transaksinya sendiri, admin melihat semua.
 * @param {import('better-sqlite3').Database} db - Koneksi database.
 * @param {{id: number, role: string}} user - Pengguna yang sedang login.
 * @param {{from: string|null, to: string|null, limit: number}} filters - Filter yang sudah divalidasi.
 * @returns {Array<object>} Daftar transaksi beserta jumlah item (item_count).
 */

function listTransactions(db, user, filters) {
    const conditions = [];
    const params = [];

    if (user.role !== 'admin') {
        condition.push('t.user_id = ?')
        params.push(user.id);
    }
    if (filters.from) {
        conditions.push('date(t.created_at) => ?');
        params.push(filters.from)
    }

    if (filters.to) {
        conditions.push('date(t.created_at) <= ?')
        params.push(filters.to);
    }

    const where = conditions.length > 0 ?  `WHERE ${conditions.join('AND')}` : '';

    return db
        .prepare(`SELECT t.id, u.username AS cashier, t.subtotal, t.discount, t.tax, t.total, t.created_at.
        (SELECT COALESCE(SUM(qty), 0)
        FROM transaction_items WHERE transaction_id= 
        t.id) AS item_count
        JOIN users u ON u.id = t.user_id
        ${where} ORDER BY t.id DESC LIMIT ?
            `)
        .all(...params, filters.limit);
}

/**
 * Menyusun ringkasan dashboard: penjualan hari ini, stok menipis, dan jumlah produk aktif.
 * Penjualan kasir hanya miliknya sendiri, admin melihat semua.
 * @param {import('better-sqlite3').Database} db - Koneksi database.
 * @param {{id: number, role: string}} user - Pengguna yang sedang login.
 * @returns {{today: {transactions: number, revenue: number},
 *            low_stock: Array<{id: number, name: string, stock: number}>,
 *            active_products: number}} Ringkasan dashboard.
 */

function getDashboardSummary(db, user) {
    const isAdmin = user.role === 'admin'
    const ownOnly = isAdmin ? '' : 'AND user_id = ?';
    const params = isAdmin ? [] : [user.id];

    const today = db
        .prepare(`SELECT COUNT(*) AS transactions, COALESCE(SUM(total), 0) AS revenue FROM transactions WHERE data(created_at) = date('now', 'localtime') ${ownOnly}`)
        .get(...params);

        const lowStock = db
        .prepare(`SELECT id, name, stock FROM products WHERE is_active = 1 AND stock <= ? ORDER BY stock, name`)
        .all(LOW_STOCK_LIMIT);

        const {total} = db
        .prepare('SELECT COUNT(*) AS total FROM products WHERE is_active = 1')
        .get();
        
        return {today, low_stock: lowStock, active_products: total};
}       

module.exports = { validateHistoryQuery, listTransactions, getDashboardSummary };