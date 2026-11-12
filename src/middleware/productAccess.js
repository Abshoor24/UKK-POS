const {authenticate, requireRole} = require('./auth');

const IMAGE_PATH = /^\/\d+\/image$/;

/**
 * Middleware aturan akses untuk rute produk.
 * - GET gambar produk: terbuka (tag <img> di browser tidak bisa mengirim token).
 * - GET lainnya (daftar dan detail): semua pengguna yang sudah login.
 * - POST, PUT, DELETE: hanya admin.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */

function productAccess(req, res, next) {
    if (req.method === 'GET' && IMAGE_PATH.test(req.path)) {
        return next();
    }

    authenticate(req, res, () => {
        if (req.method === 'GET') {
            return next();
        }

    requireRole('admin')(req, res, next);
    });
}

module.exports = {productAccess};