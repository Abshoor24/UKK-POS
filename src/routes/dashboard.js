const express = require('express');
const {getDashboardSummary} = require('../services/reportService');

/**
 * Membuat router dashboard.
 * Router ini harus dipasang setelah middleware authenticate.
 * @param {import('better-sqlite3').Database} db - Koneksi database.
 * @returns {import('express').Router} Router Express.
 */

function createDashboardRouter(db) {
    const router = express.Router();

    router.get('/', (req, res) => {
        res.json(getDashboardSummary(db, req.user));
    });

    return router
}

module.exports = createDashboardRouter