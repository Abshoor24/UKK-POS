const express = require('express');
const {login} = require('../services/authService');
const {authenticate} = require('../middleware/auth');

/**
 * Membuat router autentikasi (login dan data pengguna saat ini).
 * @param {import('better-sqlite3').Database} db - Koneksi database.
 * @returns {import('express').Router} Router Express.
 */

function createAuthRouter(db) {
    const router = express.Router();

    // POST LOGIN
    router.post('/login', (req, res) => {
        const {username, password} = req.body || {};
        const result = login(db, username, password, process.env.JWT_SECRET);

        if (!result) {
            return res.status(401).json({errors: ['username atau password salah']})
        }
        res.json(result)
    });

    router.get('/me', authenticate, (req, res) => {
        res.json({user: req.user})
    });

    return router;
}

module.exports = createAuthRouter;