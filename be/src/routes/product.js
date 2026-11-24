const express = require("express");
const multer = require("multer");
const { validateProduct } = require("../services/productValidator");
const { detectImageType } = require("../services/imageValidator");

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_SIZE },
})


/**
 * Middleware upload: membaca satu file dari field 'image' (opsional).
 * Jika upload gagal (misalnya file terlalu besar), kirim respons 400.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */

function uploadImage(req, res, next) {
    upload.single('image')(req, res, (err) => {
        if (err) {
            const message = err.code === 'LIMIT_FILE_SIZE' 
            ? 'Ukuran gambar maksimal 2 MB' 
            : 'Upload gambar gagal';
            return res.status(400).json({ errors: [message] });
        }
        next();
    });
}

/**
 * Mengubah ID dari URL menjadi bilangan bulat positif.
 * @param {string} value - Nilai req.params.id.
 * @returns {number|null} ID yang valid, atau null.
 */

function parseId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * Membaca file gambar dari request dan memeriksa jenisnya.
 * @param {{buffer: Buffer}|undefined} file - Hasil upload multer (req.file).
 * @returns {{image: Buffer|null, imageType: string|null, error: string|null}}
 */

function readImage(file) {
    if (!file) {
        return { image: null, imageType: null, error: null };
    }
    const imageType = detectImageType(file.buffer);
    if (!imageType) {
        return { image: null, imageType: null, error: 'Gambar harus berformat JPG, PNG, GIF, atau WebP' };
    }
    return { image: file.buffer, imageType, error: null };
}

/**
 * Mengubah baris database menjadi objek respons (tanpa isi gambar).
 * @param {object} row - Baris hasil query produk.
 * @returns {object} Produk dengan has_image dan image_url.
 */

function toResponse(row) {
    const hasImage = Boolean(row.has_image);
    return {
        ...row,
        has_image: hasImage,
        image_url: hasImage ? `/api/products/${row.id}/image` : null
    };
}

/**
 * Membuat router CRUD produk.
 * @param {import('better-sqlite3').Database} db - Koneksi database.
 * @returns {import('express').Router} Router Express.
 */
    
function createProductRouter(db) {
    const router = express.Router();

    const column = `id, name, category, price, stock, is_active, created_at, 
    image IS NOT NULL AS has_image`;

    // GET /api/products -> semua produk aktif
    router.get('/', (req, res) => {
        const rows = db.prepare(`SELECT ${column} FROM products WHERE is_active = 1 ORDER BY name`)
        .all();
        res.json(rows.map(toResponse));
    });

    // GET /api/products/:id -> satu produk
    router.get('/:id', (req, res) => {
        const id = parseId(req.params.id);
        if (id === null) {
            return res.status(400).json({ errors: ['ID tidak valid'] });
        }

        const row = db
        .prepare(`SELECT ${column} FROM products WHERE id = ? AND is_active = 1`)
        .get(id);
        if (!row) {
            return res.status(404).json({ errors: ['Produk tidak ditemukan'] });
        }
        res.json(toResponse(row));
    });
    
    // GET /api/products/:id/image -> file gambar asli
    router.get('/:id/image', (req, res) => {
        const id = parseId(req.params.id);
        if (id === null) {
            return res.status(400).json({ errors: ['ID tidak valid'] });
        }

        const row = db
        .prepare(`SELECT image, image_type FROM products WHERE id = ? AND is_active = 1`)
        .get(id);
        if (!row || !row.image) {
            return res.status(404).json({ errors: ['Gambar tidak ditemukan'] });
        }
        res.set({'Content-Type': row.image_type, 'X-Content-Type-Options': 'nosniff'});
        res.send(row.image);
    });

    // POST /api/products -> tambah produk (boleh dengan gambar)
    router.post('/', uploadImage, (req, res) => {
        const { errors, value } = validateProduct(req.body);
        const { image, imageType, error } = readImage(req.file);
        if (error) errors.push(error);

        if (errors.length > 0) {
            return res.status(400).json({ errors });
        }

        const result = db
            .prepare(`INSERT INTO products (name, category, price, stock, image, image_type)
                      VALUES (?, ?, ?, ?, ?, ?)`)
            .run(value.name, value.category, value.price, value.stock, image, imageType);

        const created = db
            .prepare(`SELECT ${column} FROM products WHERE id = ?`)
            .get(result.lastInsertRowid);
        res.status(201).json(toResponse(created));
    });

    // PUT /api/products/:id -> ubah produk (gambar lama dipertahankan jika tidak ada file baru)
    router.put('/:id', uploadImage, (req, res) => {
        const id = parseId(req.params.id);
        if (id === null) {
            return res.status(400).json({ errors: ['ID tidak valid'] });
        }

        const existing = db
            .prepare('SELECT id FROM products WHERE id = ? AND is_active = 1')
            .get(id);
        if (!existing) {
            return res.status(404).json({ errors: ['Produk tidak ditemukan'] });
        }

        const { errors, value } = validateProduct(req.body);
        const { image, imageType, error } = readImage(req.file);
        if (error) errors.push(error);

        if (errors.length > 0) {
            return res.status(400).json({ errors });
        }

        // COALESCE(?, kolom): pakai nilai baru jika ada, kalau null tetap pakai nilai lama.
        db.prepare(`UPDATE products
                    SET name = ?, category = ?, price = ?, stock = ?,
                        image = COALESCE(?, image),
                        image_type = COALESCE(?, image_type)
                    WHERE id = ?`)
            .run(value.name, value.category, value.price, value.stock, image, imageType, id);

        const updated = db
            .prepare(`SELECT ${column} FROM products WHERE id = ?`)
            .get(id);
        res.json(toResponse(updated));
    });

    // DELETE /api/products/:id -> soft delete (nonaktifkan, baris tetap ada)
    router.delete('/:id', (req, res) => {
        const id = parseId(req.params.id);
        if (id === null) {
            return res.status(400).json({ errors: ['ID tidak valid'] });
        }

        const result = db
            .prepare('UPDATE products SET is_active = 0 WHERE id = ? AND is_active = 1')
            .run(id);
        if (result.changes === 0) {
            return res.status(404).json({ errors: ['Produk tidak ditemukan'] });
        }
        res.json({ message: 'Produk dinonaktifkan' });
    });

    return router;
}

module.exports = createProductRouter;