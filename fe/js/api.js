/**
 * Wrapper fetch tunggal.
 * - Menambahkan header Authorization: Bearer <token>.
 * - Otomatis JSON.stringify untuk body objek; FormData dikirim apa adanya.
 * - Mengubah { errors: [...] } / { message } dari backend menjadi Error.
 * - Status 401 menghapus sesi dan mengarahkan ke halaman login.
 */

class ApiError extends Error {
  /**
   * Membuat error API dengan status HTTP dan data respons.
   * @param {string} message - Pesan error yang akan ditampilkan.
   * @param {number} [status=0] - Status HTTP terkait, atau 0 jika tidak tersedia.
   * @param {*} [data=null] - Data respons backend jika tersedia.
   */
  constructor(message, status = 0, data = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

/**
 * Membentuk URL API lengkap dari path relatif atau mempertahankan URL absolut.
 * @param {string} path - Path endpoint atau URL absolut.
 * @returns {string} URL yang akan dipanggil.
 */
function buildApiUrl(path) {
  const base = String(APP_CONFIG.API_BASE_URL || "").replace(/\/+$/, "");
  if (/^https?:\/\//i.test(path)) return path;
  return base + (path.startsWith("/") ? path : `/${path}`);
}

/**
 * Mengambil pesan yang sesuai dari bentuk respons error backend.
 * @param {*} data - Data error yang diterima dari backend.
 * @param {number} status - Status HTTP respons.
 * @returns {string} Pesan error untuk ditampilkan.
 */
function extractErrorMessage(data, status) {
  if (data && Array.isArray(data.errors) && data.errors.length > 0) {
    return data.errors.map(String).join("\n");
  }
  if (data && typeof data.message === "string" && data.message.trim()) {
    return data.message;
  }
  if (typeof data === "string" && data.trim()) {
    return data;
  }
  return `Terjadi kesalahan (HTTP ${status})`;
}

/**
 * Mengirim request ke API dengan token sesi dan penanganan respons terpusat.
 * @param {string} path - Path endpoint API.
 * @param {object} [options={}] - Opsi Fetch seperti method, body, headers, dan opsi request lain.
 * @returns {Promise<*>} Data respons backend.
 * @throws {ApiError} Jika koneksi gagal, sesi berakhir, atau backend mengirim status error.
 */
async function apiFetch(path, options = {}) {
  const { method = "GET", body, headers = {}, ...rest } = options;
  const requestHeaders = new Headers(headers);
  let requestBody;

  if (body instanceof FormData) {
    requestBody = body;
  } else if (body !== undefined && body !== null) {
    requestHeaders.set("Content-Type", "application/json");
    requestBody = JSON.stringify(body);
  }

  const token = getToken();
  if (token) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  let response;
  try {
    response = await fetch(buildApiUrl(path), {
      method,
      headers: requestHeaders,
      body: requestBody,
      ...rest,
    });
  } catch (error) {
    throw new ApiError(
      "Tidak dapat terhubung ke server. Pastikan backend berjalan dan CORS sudah aktif."
    );
  }

  const contentType = response.headers.get("content-type") || "";
  let data = null;

  if (contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch (error) {
      data = null;
    }
  } else {
    // Respons HTML (misalnya error default Express) tidak ditampilkan mentah.
    const text = await response.text();
    data = text && !text.trim().startsWith("<") ? { message: text } : null;
  }

  if (response.status === 401) {
    clearSession();
    const isLoginPage = document.body.dataset.page === "login";
    if (!isLoginPage) {
      goToLogin();
    }
    throw new ApiError(
      isLoginPage
        ? extractErrorMessage(data, response.status)
        : "Sesi login berakhir. Silakan masuk kembali.",
      response.status,
      data
    );
  }

  if (!response.ok) {
    throw new ApiError(
      extractErrorMessage(data, response.status),
      response.status,
      data
    );
  }

  return data;
}

/**
 * Mengambil data pengguna yang sedang login dari endpoint autentikasi.
 * @returns {Promise<object>} Data pengguna dari backend.
 * @throws {ApiError} Jika request autentikasi gagal.
 */
async function getCurrentUser() {
  const data = await apiFetch("/auth/me");
  return data.user;
}
