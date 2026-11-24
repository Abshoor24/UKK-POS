const {VerifyToken, verifyToken} = require("../services/authService");

/**
 * Middleware: memastikan request membawa token JWT yang valid.
 * Token dikirim lewat header "Authorization: Bearer <token>".
 * Jika valid, data pengguna disimpan di req.user.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */


function authenticate(req, res, next) {
    const header =  req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    const payload = scheme === 'Bearer' && token
        ? verifyToken(token, process.env.JWT_SECRET)
        : null;

    if (!payload) {
        return res.status(401).json({
            errors: ['Please Login']
        });
    }
        req.user = {id: payload.id, username: payload.username, role: payload.role}
        next();
}

/**
 * Membuat middleware yang hanya mengizinkan role tertentu.
 * Harus dipasang setelah authenticate.
 * @param {...string} roles - Role yang diizinkan (misalnya 'admin').
 * @returns {import('express').RequestHandler} Middleware Express.
 */

function requireRole(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({errors: ['Anda tidak memiliki akses']});
        }
        return next();
    }
}

module.exports = {authenticate, requireRole};