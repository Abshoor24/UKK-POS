/**
 * Helper sesi login.
 * Token disimpan di localStorage dan dikirim sebagai header Bearer oleh api.js.
 */

function getToken() {
  return localStorage.getItem(APP_CONFIG.TOKEN_KEY);
}

/**
 * Membaca dan memvalidasi data pengguna dari localStorage.
 * @returns {object|null} Data pengguna yang tersimpan atau null jika tidak valid.
 */
function getUser() {
  const raw = localStorage.getItem(APP_CONFIG.USER_KEY);
  if (!raw) return null;
  try {
    const user = JSON.parse(raw);
    return user && user.id ? user : null;
  } catch (error) {
    return null;
  }
}

/**
 * Menyimpan token sesi dan data pengguna ke localStorage.
 * @param {string} token - Token autentikasi dari backend.
 * @param {object} user - Data pengguna yang login.
 * @returns {void}
 */
function setSession(token, user) {
  localStorage.setItem(APP_CONFIG.TOKEN_KEY, token);
  setUser(user);
}

/**
 * Menyimpan data pengguna dalam format JSON ke localStorage.
 * @param {object} user - Data pengguna yang akan disimpan.
 * @returns {void}
 */
function setUser(user) {
  localStorage.setItem(APP_CONFIG.USER_KEY, JSON.stringify(user));
}

/**
 * Menghapus token dan data pengguna dari localStorage.
 * @returns {void}
 */
function clearSession() {
  localStorage.removeItem(APP_CONFIG.TOKEN_KEY);
  localStorage.removeItem(APP_CONFIG.USER_KEY);
}

/**
 * Memeriksa apakah token autentikasi tersimpan.
 * @returns {boolean} True jika token tersedia.
 */
function isLoggedIn() {
  return Boolean(getToken());
}

/**
 * Memeriksa role pengguna tersimpan untuk menentukan akses tampilan admin.
 * @returns {boolean} True jika pengguna memiliki role admin.
 */
function isAdmin() {
  const user = getUser();
  return Boolean(user && user.role === "admin");
}

// Halaman berada di /pages/, sedangkan login ada di root frontend.
/**
 * Menentukan awalan path berdasarkan lokasi halaman frontend.
 * @returns {string} Awalan relatif untuk navigasi halaman.
 */
function pathPrefix() {
  return window.location.pathname.includes("/pages/") ? "../" : "./";
}

/**
 * Mengarahkan browser ke halaman login.
 * @returns {void}
 */
function goToLogin() {
  window.location.href = pathPrefix() + "index.html";
}

/**
 * Mengarahkan browser ke dashboard.
 * @returns {void}
 */
function goToDashboard() {
  window.location.href = pathPrefix() + "pages/dashboard.html";
}

// Dipakai setiap halaman terproteksi sebelum memanggil API.
/**
 * Memeriksa sesi login dan mengarahkan ke login jika token tidak tersedia.
 * @returns {boolean} True jika token tersedia, selain itu false.
 */
function requireAuth() {
  if (!isLoggedIn()) {
    goToLogin();
    return false;
  }
  return true;
}
