/**
 * Mengubah error Express menjadi respons JSON tanpa membocorkan detail server.
 * @param {Error & {type?: string}} error - Error yang diteruskan Express.
 * @param {import('express').Request} req - Request Express.
 * @param {import('express').Response} res - Response Express.
 * @param {import('express').NextFunction} next - Middleware error berikutnya.
 * @returns {void}
 */
function apiErrorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error && error.type === 'entity.parse.failed') {
    return res.status(400).json({ errors: ['Format JSON tidak valid'] });
  }

  console.error(error);
  return res.status(500).json({ errors: ['Terjadi kesalahan pada server'] });
}

module.exports = { apiErrorHandler };
