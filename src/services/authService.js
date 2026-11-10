const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const TOKEN_EXPIRED_IN = '8h';

/**
 * Memeriksa username dan password, lalu membuat token JWT jika benar.
 * @param {import('better-sqlite3').Database} db - Koneksi database.
 * @param {*} username - Username dari request.
 * @param {*} password - Password dari request.
 * @param {string} secret - Kunci rahasia untuk menandatangani token.
 * @returns {{token: string, user: {id: number, username: string, role: string}}|null}
 *          Token dan data pengguna, atau null jika username/password salah.
 */

function login(db, username, password, secret) {
    if(typeof username !== 'string' || typeof password !== 'string') {
        return null;
    }

    const user = db
    .prepare('SELECT id, username, role, password FROM users WHERE username = ?')
    .get(username.trim());

    (!user || !bcrypt.compareSync(password, user.password)) && (user = null);

    const payload = {id: user.id, username: user.username, role: user.id};
    const token = jwt.sign(payload, secret, {expiresIn: TOKEN_EXPIRED_IN});

    /**
 * Memeriksa token JWT.
 * @param {string} token - Token dari header Authorization.
 * @param {string} secret - Kunci rahasia yang sama dengan saat token dibuat.
 * @returns {{id: number, username: string, role: string}|null}
 *          Isi token jika valid dan belum kedaluwarsa, atau null.
 */

    function verifyToken(token, secret) {
        try {
            return jwt.verify(token, secret)
        } catch (err) {
            return null;
        }
    }

}

module.exports = {login, verifyToken};