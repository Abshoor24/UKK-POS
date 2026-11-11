const express = require('express');
const {
    createTransaction,
    getTransactionById,
    TransactionError,
} = require('../services/transactionService');
const { validateHistoryQuery, listTransactions } = require('../services/reportService');

/**
 * Membuat router transaksi kasir.
 * Router ini harus dipasang setelah middleware authenticate.
 * @param {import('better-sqlite3').Database} db - Koneksi database.
 * @returns {import('express').Router} Router Express.
 */
function createTransactionsRouter(db) {
    const router = express.Router();

    // POST /api/transactions -> buat transaksi baru atas nama pengguna yang login
    router.post('/', (req, res) => {
        try {
            const receipt = createTransaction(db, req.user.id, req.body && req.body.items);
            res.status(201).json(receipt);
        } catch (err) {
            if (err instanceof TransactionError) {
                return res.status(400).json({ errors: [err.message] });
            }
            throw err;
        }
    });

    // GET /api/transactions -> riwayat (kasir hanya miliknya, admin semua)
    router.get('/', (req, res) => {
        const { errors, value } = validateHistoryQuery(req.query);
        if (errors.length > 0) {
            return res.status(400).json({ errors });
        }
        res.json(listTransactions(db, req.user, value));
    });

    // GET /api/transactions/:id -> struk satu transaksi (kasir hanya miliknya, admin semua)
    router.get('/:id', (req, res) => {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id <= 0) {
            return res.status(400).json({ errors: ['ID tidak valid'] });
        }

        const transaction = getTransactionById(db, id);
        if (!transaction) {
            return res.status(404).json({ errors: ['Transaksi tidak ditemukan'] });
        }
        if (req.user.role !== 'admin' && transaction.user_id !== req.user.id) {
            return res.status(403).json({ errors: ['Anda tidak memiliki akses'] });
        }
        res.json(transaction);
    });

    return router;
}

module.exports = createTransactionsRouter;