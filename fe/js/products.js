const searchInput = document.getElementById("product-search");
const categoryFilter = document.getElementById("category-filter");
const resetFilterButton = document.getElementById("reset-filter-btn");
const productCount = document.getElementById("product-count");
const productsAlert = document.getElementById("products-alert");
const productsLoading = document.getElementById("products-loading");
const productsEmpty = document.getElementById("products-empty");
const productsTableWrap = document.getElementById("products-table-wrap");
const productsBody = document.getElementById("products-body");
const actionsHeader = document.getElementById("actions-header");
const addProductButton = document.getElementById("add-product-btn");

const productModal = document.getElementById("product-modal");
const productModalTitle = document.getElementById("product-modal-title");
const productForm = document.getElementById("product-form");
const productFormAlert = document.getElementById("product-form-alert");
const nameInput = document.getElementById("product-name");
const categoryInput = document.getElementById("product-category");
const priceInput = document.getElementById("product-price");
const stockInput = document.getElementById("product-stock");
const imageInput = document.getElementById("product-image");
const imagePreviewWrap = document.getElementById("image-preview-wrap");
const imagePreview = document.getElementById("image-preview");
const imageNote = document.getElementById("image-note");
const productSubmitButton = document.getElementById("product-submit-btn");
const categoryOptions = document.getElementById("category-options");

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

let products = [];
let editingProduct = null;
let previewObjectUrl = null;
let submitting = false;

/**
 * Menghapus URL pratinjau gambar sementara dan menyembunyikan pratinjau.
 * @returns {void}
 */
function resetPreview() {
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }
  imagePreview.removeAttribute("src");
  imagePreviewWrap.hidden = true;
}

/**
 * Menampilkan kembali gambar produk yang sedang diedit.
 * @returns {void}
 */
function showCurrentImage() {
  resetPreview();
  if (!editingProduct) return;
  const url = resolveImageUrl(editingProduct.image_url);
  if (url) {
    imagePreview.src = url;
    imagePreviewWrap.hidden = false;
  }
}

/**
 * Membuat dan menampilkan pratinjau untuk file gambar yang dipilih.
 * @param {File} file - File gambar dari input pengguna.
 * @returns {void}
 */
function showFilePreview(file) {
  resetPreview();
  previewObjectUrl = URL.createObjectURL(file);
  imagePreview.src = previewObjectUrl;
  imagePreviewWrap.hidden = false;
}

/**
 * Memeriksa format dan ukuran file gambar produk.
 * @param {File|null} file - File gambar yang dipilih atau null.
 * @returns {string|null} Pesan kesalahan atau null jika file valid.
 */
function validateImageFile(file) {
  if (!file) return null;
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Gambar harus berformat JPG, PNG, GIF, atau WebP.";
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return "Ukuran gambar maksimal 2 MB.";
  }
  return null;
}

/**
 * Mengisi filter dan pilihan kategori dari produk yang tersedia.
 * @returns {void}
 */
function updateCategoryOptions() {
  const current = categoryFilter.value;
  const categories = [...new Set(products.map((item) => item.category).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "id"));

  categoryFilter.replaceChildren(new Option("Semua kategori", ""));
  for (const category of categories) {
    categoryFilter.appendChild(new Option(category, category));
  }
  categoryFilter.value = categories.includes(current) ? current : "";

  categoryOptions.replaceChildren();
  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    categoryOptions.appendChild(option);
  }
}

/**
 * Memfilter daftar produk berdasarkan kata kunci dan kategori.
 * @returns {Array<object>} Produk yang cocok dengan filter saat ini.
 */
function filteredProducts() {
  const keyword = searchInput.value.trim().toLowerCase();
  const category = categoryFilter.value;

  return products.filter((product) => {
    const matchesCategory = !category || product.category === category;
    const matchesKeyword =
      !keyword ||
      product.name.toLowerCase().includes(keyword) ||
      product.category.toLowerCase().includes(keyword);
    return matchesCategory && matchesKeyword;
  });
}

/**
 * Menampilkan produk terfilter beserta aksi yang tersedia untuk role pengguna.
 * @returns {void}
 */
function renderProducts() {
  const list = filteredProducts();
  productsBody.replaceChildren();
  productsLoading.hidden = true;
  actionsHeader.hidden = !isAdmin();

  productCount.textContent = `Menampilkan ${list.length} dari ${products.length} produk aktif.`;

  if (list.length === 0) {
    productsTableWrap.hidden = true;
    productsEmpty.hidden = false;
    productsEmpty.textContent =
      products.length === 0
        ? "Belum ada produk aktif. Admin dapat menambahkan produk."
        : "Tidak ada produk yang cocok dengan pencarian.";
    return;
  }

  productsEmpty.hidden = true;
  productsTableWrap.hidden = false;

  for (const product of list) {
    const row = document.createElement("tr");

    const productCell = createEl("td");
    const productInner = createEl("div", "product-cell");
    productInner.appendChild(createThumb(product));
    productInner.appendChild(createEl("span", "product-cell__name", product.name));
    productCell.appendChild(productInner);

    const categoryCell = createEl("td", "", product.category);
    const priceCell = createEl("td", "num", formatRupiah(product.price));

    const stockCell = createEl("td", "num");
    if (product.stock === 0) {
      stockCell.appendChild(createEl("span", "stock-empty", "Habis"));
    } else if (product.stock <= 10) {
      stockCell.appendChild(createEl("span", "stock-low", `${product.stock} (menipis)`));
    } else {
      stockCell.textContent = String(product.stock);
    }

    row.append(productCell, categoryCell, priceCell, stockCell);

    if (isAdmin()) {
      const actionCell = createEl("td", "actions");
      const actions = createEl("div", "row-actions");

      const editButton = createEl("button", "btn btn--ghost btn--small", "Edit");
      editButton.type = "button";
      editButton.dataset.action = "edit";
      editButton.dataset.id = String(product.id);

      const deleteButton = createEl("button", "btn btn--danger btn--small", "Hapus");
      deleteButton.type = "button";
      deleteButton.dataset.action = "delete";
      deleteButton.dataset.id = String(product.id);

      actions.append(editButton, deleteButton);
      actionCell.appendChild(actions);
      row.appendChild(actionCell);
    }

    productsBody.appendChild(row);
  }
}

/**
 * Memuat daftar produk aktif dari backend.
 * @returns {Promise<void>}
 */
async function loadProducts() {
  setAlert(productsAlert, "");
  productsLoading.hidden = false;
  productsTableWrap.hidden = true;
  productsEmpty.hidden = true;

  try {
    const data = await apiFetch("/products");
    if (!Array.isArray(data)) {
      throw new Error("Respons daftar produk tidak valid.");
    }
    products = data;
    updateCategoryOptions();
    renderProducts();
  } catch (error) {
    productsLoading.hidden = true;
    productsTableWrap.hidden = true;
    productsEmpty.hidden = true;
    setAlert(productsAlert, error.message || "Gagal memuat produk.");
  }
}

/**
 * Membuka form modal untuk menambah produk atau mengedit produk terpilih.
 * @param {object|null} product - Produk yang diedit atau null untuk produk baru.
 * @returns {void}
 */
function openProductModal(product) {
  editingProduct = product;
  submitting = false;
  productForm.reset();
  setAlert(productFormAlert, "");
  resetPreview();

  if (product) {
    productModalTitle.textContent = "Edit Produk";
    nameInput.value = product.name;
    categoryInput.value = product.category;
    priceInput.value = String(product.price);
    stockInput.value = String(product.stock);
    imageNote.hidden = false;
    productSubmitButton.textContent = "Simpan Perubahan";
    showCurrentImage();
  } else {
    productModalTitle.textContent = "Tambah Produk";
    imageNote.hidden = true;
    productSubmitButton.textContent = "Simpan Produk";
  }

  productModal.hidden = false;
  nameInput.focus();
}

/**
 * Menutup modal produk dan mengosongkan nilai serta pratinjau form.
 * @returns {void}
 */
function closeProductModal() {
  if (submitting) return;
  productModal.hidden = true;
  editingProduct = null;
  productForm.reset();
  resetPreview();
  setAlert(productFormAlert, "");
}

/**
 * Meminta konfirmasi lalu menonaktifkan produk melalui backend.
 * @param {object} product - Produk yang akan dinonaktifkan.
 * @returns {Promise<void>}
 */
async function deleteProduct(product) {
  const confirmed = window.confirm(
    `Nonaktifkan produk "${product.name}"?\n\nProduk akan dihapus dari daftar dan tidak bisa dijual, tetapi data transaksi lama tetap aman.`
  );
  if (!confirmed) return;

  setAlert(productsAlert, "");
  try {
    const result = await apiFetch(`/products/${product.id}`, { method: "DELETE" });
    showToast(result && result.message ? result.message : "Produk dinonaktifkan.");
    await loadProducts();
  } catch (error) {
    setAlert(productsAlert, error.message || "Gagal menghapus produk.");
  }
}

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submitting) return;

  setAlert(productFormAlert, "");

  const name = nameInput.value.trim();
  const category = categoryInput.value.trim();
  const rawPrice = priceInput.value.trim();
  const rawStock = stockInput.value.trim();
  const price = Number(rawPrice);
  const stock = Number(rawStock);
  const file = imageInput.files[0] || null;
  const errors = [];

  if (!name) errors.push("Nama produk wajib diisi.");
  if (!category) errors.push("Kategori wajib diisi.");
  if (!/^\d+$/.test(rawPrice) || !Number.isSafeInteger(price)) {
    errors.push("Harga harus bilangan bulat >= 0.");
  }
  if (!/^\d+$/.test(rawStock) || !Number.isSafeInteger(stock)) {
    errors.push("Stok harus bilangan bulat >= 0.");
  }

  const imageError = validateImageFile(file);
  if (imageError) errors.push(imageError);

  if (errors.length > 0) {
    setAlert(productFormAlert, errors.join("\n"));
    return;
  }

  const formData = new FormData();
  formData.append("name", name);
  formData.append("category", category);
  formData.append("price", String(price));
  formData.append("stock", String(stock));
  if (file) formData.append("image", file);

  const wasEditing = Boolean(editingProduct);
  submitting = true;
  setButtonLoading(productSubmitButton, true, "Menyimpan...");

  try {
    if (editingProduct) {
      await apiFetch(`/products/${editingProduct.id}`, {
        method: "PUT",
        body: formData,
      });
    } else {
      await apiFetch("/products", {
        method: "POST",
        body: formData,
      });
    }

    submitting = false;
    closeProductModal();
    showToast(wasEditing ? "Produk berhasil diperbarui." : "Produk berhasil ditambahkan.");
    await loadProducts();
  } catch (error) {
    setAlert(productFormAlert, error.message || "Gagal menyimpan produk.");
  } finally {
    submitting = false;
    setButtonLoading(productSubmitButton, false);
  }
});

imageInput.addEventListener("change", () => {
  setAlert(productFormAlert, "");
  const file = imageInput.files[0] || null;

  if (!file) {
    showCurrentImage();
    return;
  }

  const imageError = validateImageFile(file);
  if (imageError) {
    imageInput.value = "";
    showCurrentImage();
    setAlert(productFormAlert, imageError);
    return;
  }

  showFilePreview(file);
});

productsBody.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const product = products.find((item) => item.id === Number(button.dataset.id));
  if (!product) return;

  if (button.dataset.action === "edit") {
    openProductModal(product);
  } else if (button.dataset.action === "delete") {
    deleteProduct(product);
  }
});

document.querySelectorAll("[data-close-product-modal]").forEach((element) => {
  element.addEventListener("click", closeProductModal);
});

addProductButton.addEventListener("click", () => openProductModal(null));

searchInput.addEventListener("input", debounce(renderProducts, 200));
categoryFilter.addEventListener("change", renderProducts);
resetFilterButton.addEventListener("click", () => {
  searchInput.value = "";
  categoryFilter.value = "";
  renderProducts();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !productModal.hidden) {
    closeProductModal();
  }
});

const initialQuery = getQueryParam("q");
if (initialQuery) searchInput.value = initialQuery;

loadProducts();
