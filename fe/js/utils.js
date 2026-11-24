/**
 * Kumpulan helper UI dan format data.
 * Semua data dari API ditampilkan lewat textContent / createElement (aman XSS).
 */

function createEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

/**
 * Memformat nilai numerik sebagai mata uang rupiah tanpa angka desimal.
 * @param {*} value - Nilai yang akan diformat.
 * @returns {string} Nilai dalam format mata uang Indonesia.
 */
function formatRupiah(value) {
  const number = Number(value);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(number) ? number : 0);
}

/**
 * Memformat tarif desimal dari API menjadi teks persen.
 * Hanya untuk tampilan; nilai tarif tetap berasal dari backend.
 * @param {number} rate - Tarif desimal, misalnya 0.1.
 * @returns {string} Teks persen ("10%"), atau string kosong bila tidak ada tarif.
 */
function formatPercent(rate) {
  const number = Number(rate);
  if (!Number.isFinite(number) || number <= 0) return "";
  return new Intl.NumberFormat("id-ID", {
    style: "percent",
    maximumFractionDigits: 2,
  }).format(number);
}

/**
 * Menyusun label diskon/pajak dari tarif yang dikirim backend.
 * @param {string} base - Label dasar, misalnya "Pajak".
 * @param {number} rate - Tarif desimal dari API.
 * @returns {string} Label siap tampil, misalnya "Pajak (10%)".
 */
function formatRateLabel(base, rate) {
  const percent = formatPercent(rate);
  return percent ? `${base} (${percent})` : base;
}

// SQLite menyimpan "YYYY-MM-DD HH:MM:SS" (waktu lokal).
/**
 * Mengubah tanggal dari format API menjadi objek Date yang dapat dipakai browser.
 * @param {string|null|undefined} value - Teks tanggal dari API.
 * @returns {Date|null} Tanggal valid atau null jika nilainya kosong atau tidak valid.
 */
function parseApiDate(value) {
  if (!value) return null;
  const normalized = String(value).replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Memformat tanggal dan waktu untuk tampilan lokal Indonesia.
 * @param {string|null|undefined} value - Teks tanggal dari API.
 * @returns {string} Tanggal dan waktu terformat atau nilai asal sebagai fallback.
 */
function formatDateTime(value) {
  const date = parseApiDate(value);
  if (!date) return value ? String(value) : "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/**
 * Memformat tanggal untuk tampilan lokal Indonesia.
 * @param {string|null|undefined} value - Teks tanggal dari API.
 * @returns {string} Tanggal terformat atau nilai asal sebagai fallback.
 */
function formatDate(value) {
  const date = parseApiDate(value);
  if (!date) return value ? String(value) : "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(date);
}

// Nilai untuk <input type="date"> berdasarkan waktu lokal, bukan UTC.
/**
 * Menghasilkan tanggal hari ini dalam format yang diterima input date.
 * @returns {string} Tanggal lokal berformat YYYY-MM-DD.
 */
function todayValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Membuat fungsi pembungkus yang menunda pemanggilan hingga jeda input selesai.
 * @param {Function} fn - Fungsi yang dipanggil setelah jeda.
 * @param {number} [delay=250] - Lama jeda dalam milidetik.
 * @returns {Function} Fungsi debounced yang meneruskan konteks dan argumen pemanggil.
 */
function debounce(fn, delay = 250) {
  let timer = null;
  return /** @param {...*} args - Argumen fungsi asal. @returns {void} */ function debounced(...args) {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Menampilkan pesan atau mengosongkan elemen alert.
 * @param {HTMLElement|null} element - Elemen alert tujuan.
 * @param {string} message - Pesan yang ditampilkan, atau string kosong untuk menyembunyikan alert.
 * @param {string} [type="error"] - Jenis alert untuk kelas tampilannya.
 * @returns {void}
 */
function setAlert(element, message, type = "error") {
  if (!element) return;
  if (!message) {
    element.hidden = true;
    element.textContent = "";
    return;
  }
  element.textContent = message;
  element.className = `alert alert--${type}`;
  element.hidden = false;
}

/**
 * Menambahkan notifikasi sementara pada halaman.
 * @param {string} message - Pesan notifikasi.
 * @param {string} [type="success"] - Jenis notifikasi untuk kelas tampilannya.
 * @returns {void}
 */
function showToast(message, type = "success") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = createEl("div", "toast-container");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const toast = createEl("div", `toast toast--${type}`, message);
  container.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3500);
}

/**
 * Mengubah teks dan status tombol selama suatu request berlangsung.
 * @param {HTMLButtonElement|null} button - Tombol yang diperbarui.
 * @param {boolean} loading - True saat proses berlangsung.
 * @param {string} [loadingText="Memproses..."] - Teks tombol selama proses berlangsung.
 * @returns {void}
 */
function setButtonLoading(button, loading, loadingText = "Memproses...") {
  if (!button) return;
  if (loading) {
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
    return;
  }
  if (button.dataset.originalText) {
    button.textContent = button.dataset.originalText;
    delete button.dataset.originalText;
  }
  button.disabled = false;
}

// Bentuk image_url dari backend: "/api/products/1/image" (relatif ke origin backend).
/**
 * Mengubah path gambar API menjadi URL lengkap pada origin backend.
 * @param {string|null|undefined} imagePath - Path gambar dari API.
 * @returns {string|null} URL gambar lengkap atau null jika path tidak tersedia atau invalid.
 */
function resolveImageUrl(imagePath) {
  if (!imagePath) return null;
  try {
    const apiUrl = new URL(APP_CONFIG.API_BASE_URL, window.location.href);
    return new URL(imagePath, apiUrl.origin).href;
  } catch (error) {
    return null;
  }
}

/**
 * Mengubah nilai menjadi bilangan bulat aman yang lebih besar dari nol.
 * @param {*} value - Nilai yang akan diperiksa.
 * @returns {number|null} Bilangan bulat positif atau null jika tidak valid.
 */
function toPositiveInt(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

/**
 * Mengambil nilai parameter dari query string URL saat ini.
 * @param {string} name - Nama parameter query.
 * @returns {string|null} Nilai parameter atau null jika tidak ada.
 */
function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/**
 * Membuat thumbnail produk berupa gambar atau placeholder nama.
 * @param {object} product - Produk yang memiliki image_url dan nama.
 * @param {string} [className="thumb"] - Kelas CSS elemen thumbnail.
 * @returns {HTMLElement} Elemen gambar thumbnail atau placeholder.
 */
function createThumb(product, className = "thumb") {
  const imageUrl = resolveImageUrl(product.image_url);
  if (imageUrl) {
    const img = document.createElement("img");
    img.className = className;
    img.src = imageUrl;
    img.alt = product.name ? `Gambar ${product.name}` : "Gambar produk";
    img.loading = "lazy";
    return img;
  }
  const initial = product.name ? product.name.trim().charAt(0) : "?";
  return createEl("div", `${className} thumb--placeholder`, initial);
}

/**
 * Mengganti seluruh anak elemen dengan node atau teks yang diberikan.
 * @param {HTMLElement|null} element - Elemen yang anaknya akan diganti.
 * @param {...(Node|string)} children - Node atau teks pengganti.
 * @returns {void}
 */
function resetChildren(element, ...children) {
  if (!element) return;
  element.replaceChildren(...children);
}
