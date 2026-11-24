const filterForm = document.getElementById("filter-form");
const fromInput = document.getElementById("from-input");
const toInput = document.getElementById("to-input");
const limitInput = document.getElementById("limit-input");
const todayButton = document.getElementById("today-btn");
const resetFilterButton = document.getElementById("reset-filter-btn");
const transactionsSubtitle = document.getElementById("transactions-subtitle");
const transactionsAlert = document.getElementById("transactions-alert");
const transactionsLoading = document.getElementById("transactions-loading");
const transactionsEmpty = document.getElementById("transactions-empty");
const transactionsTableWrap = document.getElementById("transactions-table-wrap");
const transactionsBody = document.getElementById("transactions-body");
const DATE_QUERY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Mengisi filter tanggal dari query string yang berformat YYYY-MM-DD.
 * @returns {void}
 */
function applyQueryDateFilters() {
  const from = getQueryParam("from");
  const to = getQueryParam("to");
  if (from && DATE_QUERY_PATTERN.test(from)) fromInput.value = from;
  if (to && DATE_QUERY_PATTERN.test(to)) toInput.value = to;
}

/**
 * Menentukan keterangan riwayat berdasarkan role pengguna.
 * @returns {string} Teks ringkasan akses riwayat.
 */
function baseSubtitle() {
  const user = getUser();
  return user && user.role === "admin"
    ? "Anda melihat transaksi dari semua kasir."
    : "Anda melihat riwayat transaksi milik Anda.";
}

/**
 * Membentuk query string dari filter tanggal dan batas jumlah transaksi.
 * @returns {string} Parameter query untuk request riwayat.
 */
function buildQuery() {
  const params = new URLSearchParams();
  if (fromInput.value) params.set("from", fromInput.value);
  if (toInput.value) params.set("to", toInput.value);
  params.set("limit", limitInput.value || "50");
  return params.toString();
}

/**
 * Menampilkan daftar transaksi pada tabel riwayat.
 * @param {Array<object>} rows - Baris transaksi dari backend.
 * @returns {void}
 */
function renderTransactions(rows) {
  transactionsBody.replaceChildren();
  transactionsLoading.hidden = true;

  if (rows.length === 0) {
    transactionsTableWrap.hidden = true;
    transactionsEmpty.hidden = false;
    return;
  }

  transactionsEmpty.hidden = true;
  transactionsTableWrap.hidden = false;

  for (const transaction of rows) {
    const row = document.createElement("tr");

    row.appendChild(createEl("td", "", `#${transaction.id}`));
    row.appendChild(createEl("td", "", formatDateTime(transaction.created_at)));
    row.appendChild(createEl("td", "", transaction.cashier || "-"));
    row.appendChild(createEl("td", "num", transaction.item_count));
    row.appendChild(createEl("td", "num", formatRupiah(transaction.subtotal)));
    row.appendChild(createEl("td", "num", formatRupiah(transaction.discount)));
    row.appendChild(createEl("td", "num", formatRupiah(transaction.tax)));
    row.appendChild(createEl("td", "num", formatRupiah(transaction.total)));

    const actionCell = createEl("td", "actions");
    const detailLink = createEl("a", "btn btn--ghost btn--small", "Detail");
    detailLink.href = `transaction-detail?id=${transaction.id}`;
    actionCell.appendChild(detailLink);

    row.appendChild(actionCell);
    transactionsBody.appendChild(row);
  }
}

/**
 * Memvalidasi filter lalu memuat transaksi dari backend.
 * @returns {Promise<void>}
 */
async function loadTransactions() {
  setAlert(transactionsAlert, "");

  if (fromInput.value && toInput.value && fromInput.value > toInput.value) {
    setAlert(transactionsAlert, "Tanggal awal tidak boleh setelah tanggal akhir.");
    return;
  }

  transactionsLoading.hidden = false;
  transactionsTableWrap.hidden = true;
  transactionsEmpty.hidden = true;

  try {
    const rows = await apiFetch(`/transactions?${buildQuery()}`);
    if (!Array.isArray(rows)) {
      throw new Error("Respons riwayat transaksi tidak valid.");
    }
    transactionsSubtitle.textContent = `${baseSubtitle()} Menampilkan ${rows.length} transaksi.`;
    renderTransactions(rows);
  } catch (error) {
    transactionsLoading.hidden = true;
    transactionsTableWrap.hidden = true;
    transactionsEmpty.hidden = true;
    setAlert(transactionsAlert, error.message || "Gagal memuat riwayat transaksi.");
  }
}

filterForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loadTransactions();
});

todayButton.addEventListener("click", () => {
  const today = todayValue();
  fromInput.value = today;
  toInput.value = today;
  loadTransactions();
});

resetFilterButton.addEventListener("click", () => {
  fromInput.value = "";
  toInput.value = "";
  limitInput.value = "50";
  transactionsSubtitle.textContent = baseSubtitle();
  applyQueryDateFilters();
  loadTransactions();
});

transactionsSubtitle.textContent = baseSubtitle();
loadTransactions();
