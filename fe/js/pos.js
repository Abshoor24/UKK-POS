const posAlert = document.getElementById("pos-alert");
const posSearch = document.getElementById("pos-search");
const posCategory = document.getElementById("pos-category");
const posRefreshButton = document.getElementById("pos-refresh-btn");
const posCashier = document.getElementById("pos-cashier");
const posLoading = document.getElementById("pos-products-loading");
const posEmpty = document.getElementById("pos-products-empty");
const posGrid = document.getElementById("pos-products-grid");

const cartCount = document.getElementById("cart-count");
const cartEmpty = document.getElementById("cart-empty");
const cartList = document.getElementById("cart-list");

const summarySubtotal = document.getElementById("summary-subtotal");
const summaryDiscountLabel = document.getElementById("summary-discount-label");
const summaryDiscount = document.getElementById("summary-discount");
const summaryTaxLabel = document.getElementById("summary-tax-label");
const summaryTax = document.getElementById("summary-tax");
const summaryTotal = document.getElementById("summary-total");
const paidInput = document.getElementById("paid-input");
const exactPayButton = document.getElementById("exact-pay-btn");
const changeValue = document.getElementById("change-value");
const checkoutButton = document.getElementById("checkout-btn");

const receiptModal = document.getElementById("receipt-modal");
const receiptAlert = document.getElementById("receipt-alert");
const receiptContainer = document.getElementById("receipt-container");
const printReceiptButton = document.getElementById("print-receipt-btn");
const newTransactionButton = document.getElementById("new-transaction-btn");

/**
 * Membuat nilai total nol untuk kondisi keranjang kosong.
 * @returns {{subtotal: number, discount: number, tax: number, total: number,
 *            discount_rate: number, tax_rate: number}} Nilai total awal.
 */
const emptyTotals = () => ({
  subtotal: 0,
  discount: 0,
  tax: 0,
  total: 0,
  discount_rate: 0,
  tax_rate: 0,
});

const state = {
  products: [],
  cart: new Map(),
  submitting: false,
  totals: emptyTotals(),
  lineTotals: new Map(),
  previewSeq: 0,
};

/**
 * Menampilkan nama pengguna aktif pada area kasir.
 * @returns {void}
 */
function currentUserLabel() {
  const user = getUser();
  posCashier.textContent = user ? `Petugas: ${user.username}` : "Petugas";
}

/**
 * Mencari produk aktif dalam daftar yang sudah dimuat.
 * @param {number} id - ID produk.
 * @returns {object|null} Produk yang cocok atau null jika tidak ditemukan.
 */
function findProduct(id) {
  return state.products.find((product) => product.id === id) || null;
}

/**
 * Mengubah keranjang menjadi daftar item untuk request API.
 * @returns {Array<{product_id: number, qty: number}>} Item keranjang.
 */
function cartItems() {
  return [...state.cart.entries()].map(([productId, qty]) => ({
    product_id: productId,
    qty,
  }));
}

/**
 * Menyalin angka total dari respons API tanpa menghitung ulang.
 * @param {object} data - Respons POST /transactions/preview.
 * @returns {{subtotal: number, discount: number, tax: number, total: number,
 *            discount_rate: number, tax_rate: number}}
 */
function normalizeTotals(data) {
  return {
    subtotal: Number(data && data.subtotal) || 0,
    discount: Number(data && data.discount) || 0,
    tax: Number(data && data.tax) || 0,
    total: Number(data && data.total) || 0,
    discount_rate: Number(data && data.discount_rate) || 0,
    tax_rate: Number(data && data.tax_rate) || 0,
  };
}

/**
 * Mengambil total per baris dari respons preview backend.
 * @param {object} data - Respons POST /transactions/preview.
 * @returns {Map<number, number>} Peta product_id -> line_total.
 */
function normalizeLineTotals(data) {
  const map = new Map();
  const items = Array.isArray(data && data.items) ? data.items : [];
  for (const item of items) {
    map.set(Number(item.product_id), Number(item.line_total) || 0);
  }
  return map;
}

// Total dihitung backend agar frontend tidak menyimpan duplikasi rumus.
/**
 * Meminta backend menghitung ulang total dan total setiap baris keranjang.
 * @returns {Promise<{subtotal: number, discount: number, tax: number, total: number,
 *                    discount_rate: number, tax_rate: number}>} Total dari preview.
 */
async function refreshTotals() {
  if (state.cart.size === 0) {
    state.previewSeq += 1;
    state.totals = emptyTotals();
    state.lineTotals.clear();
    updateSummary();
    updateCartLineTotals();
    return state.totals;
  }

  const seq = ++state.previewSeq;

  try {
    const data = await apiFetch("/transactions/preview", {
      method: "POST",
      body: { items: cartItems() },
    });
    if (seq !== state.previewSeq) return state.totals;
    state.totals = normalizeTotals(data);
    state.lineTotals = normalizeLineTotals(data);
  } catch (error) {
    if (seq !== state.previewSeq) return state.totals;
    setAlert(posAlert, error.message || "Gagal menghitung total.", "error");
    return state.totals;
  }

  updateSummary();
  updateCartLineTotals();
  return state.totals;
}

/**
 * Mengisi pilihan kategori berdasarkan produk yang telah dimuat.
 * @returns {void}
 */
function updateCategoryOptions() {
  const current = posCategory.value;
  const categories = [...new Set(state.products.map((item) => item.category).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "id"));

  posCategory.replaceChildren(new Option("Semua kategori", ""));
  for (const category of categories) {
    posCategory.appendChild(new Option(category, category));
  }
  posCategory.value = categories.includes(current) ? current : "";
}

/**
 * Memfilter produk berdasarkan kata kunci dan kategori yang dipilih.
 * @returns {Array<object>} Produk yang cocok dengan filter saat ini.
 */
function visibleProducts() {
  const keyword = posSearch.value.trim().toLowerCase();
  const category = posCategory.value;

  return state.products.filter((product) => {
    const matchesCategory = !category || product.category === category;
    const matchesKeyword =
      !keyword ||
      product.name.toLowerCase().includes(keyword) ||
      product.category.toLowerCase().includes(keyword);
    return matchesCategory && matchesKeyword;
  });
}

/**
 * Membuat elemen gambar atau placeholder untuk kartu produk.
 * @param {object} product - Produk yang akan ditampilkan.
 * @returns {HTMLImageElement|HTMLDivElement} Elemen gambar produk atau placeholder.
 */
function productImage(product) {
  const url = resolveImageUrl(product.image_url);
  if (url) {
    const img = document.createElement("img");
    img.className = "pos-card__image";
    img.src = url;
    img.alt = `Gambar ${product.name}`;
    img.loading = "lazy";
    return img;
  }
  const initial = product.name ? product.name.trim().charAt(0) : "?";
  return createEl("div", "pos-card__placeholder", initial);
}

/**
 * Menampilkan produk yang cocok dengan filter pada grid kasir.
 * @returns {void}
 */
function renderProducts() {
  const list = visibleProducts();
  posLoading.hidden = true;
  posGrid.replaceChildren();

  if (list.length === 0) {
    posGrid.hidden = true;
    posEmpty.hidden = false;
    posEmpty.textContent =
      state.products.length === 0
        ? "Belum ada produk aktif."
        : "Tidak ada produk yang cocok dengan pencarian.";
    return;
  }

  posEmpty.hidden = true;
  posGrid.hidden = false;

  for (const product of list) {
    const inCart = state.cart.get(product.id) || 0;
    const soldOut = product.stock <= 0;
    const limitReached = inCart >= product.stock;

    const card = createEl("button", "pos-card");
    card.type = "button";
    card.disabled = soldOut || limitReached;
    card.title = soldOut
      ? "Stok habis"
      : limitReached
        ? "Jumlah di keranjang sudah mencapai stok"
        : `Tambah ${product.name} ke keranjang`;

    card.appendChild(productImage(product));
    card.appendChild(createEl("span", "pos-card__name", product.name));

    const meta = createEl("div", "pos-card__meta");
    meta.appendChild(createEl("span", "", product.category));
    const stockLabel = soldOut ? "Habis" : `Stok ${product.stock}`;
    meta.appendChild(
      createEl("span", soldOut ? "pos-card__stock--empty" : "", stockLabel)
    );
    card.appendChild(meta);
    card.appendChild(createEl("span", "pos-card__price", formatRupiah(product.price)));

    if (inCart > 0) {
      card.appendChild(createEl("span", "badge", `Di keranjang: ${inCart}`));
    }

    card.addEventListener("click", () => addToCart(product.id));
    posGrid.appendChild(card);
  }
}

/**
 * Menampilkan item dan kontrol jumlah pada keranjang belanja.
 * @returns {void}
 */
function renderCart() {
  const entries = [...state.cart.entries()]
    .map(([id, qty]) => ({ product: findProduct(id), qty }))
    .filter((entry) => entry.product);

  cartList.replaceChildren();

  if (entries.length === 0) {
    cartCount.textContent = "0 item";
    cartEmpty.hidden = false;
    cartList.hidden = true;
    refreshTotals();
    return;
  }

  cartEmpty.hidden = true;
  cartList.hidden = false;

  let totalQty = 0;

  for (const { product, qty } of entries) {
    totalQty += qty;

    const item = createEl("li", "cart-item");

    const info = createEl("div");
    info.appendChild(createEl("div", "cart-item__name", product.name));
    info.appendChild(createEl("div", "cart-item__price", formatRupiah(product.price)));

    const lineTotalValue = state.lineTotals.get(product.id);
    const lineTotal = createEl(
      "div",
      "cart-item__total",
      lineTotalValue === undefined ? "\u2014" : formatRupiah(lineTotalValue)
    );
    lineTotal.dataset.id = String(product.id);

    const controls = createEl("div", "cart-item__controls");

    const decreaseButton = createEl("button", "qty-btn", "-");
    decreaseButton.type = "button";
    decreaseButton.dataset.action = "decrease";
    decreaseButton.dataset.id = String(product.id);
    decreaseButton.setAttribute("aria-label", `Kurangi ${product.name}`);

    const qtyLabel = createEl("span", "cart-item__qty", qty);

    const increaseButton = createEl("button", "qty-btn", "+");
    increaseButton.type = "button";
    increaseButton.dataset.action = "increase";
    increaseButton.dataset.id = String(product.id);
    increaseButton.disabled = qty >= product.stock;
    increaseButton.setAttribute("aria-label", `Tambah ${product.name}`);

    controls.append(decreaseButton, qtyLabel, increaseButton);

    const removeButton = createEl("button", "cart-item__remove", "Hapus");
    removeButton.type = "button";
    removeButton.dataset.action = "remove";
    removeButton.dataset.id = String(product.id);

    item.append(info, lineTotal, controls, removeButton);
    cartList.appendChild(item);
  }

  cartCount.textContent = `${totalQty} item`;
  refreshTotals();
}

/**
 * Menyegarkan angka total per baris dari hasil preview backend.
 * @returns {void}
 */
function updateCartLineTotals() {
  for (const cell of cartList.querySelectorAll(".cart-item__total")) {
    const value = state.lineTotals.get(Number(cell.dataset.id));
    cell.textContent = value === undefined ? "\u2014" : formatRupiah(value);
  }
}

/**
 * Menampilkan subtotal, diskon, pajak, total, dan kembalian pembayaran.
 * @returns {void}
 */
function updateSummary() {
  const totals = state.totals;

  summaryDiscountLabel.textContent = formatRateLabel("Diskon", totals.discount_rate);
  summaryTaxLabel.textContent = formatRateLabel("Pajak", totals.tax_rate);
  summarySubtotal.textContent = formatRupiah(totals.subtotal);
  summaryDiscount.textContent = formatRupiah(totals.discount);
  summaryTax.textContent = formatRupiah(totals.tax);
  summaryTotal.textContent = formatRupiah(totals.total);

  const rawPaid = paidInput.value.trim();
  const paid = rawPaid === "" ? null : Number(rawPaid);
  const hasCart = state.cart.size > 0;
  let change = null;

  if (hasCart && paid !== null && Number.isFinite(paid)) {
    change = paid - totals.total;
  }

  if (!hasCart) {
    changeValue.textContent = formatRupiah(0);
  } else if (change === null) {
    changeValue.textContent = "\u2014";
  } else {
    changeValue.textContent = formatRupiah(change);
  }

  changeValue.classList.toggle(
    "change--negative",
    change !== null && Number.isFinite(change) && change < 0
  );

  updateCheckoutState(totals, paid);
}

/**
 * Mengatur ketersediaan tombol checkout berdasarkan total dan pembayaran.
 * @param {{total: number}} totals - Total transaksi dari backend.
 * @param {number|null} paid - Nominal uang yang dimasukkan pengguna.
 * @returns {void}
 */
function updateCheckoutState(totals, paid) {
  const validPayment = paid !== null && Number.isFinite(paid) && paid >= totals.total;
  checkoutButton.disabled =
    state.submitting || state.cart.size === 0 || !validPayment;
}

/**
 * Menambahkan satu unit produk ke keranjang jika stok masih tersedia.
 * @param {number} id - ID produk yang dipilih.
 * @returns {void}
 */
function addToCart(id) {
  const product = findProduct(id);
  if (!product) return;

  const current = state.cart.get(id) || 0;
  if (product.stock <= current) {
    showToast(`Stok ${product.name} hanya ${product.stock}.`, "error");
    return;
  }

  state.cart.set(id, current + 1);
  renderProducts();
  renderCart();
}

/**
 * Menambah, mengurangi, atau menghapus jumlah produk dalam keranjang.
 * @param {number} id - ID produk yang diubah.
 * @param {"increase"|"decrease"|"remove"} action - Perubahan yang diminta.
 * @returns {void}
 */
function changeQuantity(id, action) {
  const product = findProduct(id);
  if (!product) return;

  const current = state.cart.get(id) || 0;

  if (action === "increase") {
    if (current >= product.stock) {
      showToast(`Stok ${product.name} hanya ${product.stock}.`, "error");
      return;
    }
    state.cart.set(id, current + 1);
  } else if (action === "decrease") {
    if (current <= 1) {
      state.cart.delete(id);
    } else {
      state.cart.set(id, current - 1);
    }
  } else if (action === "remove") {
    state.cart.delete(id);
  }

  renderProducts();
  renderCart();
}

/**
 * Menyesuaikan keranjang dengan produk dan stok terbaru dari backend.
 * @returns {void}
 */
function reconcileCart() {
  for (const [id, qty] of [...state.cart.entries()]) {
    const product = findProduct(id);
    if (!product || product.stock <= 0) {
      state.cart.delete(id);
      continue;
    }
    if (qty > product.stock) {
      state.cart.set(id, product.stock);
    }
  }
}

/**
 * Memuat daftar produk aktif dan memperbarui tampilan kasir.
 * @returns {Promise<void>}
 */
async function loadProducts() {
  setAlert(posAlert, "");
  posLoading.hidden = false;
  posGrid.hidden = true;
  posEmpty.hidden = true;

  try {
    const data = await apiFetch("/products");
    if (!Array.isArray(data)) {
      throw new Error("Respons daftar produk tidak valid.");
    }
    state.products = data;
    reconcileCart();
    updateCategoryOptions();
    renderProducts();
    renderCart();
  } catch (error) {
    posLoading.hidden = true;
    posGrid.hidden = true;
    posEmpty.hidden = false;
    posEmpty.textContent = "Produk gagal dimuat.";
    setAlert(posAlert, error.message || "Gagal memuat produk.");
  }
}

/**
 * Menampilkan struk transaksi beserta informasi pembayaran.
 * @param {object} receipt - Data struk dari backend.
 * @param {number} paid - Nominal uang yang diterima.
 * @param {number} change - Kembalian dari transaksi.
 * @returns {void}
 */
function showReceipt(receipt, paid, change) {
  setAlert(receiptAlert, "");
  if (change < 0) {
    setAlert(
      receiptAlert,
      "Total dari backend lebih besar dari uang yang dimasukkan. Periksa kembali pembayaran.",
      "warning"
    );
  }
  mountReceipt(receiptContainer, receipt, { paid, change });
  receiptModal.hidden = false;
  printReceiptButton.focus();
}

/**
 * Menutup dialog struk dan menyiapkan form untuk transaksi berikutnya.
 * @returns {void}
 */
function closeReceiptModal() {
  receiptModal.hidden = true;
  receiptContainer.replaceChildren();
  setAlert(receiptAlert, "");
  paidInput.value = "";
  updateSummary();
  posSearch.focus();
}

/**
 * Memvalidasi pembayaran dan menyimpan transaksi ke backend.
 * @returns {Promise<void>}
 */
async function checkout() {
  if (state.submitting) return;

  setAlert(posAlert, "");

  if (state.cart.size === 0) {
    setAlert(posAlert, "Keranjang masih kosong.", "warning");
    return;
  }

  const totals = await refreshTotals();
  const rawPaid = paidInput.value.trim();
  const paid = rawPaid === "" ? null : Number(rawPaid);

  if (paid === null || !Number.isFinite(paid)) {
    setAlert(posAlert, "Masukkan nominal uang yang diterima.", "warning");
    paidInput.focus();
    return;
  }

  if (paid < totals.total) {
    setAlert(
      posAlert,
      `Uang diterima kurang dari total ${formatRupiah(totals.total)}.`,
      "warning"
    );
    paidInput.focus();
    return;
  }

  const items = cartItems();

  state.submitting = true;
  setButtonLoading(checkoutButton, true, "Memproses pembayaran...");

  try {
    const receipt = await apiFetch("/transactions", {
      method: "POST",
      body: { items },
    });

    const backendTotal = Number(receipt.total);
    const change = paid - backendTotal;

    showReceipt(receipt, paid, change);

    state.cart.clear();
    paidInput.value = "";
    renderProducts();
    renderCart();
    await loadProducts();
  } catch (error) {
    const message = error.message || "Transaksi gagal diproses.";
    await loadProducts();
    setAlert(posAlert, message, "error");
  } finally {
    state.submitting = false;
    setButtonLoading(checkoutButton, false);
    updateSummary();
  }
}

cartList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  changeQuantity(Number(button.dataset.id), button.dataset.action);
});

posSearch.addEventListener("input", debounce(renderProducts, 200));
posCategory.addEventListener("change", renderProducts);
posRefreshButton.addEventListener("click", loadProducts);
paidInput.addEventListener("input", updateSummary);
exactPayButton.addEventListener("click", async () => {
  const totals = await refreshTotals();
  paidInput.value = String(totals.total);
  updateSummary();
});
checkoutButton.addEventListener("click", checkout);
printReceiptButton.addEventListener("click", printReceipt);
newTransactionButton.addEventListener("click", closeReceiptModal);

document.querySelectorAll("[data-close-receipt]").forEach((element) => {
  element.addEventListener("click", closeReceiptModal);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !receiptModal.hidden) {
    closeReceiptModal();
  }
});

currentUserLabel();
loadProducts();
