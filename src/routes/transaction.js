const express = require('express');
const {
    createTransaction,
    getTransactionById,
    TransactionError,
} = require('../services/transactionService');

/**
 * Membuat router transaksi kasir.
 * Router ini harus dipasang setelah middleware authenticate.
 * @param {import('better-sqlite3').Database} db - Koneksi database.
 * @returns {import('express').Router} Router Express.
 */

function createTransactionRouter(db) {
    const router = express.Router();

    // POST /api/transactions -> buat transaksi baru atas nama pengguna yang login
    router.post('/', (req, res) => {
        try {
            const receipt = createTransaction(db, req.user.id, req.body && req.body.items);
            res.status(201).json(receipt);
        } catch (err) {
            if (err instanceof TransactionError) {
                return res.status(400).json({errors: [err.message]});
            }
            throw err;
        }
    });

    router.get('/:id', (req, res) => {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id <= 0) {
            return res.status(400).json({errors: ['ID not valid']});
        }

        const transaction = getTransactionById(db, id);
        if(!transaction) {
            return res.status(404).json({errorsP: ['transaction not found']});
        }
        if (req.user.role != 'admin' && transaction.user_id !== req.user.id) {
            return res.status(403).json({
                errors: ['u dont have access']
            });
        }
        res.json(transaction);
    });
    return router;
}

module.exports = createTransactionRouter;