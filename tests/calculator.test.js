const {
  getDiscountRate,
  calculateTotal,
  TAX_RATE,
  DISCOUNT_TIERS,
} = require('../src/services/calculator.js');

describe('aturan sebagai data', () => {
  test('TAX_RATE diekspor sebagai angka positif', () => {
    expect(typeof TAX_RATE).toBe('number');
    expect(TAX_RATE).toBeGreaterThan(0);
  });

  test('DISCOUNT_TIERS urut dari batas terbesar', () => {
    expect(Array.isArray(DISCOUNT_TIERS)).toBe(true);
    expect(DISCOUNT_TIERS.length).toBeGreaterThan(0);
    for (let i = 1; i < DISCOUNT_TIERS.length; i += 1) {
      expect(DISCOUNT_TIERS[i - 1].minSubtotal)
        .toBeGreaterThan(DISCOUNT_TIERS[i].minSubtotal);
    }
  });

  test('getDiscountRate memakai tier pertama yang cocok', () => {
    const tier = DISCOUNT_TIERS[0];
    expect(getDiscountRate(tier.minSubtotal)).toBe(tier.rate);
  });

  test('calculateTotal memakai TAX_RATE yang diekspor', () => {
    const subtotal = 10000;
    const discount = Math.round(subtotal * getDiscountRate(subtotal));
    const expectedTax = Math.round((subtotal - discount) * TAX_RATE);

    expect(calculateTotal([{ price: subtotal, qty: 1 }]).tax).toBe(expectedTax);
  });
});

describe('getDiscountRate', () => {
  test('di bawah 20.000 tidak dapat diskon', () => {
    expect(getDiscountRate(19999)).toBe(0);
  });

  test('tepat di batas 20.000 dapat 5%', () => {
    expect(getDiscountRate(20000)).toBe(0.05);
  });

  test('50.000 dapat 10%', () => {
    expect(getDiscountRate(50000)).toBe(0.1);
  });

  test('100.000 ke atas dapat 15%', () => {
    expect(getDiscountRate(100000)).toBe(0.15);
  });
});

describe('calculateTotal', () => {
  test('contoh slide: subtotal 58.000 -> total 57.420', () => {
    const items = [
      { price: 25000, qty: 1 },
      { price: 28000, qty: 1 },
      { price: 5000, qty: 1 },
    ];
    expect(calculateTotal(items)).toEqual({
      subtotal: 58000,
      discount: 5800,
      tax: 5220,
      total: 57420,
    });
  });

  test('keranjang kosong menghasilkan semua nilai 0', () => {
    expect(calculateTotal([])).toEqual({
      subtotal: 0, discount: 0, tax: 0, total: 0,
    });
  });

  test('qty dikalikan harga dengan benar', () => {
    const result = calculateTotal([{ price: 10000, qty: 3 }]);
    expect(result.subtotal).toBe(30000);
  });

  test('qty 0 atau negatif ditolak', () => {
    expect(() => calculateTotal([{ price: 5000, qty: 0 }])).toThrow();
    expect(() => calculateTotal([{ price: 5000, qty: -1 }])).toThrow();
  });

  test('harga negatif atau bukan angka ditolak', () => {
    expect(() => calculateTotal([{ price: -1, qty: 1 }])).toThrow();
    expect(() => calculateTotal([{ price: '5000', qty: 1 }])).toThrow();
  });
});
