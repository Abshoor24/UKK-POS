const express = require('express');
const path = require('path');
const { createDB } = require('./db');
const createProductsRouter = require('./routes/product');

const app = express();
const db = createDB();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/products', createProductsRouter(db));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});

module.exports = { app, db };