/**
 * @param {number}
 * @returns {number}
 */

function getDiscountRate(subtotal) {
    if (subtotal >= 100000) return 0.15;
    if (subtotal >= 50000) return 0.1;
    if (subtotal >= 20000) return 0.05;
    return 0;
}

/**
 * Menghitung subtotal, diskon, pajak 10%, dan total bayar.
 * Urutan: subtotal -> diskon -> pajak (dari harga setelah diskon) -> total.
 * @param {Array<{price: number, qty: number}>} items item - daftar item yang dibeli
 * @returns {{ subtotal: number, discount: number, tax: number, total: number }}
 * @throws {Error} jika price atau qty bukan angka yang valid
 * 
 */

function calculateTotal(items) {
   for (const item of items) {
    if (!Number.isFinite(item.price) || !Number.isFinite(item.qty)) {
        throw new Error('Price dan qty harus berupa angka yang valid');
    }

    if (item.price < 0) {
        throw new Error('Price tidak boleh negatif');
    }

    if (!Number.isInteger(item.qty) || item.qty <= 0) {
        throw new Error('Qty harus berupa bilangan bulat positif');
    }
   }

   const subTotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
   const discount = Math.round(subTotal * getDiscountRate(subTotal));
   const tax = Math.round((subTotal - discount) * 0.1);
   const total = subTotal - discount + tax;

   return {subTotal, discount, tax, total};
}

module.exports = { calculateTotal, getDiscountRate };