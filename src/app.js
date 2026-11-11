const express = require('express');
const path = require('path');
const { createDB } = require('./db');
const { authenticate } = require('./middleware/auth');
const { productAccess } = require('./middleware/productAccess');
const createAuthRouter = require('./routes/auth');
const createProductRouter = require('./routes/product');
const createTransactionsRouter = require('./routes/transaction');
const createDashboardRouter = require('./routes/dashboard');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET belum diatur. Buat file .env (lihat .env.example).');
}

const app = express();
const db = createDB();

// CORS untuk frontend terpisah. Harus dipasang sebelum route /api
// agar preflight OPTIONS tidak ditolak middleware autentikasi.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', createAuthRouter(db));
app.use('/api/products', productAccess, createProductRouter(db));
app.use('/api/transactions', authenticate, createTransactionsRouter(db));
app.use('/api/dashboard', authenticate, createDashboardRouter(db));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});

module.exports = { app, db };