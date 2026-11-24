const { initializeDatabase } = require('../src/db');
const { calculateTotal } = require('../src/services/calculator');
const {
  ValidationError,
  validateSettings,
  getSettings,
  getCalculatorRules,
  saveSettings,
} = require('../src/services/settingsService');

let db;

const defaultInput = () => ({
  tax_percent: 10,
  discount_tiers: [
    { min_subtotal: 20000, rate_percent: 5 },
    { min_subtotal: 50000, rate_percent: 10 },
    { min_subtotal: 100000, rate_percent: 15 },
  ],
});

beforeEach(() => {
  db = initializeDatabase(require('better-sqlite3')(':memory:'));
});

afterEach(() => {
  db.close();
});

describe('settingsService', () => {
  test('getSettings mengembalikan seed dalam persen dan urutan batas naik', () => {
    expect(getSettings(db)).toEqual(defaultInput());
  });

  test('getCalculatorRules mengembalikan seed dalam desimal', () => {
    expect(getCalculatorRules(db)).toEqual({
      taxRate: 0.1,
      tiers: [
        { minSubtotal: 20000, rate: 0.05 },
        { minSubtotal: 50000, rate: 0.1 },
        { minSubtotal: 100000, rate: 0.15 },
      ],
    });
  });

  test('saveSettings menyimpan seluruh pengaturan yang valid', () => {
    const input = {
      tax_percent: 12,
      discount_tiers: [
        { min_subtotal: 50000, rate_percent: 12 },
        { min_subtotal: 100000, rate_percent: 15 },
      ],
    };

    expect(saveSettings(db, input)).toEqual(input);
    expect(getSettings(db)).toEqual(input);
  });

  test('saveSettings mengizinkan daftar tier kosong', () => {
    const input = { tax_percent: 8, discount_tiers: [] };

    expect(saveSettings(db, input)).toEqual(input);
    expect(db.prepare('SELECT COUNT(*) AS count FROM discount_tiers').get().count)
      .toBe(0);
  });

  test('inisialisasi ulang tidak menimpa pengaturan yang sudah tersimpan', () => {
    const input = { tax_percent: 12.5, discount_tiers: [] };
    saveSettings(db, input);

    initializeDatabase(db);

    expect(getSettings(db)).toEqual(input);
  });

  test.each([
    [7, 7],
    [12.5, 12.5],
  ])('konversi persen %s kembali tepat menjadi %s', (percent, expected) => {
    const input = {
      tax_percent: percent,
      discount_tiers: [
        { min_subtotal: 50000, rate_percent: percent },
      ],
    };

    const saved = saveSettings(db, input);

    expect(saved.tax_percent).toBe(expected);
    expect(saved.discount_tiers[0].rate_percent).toBe(expected);
  });

  test.each([
    ['pajak negatif', { tax_percent: -1, discount_tiers: [] }, 'Pajak harus antara'],
    ['pajak di atas 100', { tax_percent: 101, discount_tiers: [] }, 'Pajak harus antara'],
    ['pajak berbentuk string', { tax_percent: '12', discount_tiers: [] }, 'Pajak harus berupa angka'],
    ['pajak NaN', { tax_percent: NaN, discount_tiers: [] }, 'Pajak harus berupa angka yang valid'],
    ['pajak Infinity', { tax_percent: Infinity, discount_tiers: [] }, 'Pajak harus berupa angka yang valid'],
    ['pajak lebih dari dua desimal', { tax_percent: 12.345, discount_tiers: [] }, 'Pajak maksimal memiliki 2 angka desimal'],
    ['tier kembar', {
      tax_percent: 10,
      discount_tiers: [
        { min_subtotal: 20000, rate_percent: 5 },
        { min_subtotal: 20000, rate_percent: 10 },
      ],
    }, 'batas subtotal tidak boleh kembar'],
    ['batas negatif', {
      tax_percent: 10,
      discount_tiers: [{ min_subtotal: -1, rate_percent: 5 }],
    }, 'batas subtotal harus bilangan bulat aman tidak negatif'],
    ['batas pecahan', {
      tax_percent: 10,
      discount_tiers: [{ min_subtotal: 20000.5, rate_percent: 5 }],
    }, 'batas subtotal harus bilangan bulat aman tidak negatif'],
    ['batas berbentuk string', {
      tax_percent: 10,
      discount_tiers: [{ min_subtotal: '20000', rate_percent: 5 }],
    }, 'batas subtotal harus bilangan bulat aman tidak negatif'],
    ['batas bukan bilangan aman', {
      tax_percent: 10,
      discount_tiers: [{ min_subtotal: Number.MAX_SAFE_INTEGER + 1, rate_percent: 5 }],
    }, 'batas subtotal harus bilangan bulat aman tidak negatif'],
    ['diskon negatif', {
      tax_percent: 10,
      discount_tiers: [{ min_subtotal: 20000, rate_percent: -1 }],
    }, 'persentase diskon harus antara'],
    ['diskon di atas 100', {
      tax_percent: 10,
      discount_tiers: [{ min_subtotal: 20000, rate_percent: 101 }],
    }, 'persentase diskon harus antara'],
    ['diskon NaN', {
      tax_percent: 10,
      discount_tiers: [{ min_subtotal: 20000, rate_percent: NaN }],
    }, 'persentase diskon harus berupa angka yang valid'],
    ['diskon Infinity', {
      tax_percent: 10,
      discount_tiers: [{ min_subtotal: 20000, rate_percent: Infinity }],
    }, 'persentase diskon harus berupa angka yang valid'],
    ['diskon lebih dari dua desimal', {
      tax_percent: 10,
      discount_tiers: [{ min_subtotal: 20000, rate_percent: 12.345 }],
    }, 'persentase diskon maksimal memiliki 2 angka desimal'],
    ['diskon berbentuk string', {
      tax_percent: 10,
      discount_tiers: [{ min_subtotal: 20000, rate_percent: '12' }],
    }, 'persentase diskon harus berupa angka'],
    ['daftar tier bukan array', { tax_percent: 10, discount_tiers: {} }, 'Daftar tingkat diskon harus berupa array'],
    ['input null', null, 'Pengaturan harus berupa objek'],
    ['input array', [], 'Pengaturan harus berupa objek'],
  ])('validateSettings menolak %s', (label, input, expectedError) => {
    expect(validateSettings(input).some((error) => error.includes(expectedError)))
      .toBe(true);
  });

  test('validateSettings mengumpulkan beberapa error sekaligus', () => {
    const errors = validateSettings({
      tax_percent: '12',
      discount_tiers: [
        { min_subtotal: -1, rate_percent: 101 },
        { min_subtotal: -1, rate_percent: '12' },
      ],
    });

    expect(errors).toHaveLength(5);
    expect(errors).toContain('Pajak harus berupa angka');
    expect(errors).toContain(
      'Tingkat diskon ke-1: batas subtotal harus bilangan bulat aman tidak negatif'
    );
    expect(errors).toContain(
      'Tingkat diskon ke-1: persentase diskon harus antara 0 sampai 100 persen'
    );
    expect(errors).toContain('Tingkat diskon ke-2: batas subtotal harus bilangan bulat aman tidak negatif');
    expect(errors).toContain(
      'Tingkat diskon ke-2: persentase diskon harus berupa angka'
    );
  });

  test('saveSettings yang tidak valid melempar ValidationError tanpa mengubah database', () => {
    const before = getSettings(db);

    expect(() => saveSettings(db, {
      tax_percent: 101,
      discount_tiers: [],
    })).toThrow(ValidationError);

    try {
      saveSettings(db, { tax_percent: 101, discount_tiers: [] });
    } catch (error) {
      expect(error.name).toBe('ValidationError');
      expect(error.errors).toContain('Pajak harus antara 0 sampai 100 persen');
    }
    expect(getSettings(db)).toEqual(before);
  });

  test('aturan tersimpan menghasilkan total yang benar melalui calculator', () => {
    saveSettings(db, {
      tax_percent: 12,
      discount_tiers: [{ min_subtotal: 50000, rate_percent: 12 }],
    });

    const rules = getCalculatorRules(db);
    expect(calculateTotal([{ price: 58000, qty: 1 }], rules)).toEqual({
      subtotal: 58000,
      discount: 6960,
      tax: 6125,
      total: 57165,
    });
  });
});
