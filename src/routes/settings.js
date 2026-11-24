const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const {
  ValidationError,
  getSettings,
  saveSettings,
} = require('../services/settingsService');

/**
 * Membuat router pengaturan yang hanya dapat dipakai admin.
 * @param {import('better-sqlite3').Database} db - Koneksi database.
 * @returns {import('express').Router} Router pengaturan.
 */
function createSettingsRouter(db) {
  const router = express.Router();

  router.use(authenticate, requireRole('admin'));

  /**
   * Mengirim pengaturan saat ini dalam format persen.
   * @param {import('express').Request} req - Request Express.
   * @param {import('express').Response} res - Response Express.
   * @param {import('express').NextFunction} next - Middleware berikutnya.
   * @returns {void}
   */
  function getSettingsHandler(req, res, next) {
    try {
      return res.json(getSettings(db));
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Memvalidasi dan menyimpan seluruh pengaturan yang dikirim admin.
   * @param {import('express').Request} req - Request Express.
   * @param {import('express').Response} res - Response Express.
   * @param {import('express').NextFunction} next - Middleware berikutnya.
   * @returns {void}
   */
  function saveSettingsHandler(req, res, next) {
    try {
      return res.json(saveSettings(db, req.body));
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ errors: error.errors });
      }
      return next(error);
    }
  }

  router.get('/', getSettingsHandler);
  router.put('/', saveSettingsHandler);

  return router;
}

module.exports = createSettingsRouter;
