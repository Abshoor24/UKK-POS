const settingsPage = document.getElementById("settings-page");
const settingsAlert = document.getElementById("settings-alert");
const settingsLoading = document.getElementById("settings-loading");
const settingsPanel = document.getElementById("settings-panel");
const settingsForm = document.getElementById("settings-form");
const taxPercentInput = document.getElementById("tax-percent");
const discountTiersBody = document.getElementById("discount-tiers-body");
const addTierButton = document.getElementById("add-tier-button");
const saveSettingsButton = document.getElementById("save-settings-button");

let isSaving = false;

/**
 * Memeriksa batas maksimal dua angka desimal tanpa menganggap artefak float sebagai digit tambahan.
 * @param {number} value - Angka persentase yang diperiksa.
 * @returns {boolean} True jika nilainya memiliki maksimal dua desimal.
 */
function hasAtMostTwoDecimals(value) {
  return Number(value.toFixed(2)) === value;
}

/**
 * Memvalidasi persentase dari input teks dan menambahkan semua error.
 * @param {string} rawValue - Isi kolom sebelum dikonversi menjadi angka.
 * @param {string} label - Nama nilai untuk pesan error.
 * @param {string[]} errors - Daftar error yang akan ditambahkan.
 * @returns {void}
 */
function validatePercentInput(rawValue, label, errors) {
  const valueText = typeof rawValue === "string" ? rawValue.trim() : "";
  if (valueText === "") {
    errors.push(`${label} wajib diisi.`);
    return;
  }

  const value = Number(valueText);
  if (!Number.isFinite(value)) {
    errors.push(`${label} harus berupa angka yang valid.`);
    return;
  }
  if (value < 0 || value > 100) {
    errors.push(`${label} harus antara 0 sampai 100.`);
  }
  if (!hasAtMostTwoDecimals(value)) {
    errors.push(`${label} maksimal memiliki 2 angka desimal.`);
  }
}

/**
 * Memvalidasi pajak dan seluruh baris diskon tanpa berhenti pada error pertama.
 * @param {{taxPercent: string, tiers: Array<{minSubtotal: string, ratePercent: string}>}} input
 *        Nilai mentah dari form.
 * @returns {string[]} Semua pesan error; array kosong berarti valid.
 */
function validateSettingsInput(input) {
  const errors = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return ["Data pengaturan harus berupa objek."];
  }

  validatePercentInput(input.taxPercent, "Pajak", errors);
  if (!Array.isArray(input.tiers)) {
    errors.push("Daftar tingkat diskon harus berupa array.");
    return errors;
  }

  const seenThresholds = new Set();
  for (let index = 0; index < input.tiers.length; index += 1) {
    const tier = input.tiers[index];
    const label = `Tingkat diskon ke-${index + 1}`;
    if (!tier || typeof tier !== "object" || Array.isArray(tier)) {
      errors.push(`${label}: data tingkat harus berupa objek.`);
      continue;
    }

    const minimumText = typeof tier.minSubtotal === "string"
      ? tier.minSubtotal.trim()
      : "";
    if (minimumText === "") {
      errors.push(`${label}: subtotal minimum wajib diisi.`);
    } else {
      const minimum = Number(minimumText);
      if (!/^\d+$/.test(minimumText) || !Number.isSafeInteger(minimum) || minimum < 0) {
        errors.push(`${label}: batas subtotal harus bilangan bulat aman tidak negatif.`);
      } else if (seenThresholds.has(minimum)) {
        errors.push(`${label}: batas subtotal tidak boleh kembar.`);
      } else {
        seenThresholds.add(minimum);
      }
    }

    validatePercentInput(
      tier.ratePercent,
      `${label}: persentase diskon`,
      errors
    );
  }

  return errors;
}

/**
 * Membuat satu baris input tier diskon.
 * @param {{min_subtotal?: number, rate_percent?: number}} [tier={}] - Data tier dari API.
 * @returns {HTMLTableRowElement} Baris tier yang siap dipasang ke tabel.
 */
function createTierRow(tier = {}) {
  const row = document.createElement("tr");
  const minimumCell = document.createElement("td");
  const rateCell = document.createElement("td");
  const actionCell = document.createElement("td");

  const minimumInput = document.createElement("input");
  minimumInput.type = "number";
  minimumInput.min = "0";
  minimumInput.step = "1";
  minimumInput.value = tier.min_subtotal === undefined ? "" : String(tier.min_subtotal);
  minimumInput.setAttribute("aria-label", "Subtotal minimum tingkat diskon");

  const rateInput = document.createElement("input");
  rateInput.type = "number";
  rateInput.min = "0";
  rateInput.max = "100";
  rateInput.step = "0.01";
  rateInput.inputMode = "decimal";
  rateInput.value = tier.rate_percent === undefined ? "" : String(tier.rate_percent);
  rateInput.setAttribute("aria-label", "Persentase diskon");

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "btn btn--danger btn--small";
  removeButton.dataset.removeTier = "true";
  removeButton.textContent = "Hapus";

  minimumCell.appendChild(minimumInput);
  rateCell.appendChild(rateInput);
  actionCell.className = "actions";
  actionCell.appendChild(removeButton);
  row.append(minimumCell, rateCell, actionCell);
  return row;
}

/**
 * Mengisi tabel dari respons server tanpa mengurutkan baris yang sedang diedit.
 * @param {Array<{min_subtotal: number, rate_percent: number}>} tiers - Tier dari server.
 * @returns {void}
 */
function renderTierRows(tiers) {
  discountTiersBody.replaceChildren();
  for (const tier of tiers) {
    discountTiersBody.appendChild(createTierRow(tier));
  }
}

/**
 * Mengambil isi form mentah agar kolom kosong tidak berubah menjadi angka nol.
 * @returns {{taxPercent: string, tiers: Array<{minSubtotal: string, ratePercent: string}>}}
 *          Nilai teks dari form.
 */
function readFormInput() {
  const tiers = [];
  for (const row of discountTiersBody.querySelectorAll("tr")) {
    const inputs = row.querySelectorAll("input");
    tiers.push({
      minSubtotal: inputs[0].value,
      ratePercent: inputs[1].value,
    });
  }
  return { taxPercent: taxPercentInput.value, tiers };
}

/**
 * Memasang nilai persen dari respons server ke form.
 * @param {{tax_percent: number, discount_tiers: Array<{min_subtotal: number, rate_percent: number}>}} data
 *        Pengaturan dari API.
 * @returns {void}
 * @throws {Error} Jika bentuk respons server tidak sesuai.
 */
function setFormSettings(data) {
  if (
    !data ||
    typeof data.tax_percent !== "number" ||
    !Array.isArray(data.discount_tiers)
  ) {
    throw new Error("Respons pengaturan dari server tidak valid.");
  }

  taxPercentInput.value = String(data.tax_percent);
  renderTierRows(data.discount_tiers);
}

/**
 * Memuat pengaturan aktif dari backend.
 * @returns {Promise<void>}
 */
async function loadSettings() {
  setAlert(settingsAlert, "");
  settingsLoading.hidden = false;
  settingsPanel.hidden = true;

  try {
    const data = await apiFetch("/settings");
    setFormSettings(data);
    settingsLoading.hidden = true;
    settingsPanel.hidden = false;
  } catch (error) {
    settingsLoading.hidden = true;
    if (error.status === 401) return;
    const message = error.status === 403
      ? "Hanya admin yang boleh membuka pengaturan."
      : error.message || "Gagal memuat pengaturan.";
    setAlert(settingsAlert, message);
  }
}

/**
 * Menambahkan baris tier kosong tanpa mengubah urutan baris lain.
 * @returns {void}
 */
function addTierRow() {
  const row = createTierRow();
  discountTiersBody.appendChild(row);
  row.querySelector("input").focus();
}

/**
 * Menghapus baris tier yang tombol Hapus-nya dipilih.
 * @param {MouseEvent} event - Event klik pada tabel tier.
 * @returns {void}
 */
function removeTierRow(event) {
  const button = event.target.closest("button[data-remove-tier]");
  if (!button) return;
  button.closest("tr").remove();
}

/**
 * Memvalidasi dan menyimpan form dengan angka persen apa adanya.
 * @param {SubmitEvent} event - Event submit form.
 * @returns {Promise<void>}
 */
async function submitSettings(event) {
  event.preventDefault();
  if (isSaving) return;

  setAlert(settingsAlert, "");
  const input = readFormInput();
  const errors = validateSettingsInput(input);
  if (errors.length > 0) {
    setAlert(settingsAlert, errors.join("\n"));
    return;
  }

  const payload = {
    tax_percent: Number(input.taxPercent.trim()),
    discount_tiers: [],
  };
  for (const tier of input.tiers) {
    payload.discount_tiers.push({
      min_subtotal: Number(tier.minSubtotal.trim()),
      rate_percent: Number(tier.ratePercent.trim()),
    });
  }

  isSaving = true;
  setButtonLoading(saveSettingsButton, true, "Menyimpan...");
  try {
    const savedSettings = await apiFetch("/settings", {
      method: "PUT",
      body: payload,
    });
    setFormSettings(savedSettings);
    setAlert(settingsAlert, "Pengaturan berhasil disimpan.", "success");
  } catch (error) {
    if (error.status === 401) return;
    const message = error.status === 403
      ? "Hanya admin yang boleh mengubah pengaturan."
      : error.message || "Gagal menyimpan pengaturan.";
    setAlert(settingsAlert, message);
  } finally {
    isSaving = false;
    setButtonLoading(saveSettingsButton, false);
  }
}

/**
 * Memastikan halaman hanya dibuka pengguna login berrole admin.
 * @returns {void}
 */
function initSettingsPage() {
  if (!requireAuth()) return;
  if (!isAdmin()) {
    goToDashboard();
    return;
  }

  settingsPage.hidden = false;
  settingsForm.addEventListener("submit", submitSettings);
  addTierButton.addEventListener("click", addTierRow);
  discountTiersBody.addEventListener("click", removeTierRow);
  loadSettings();
}

initSettingsPage();
