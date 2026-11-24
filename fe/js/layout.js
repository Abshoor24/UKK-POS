/**
 * Layout bersama: proteksi halaman, menu aktif, data user, dan tombol keluar.
 * Semua halaman selain login memuat file ini.
 */

function paintUser(user) {
  const nameEl = document.getElementById("nav-user");
  const roleEl = document.getElementById("nav-role");

  if (nameEl) nameEl.textContent = user ? user.username : "-";
  if (roleEl) {
    roleEl.textContent = user ? user.role : "-";
    roleEl.className = "badge";
    if (user && user.role === "admin") roleEl.classList.add("badge--success");
    if (user && user.role === "kasir") roleEl.classList.add("badge--warning");
  }
}

/**
 * Menampilkan atau menyembunyikan elemen navigasi khusus admin.
 * @returns {void}
 */
function applyRoleVisibility() {
  const admin = isAdmin();
  document.querySelectorAll("[data-admin-only]").forEach((element) => {
    element.hidden = !admin;
  });
}

/**
 * Menandai tautan navigasi yang sesuai dengan halaman aktif.
 * @returns {void}
 */
function markActiveNav() {
  let page = document.body.dataset.page;
  if (page === "transaction-detail") page = "transactions";

  document.querySelectorAll("[data-nav]").forEach((link) => {
    const active = link.dataset.nav === page;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
  });
}

/**
 * Memproteksi halaman dan memuat informasi pengguna untuk layout.
 * @returns {Promise<void>}
 */
async function initLayout() {
  if (!requireAuth()) return;

  markActiveNav();
  paintUser(getUser());
  applyRoleVisibility();

  const logoutButton = document.getElementById("logout-btn");
  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      clearSession();
      goToLogin();
    });
  }

  // Verifikasi token ke backend sekaligus mengambil data terbaru.
  try {
    const user = await getCurrentUser();
    setUser(user);
    paintUser(user);
    applyRoleVisibility();
  } catch (error) {
    // Error 401 sudah ditangani api.js (hapus sesi + redirect).
    // Error jaringan tidak perlu memblokir tampilan.
  }
}

initLayout();
