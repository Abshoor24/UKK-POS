/**
 * Tarif pajak yang dikenakan setelah diskon.
 * Ubah nilai ini bila tarif pajak berubah; frontend mengikuti dari respons API.
 * @type {number}
 */
const TAX_RATE = 0.1;

/**
 * Tingkatan diskon berdasarkan subtotal, diurutkan dari batas terbesar.
 * Setiap tingkatan berisi batas minimal subtotal dan persentase diskon.
 * @type {Array<{minSubtotal: number, rate: number}>}
 */
const DISCOUNT_TIERS = [
    { minSubtotal: 100000, rate: 0.15 },
    { minSubtotal: 50000, rate: 0.1 },
    { minSubtotal: 20000, rate: 0.05 },
].sort((a, b) => b.minSubtotal - a.minSubtotal);

/**
 * Menentukan persentase diskon berdasarkan subtotal.
 * @param {number} subtotal - Total harga sebelum diskon.
 * @returns {number} Persentase diskon (0 bila tidak mencapai batas pertama).
 */
function getDiscountRate(subtotal) {
    for (const tier of DISCOUNT_TIERS) {
        if (subtotal >= tier.minSubtotal) return tier.rate;
    }
    return 0;
}

/**
 * Menghitung subtotal, diskon, pajak, dan total bayar.
 * Urutan: subtotal -> diskon -> pajak (dari harga setelah diskon) -> total.
 * @param {Array<{price: number, qty: number}>} items item - daftar item yang dibeli
 * @returns {{ subtotal: number, discount: number, tax: number, total: number }}
 * @throws {Error} jika price atau qty bukan angka yang valid
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

    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const discount = Math.round(subtotal * getDiscountRate(subtotal));
    const tax = Math.round((subtotal - discount) * TAX_RATE);
    const total = subtotal - discount + tax;

    return { subtotal, discount, tax, total };
}

module.exports = { calculateTotal, getDiscountRate, TAX_RATE, DISCOUNT_TIERS };