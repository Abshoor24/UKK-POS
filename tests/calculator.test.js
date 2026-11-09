const { getDiscountRate, calculateTotal } = require('../src/services/calculator.js');

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
  test('contoh slide: subTotal 58.000 -> total 57.420', () => {
    const items = [
      { price: 25000, qty: 1 },
      { price: 28000, qty: 1 },
      { price: 5000, qty: 1 },
    ];
    expect(calculateTotal(items)).toEqual({
      subTotal: 58000,
      discount: 5800,
      tax: 5220,
      total: 57420,
    });
  });

  test('keranjang kosong menghasilkan semua nilai 0', () => {
    expect(calculateTotal([])).toEqual({
      subTotal: 0, discount: 0, tax: 0, total: 0,
    });
  });

  test('qty dikalikan harga dengan benar', () => {
    const result = calculateTotal([{ price: 10000, qty: 3 }]);
    expect(result.subTotal).toBe(30000);
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