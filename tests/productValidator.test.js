const { validateProduct, toNonNegativeInt } = require('../src/services/productValidator');

describe('toNonNegativeInt', () => {
  test('angka bulat >= 0 diterima', () => {
    expect(toNonNegativeInt(0)).toBe(0);
    expect(toNonNegativeInt(25000)).toBe(25000);
  });

  test('teks angka dari form diubah menjadi angka', () => {
    expect(toNonNegativeInt('25000')).toBe(25000);
    expect(toNonNegativeInt(' 10 ')).toBe(10);
  });

  test('negatif, desimal, teks biasa, dan kosong ditolak', () => {
    expect(toNonNegativeInt(-1)).toBeNull();
    expect(toNonNegativeInt(12.5)).toBeNull();
    expect(toNonNegativeInt('12.5')).toBeNull();
    expect(toNonNegativeInt('abc')).toBeNull();
    expect(toNonNegativeInt('')).toBeNull();
    expect(toNonNegativeInt(undefined)).toBeNull();
  });
});

describe('validateProduct', () => {
  test('data valid menghasilkan nol error dan nilai bersih', () => {
    const result = validateProduct({
      name: '  Nasi Goreng ',
      category: 'Makanan',
      price: '25000',
      stock: 50,
    });
    expect(result.errors).toEqual([]);
    expect(result.value).toEqual({
      name: 'Nasi Goreng',
      category: 'Makanan',
      price: 25000,
      stock: 50,
    });
  });

  test('nama kosong atau hanya spasi ditolak', () => {
    const result = validateProduct({ name: '   ', category: 'Makanan', price: 1000, stock: 1 });
    expect(result.errors).toContain('Nama produk wajib diisi');
  });

  test('kategori kosong ditolak', () => {
    const result = validateProduct({ name: 'Es Teh', category: '', price: 1000, stock: 1 });
    expect(result.errors).toContain('Kategori wajib diisi');
  });

  test('harga negatif atau desimal ditolak', () => {
    const negatif = validateProduct({ name: 'A', category: 'B', price: -1, stock: 1 });
    const desimal = validateProduct({ name: 'A', category: 'B', price: 10.5, stock: 1 });
    expect(negatif.errors).toContain('Harga harus bilangan bulat >= 0');
    expect(desimal.errors).toContain('Harga harus bilangan bulat >= 0');
  });

  test('stok bukan angka ditolak', () => {
    const result = validateProduct({ name: 'A', category: 'B', price: 1000, stock: 'abc' });
    expect(result.errors).toContain('Stok harus bilangan bulat >= 0');
  });

  test('body kosong menghasilkan empat error', () => {
    expect(validateProduct(undefined).errors).toHaveLength(4);
  });
});