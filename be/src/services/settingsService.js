/**
 * Error untuk data pengaturan yang tidak lolos validasi.
 */
class ValidationError extends Error {
  /**
   * Membuat error validasi berisi seluruh pesan yang ditemukan.
   * @param {string[]} errors - Daftar pesan validasi.
   * @returns {void}
   */
  constructor(errors) {
    super(errors.join('\n'));
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/**
 * Memeriksa apakah angka dapat ditulis dengan maksimal dua angka desimal.
 * @param {number} value - Angka yang diperiksa.
 * @returns {boolean} True jika angka memiliki maksimal dua desimal.
 */
function hasAtMostTwoDecimals(value) {
  const scaled = value * 100;
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4;
  return Math.abs(scaled - Math.round(scaled)) <= tolerance;
}

/**
 * Mengubah persentase menjadi tarif desimal dengan presisi empat tempat.
 * @param {number} percent - Persentase, misalnya 12.5.
 * @returns {number} Tarif desimal, misalnya 0.125.
 */
function percentToRate(percent) {
  return Math.round(percent * 100) / 10000;
}

/**
 * Mengubah tarif desimal menjadi persentase dengan presisi dua tempat.
 * @param {number} rate - Tarif desimal, misalnya 0.125.
 * @returns {number} Persentase, misalnya 12.5.
 */
function rateToPercent(rate) {
  return Math.round(rate * 10000) / 100;
}

/**
 * Memvalidasi satu nilai persentase dan menambahkan semua kesalahannya.
 * @param {*} value - Nilai persentase yang diperiksa.
 * @param {string} label - Nama nilai untuk pesan error.
 * @param {string[]} errors - Daftar error yang akan ditambahkan.
 * @returns {void}
 */
function validatePercent(value, label, errors) {
  if (typeof value !== 'number') {
    errors.push(`${label} harus berupa angka`);
    return;
  }
  if (!Number.isFinite(value)) {
    errors.push(`${label} harus berupa angka yang valid`);
    return;
  }
  if (value < 0 || value > 100) {
    errors.push(`${label} harus antara 0 sampai 100 persen`);
  }
  if (!hasAtMostTwoDecimals(value)) {
    errors.push(`${label} maksimal memiliki 2 angka desimal`);
  }
}

/**
 * Memeriksa bentuk dan isi konfigurasi pajak serta tier diskon.
 * @param {*} input - Objek pengaturan dari pemanggil.
 * @returns {string[]} Semua pesan error; array kosong berarti valid.
 */
function validateSettings(input) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return ['Pengaturan harus berupa objek'];
  }

  const errors = [];
  validatePercent(input.tax_percent, 'Pajak', errors);

  if (!Array.isArray(input.discount_tiers)) {
    errors.push('Daftar tingkat diskon harus berupa array');
    return errors;
  }

  const seenThresholds = new Set();
  input.discount_tiers.forEach((tier, index) => {
    const position = `Tingkat diskon ke-${index + 1}`;
    if (typeof tier !== 'object' || tier === null || Array.isArray(tier)) {
      errors.push(`${position} harus berupa objek`);
      return;
    }

    const minSubtotal = tier.min_subtotal;
    if (!Number.isSafeInteger(minSubtotal) || minSubtotal < 0) {
      errors.push(
        `${position}: batas subtotal harus bilangan bulat aman tidak negatif`
      );
    } else if (seenThresholds.has(minSubtotal)) {
      errors.push(`${position}: batas subtotal tidak boleh kembar`);
    } else {
      seenThresholds.add(minSubtotal);
    }

    validatePercent(
      tier.rate_percent,
      `${position}: persentase diskon`,
      errors
    );
  });

  return errors;
}

/**
 * Membaca pengaturan dalam bentuk persen untuk UI atau API.
 * @param {import('better-sqlite3').Database} db - Koneksi database.
 * @returns {{tax_percent: number, discount_tiers: Array<{min_subtotal: number, rate_percent: number}>}}
 *          Pengaturan dengan tier terurut dari batas terkecil.
 * @throws {Error} Jika baris pengaturan utama belum tersedia.
 */
function getSettings(db) {
  const settings = db.prepare(
    'SELECT tax_rate FROM settings WHERE id = 1'
  ).get();
  if (!settings) {
    throw new Error('Pengaturan pajak belum diinisialisasi');
  }

  const tiers = db.prepare(`
    SELECT min_subtotal, rate
    FROM discount_tiers
    ORDER BY min_subtotal ASC
  `).all();

  return {
    tax_percent: rateToPercent(settings.tax_rate),
    discount_tiers: tiers.map((tier) => ({
      min_subtotal: tier.min_subtotal,
      rate_percent: rateToPercent(tier.rate),
    })),
  };
}

/**
 * Membaca pengaturan dalam bentuk desimal yang dipakai kalkulator.
 * @param {import('better-sqlite3').Database} db - Koneksi database.
 * @returns {{taxRate: number, tiers: Array<{minSubtotal: number, rate: number}>}}
 *          Tarif pajak dan tier diskon dalam bentuk desimal.
 * @throws {Error} Jika baris pengaturan utama belum tersedia.
 */
function getCalculatorRules(db) {
  const settings = db.prepare(
    'SELECT tax_rate FROM settings WHERE id = 1'
  ).get();
  if (!settings) {
    throw new Error('Pengaturan pajak belum diinisialisasi');
  }

  const tiers = db.prepare(`
    SELECT min_subtotal, rate
    FROM discount_tiers
    ORDER BY min_subtotal ASC
  `).all();

  return {
    taxRate: settings.tax_rate,
    tiers: tiers.map((tier) => ({
      minSubtotal: tier.min_subtotal,
      rate: tier.rate,
    })),
  };
}

/**
 * Memvalidasi dan mengganti seluruh pengaturan dalam satu transaksi database.
 * @param {import('better-sqlite3').Database} db - Koneksi database.
 * @param {*} input - Pengaturan persen dari UI atau API.
 * @returns {{tax_percent: number, discount_tiers: Array<{min_subtotal: number, rate_percent: number}>}}
 *          Pengaturan yang sudah tersimpan.
 * @throws {ValidationError} Jika satu atau lebih nilai tidak valid.
 * @throws {Error} Jika transaksi database gagal atau pengaturan belum diinisialisasi.
 */
function saveSettings(db, input) {
  const errors = validateSettings(input);
  if (errors.length > 0) {
    throw new ValidationError(errors);
  }

  const save = db.transaction(() => {
    const update = db.prepare(
      'UPDATE settings SET tax_rate = ? WHERE id = 1'
    ).run(percentToRate(input.tax_percent));
    if (update.changes !== 1) {
      throw new Error('Pengaturan pajak belum diinisialisasi');
    }

    db.prepare('DELETE FROM discount_tiers').run();
    const insertTier = db.prepare(
      'INSERT INTO discount_tiers (min_subtotal, rate) VALUES (?, ?)'
    );
    for (const tier of input.discount_tiers) {
      insertTier.run(tier.min_subtotal, percentToRate(tier.rate_percent));
    }
  });

  save();
  return getSettings(db);
}

module.exports = {
  ValidationError,
  validateSettings,
  getSettings,
  getCalculatorRules,
  saveSettings,
};
