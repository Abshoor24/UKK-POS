/**
 * Mengubah nilai menjadi bilangan bulat tak negatif.
 * Menerima angka (dari JSON) atau teks angka (dari form upload).
 * @param {*} value - Nilai yang akan diperiksa.
 * @returns {number|null} Bilangan bulat >= 0, atau null jika tidak valid.
 */
function toNonNegativeInt(value) {
    let number = null;

    if (typeof value === 'number') {
        number = value;
    } else if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
        number = Number(value.trim());
    }

    return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

/**
 * Memvalidasi data produk (nama, kategori, harga, stok).
 * @param {{name?: *, category?: *, price?: *, stock?: *}} data - Data dari request.
 * @returns {{errors: string[], value: {name: string, category: string, price: number, stock: number}}}
 *          Daftar pesan kesalahan (kosong jika valid) dan nilai yang sudah dibersihkan.
 */
function validateProduct(data) {
    const input = data || {};
    const errors = [];

    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const category = typeof input.category === 'string' ? input.category.trim() : '';
    const price = toNonNegativeInt(input.price);
    const stock = toNonNegativeInt(input.stock);

    if (name === '') errors.push('Nama produk wajib diisi');
    if (category === '') errors.push('Kategori wajib diisi');
    if (price === null) errors.push('Harga harus bilangan bulat >= 0');
    if (stock === null) errors.push('Stok harus bilangan bulat >= 0');

    return { errors, value: { name, category, price, stock } };
}

module.exports = { validateProduct, toNonNegativeInt };