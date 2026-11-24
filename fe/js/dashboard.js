const refreshButton = document.getElementById("refresh-btn");
const subtitle = document.getElementById("dashboard-subtitle");
const summaryError = document.getElementById("summary-error");
const summaryLoading = document.getElementById("summary-loading");
const statTransactions = document.getElementById("stat-transactions");
const statRevenue = document.getElementById("stat-revenue");
const statProducts = document.getElementById("stat-products");
const statAverage = document.getElementById("stat-average");
const lowStockLoading = document.getElementById("low-stock-loading");
const lowStockError = document.getElementById("low-stock-error");
const lowStockEmpty = document.getElementById("low-stock-empty");
const lowStockWrap = document.getElementById("low-stock-wrap");
const lowStockBody = document.getElementById("low-stock-body");
const revenueTitle = document.getElementById("revenue-title");
const revenueSubtitle = document.getElementById("revenue-subtitle");
const revenueLoading = document.getElementById("revenue-loading");
const revenueError = document.getElementById("revenue-error");
const revenueEmpty = document.getElementById("revenue-empty");
const revenueSummary = document.getElementById("revenue-summary");
const revenueChart = document.getElementById("revenue-chart");
const revenueNote = document.getElementById("revenue-note");
const stockLoading = document.getElementById("stock-loading");
const stockError = document.getElementById("stock-error");
const stockEmpty = document.getElementById("stock-empty");
const stockSummary = document.getElementById("stock-summary");
const stockChart = document.getElementById("stock-chart");
const chartTooltip = document.getElementById("chart-tooltip");
let revenueRows = [];
let revenueSeries = [];
let revenueDays = 7;

/**
 * Mengubah tanggal lokal menjadi kunci YYYY-MM-DD tanpa konversi UTC.
 * @param {Date} date - Tanggal lokal.
 * @returns {string} Kunci tanggal lokal.
 */
function localDateKey(date) {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Membuat daftar tanggal lokal berurutan yang berakhir pada hari ini.
 * @param {number} days - Jumlah hari yang disertakan.
 * @param {Date} [anchor=new Date()] - Tanggal lokal acuan untuk pengujian.
 * @returns {string[]} Daftar kunci tanggal lokal dari yang tertua.
 */
function createDateRange(days, anchor = new Date()) {
  const dates = [];
  const end = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    date.setDate(date.getDate() - offset);
    dates.push(localDateKey(date));
  }
  return dates;
}

/**
 * Mengelompokkan transaksi berdasarkan tanggal lokal dan menjumlahkan total backend.
 * @param {Array<{created_at: string, total: number}>} rows - Transaksi dari API.
 * @returns {Map<string, number>} Total pendapatan per kunci tanggal lokal.
 */
function groupTransactionsByDay(rows) {
  const totals = new Map();
  for (const transaction of rows) {
    const date = parseApiDate(transaction.created_at);
    if (!date) continue;
    const key = localDateKey(date);
    totals.set(key, (totals.get(key) || 0) + Number(transaction.total || 0));
  }
  return totals;
}

/**
 * Membentuk deret harian serta menandai cakupan data yang mungkin terpotong.
 * @param {Array<{created_at: string, total: number}>} rows - Transaksi dari API.
 * @param {string[]} dates - Tanggal lokal yang akan ditampilkan.
 * @param {boolean} truncated - True jika jumlah respons mencapai limit API.
 * @returns {Array<{date: string, value: number|null, status: string}>} Nilai dan status per hari.
 */
function buildDailySeries(rows, dates, truncated) {
  const totals = groupTransactionsByDay(rows);
  const validDates = rows
    .map((transaction) => {
      const date = parseApiDate(transaction.created_at);
      return date ? localDateKey(date) : null;
    })
    .filter(Boolean)
    .sort();
  const oldestDate = validDates[0] || null;

  return dates.map((date) => {
    if (truncated && oldestDate && date < oldestDate) {
      return { date, value: null, status: "unavailable" };
    }
    if (truncated && oldestDate && date === oldestDate) {
      return { date, value: totals.get(date) || 0, status: "partial" };
    }
    return { date, value: totals.get(date) || 0, status: "complete" };
  });
}

/**
 * Menghitung batas dan interval sumbu yang dibulatkan ke angka rapi.
 * @param {number} maximumValue - Nilai maksimum pada data.
 * @param {number} [targetTicks=4] - Perkiraan jumlah interval sumbu.
 * @returns {{maximum: number, step: number, ticks: number[]}} Skala dan nilai label sumbu.
 */
function calculateAxisScale(maximumValue, targetTicks = 4) {
  const maximum = Math.max(0, Number(maximumValue) || 0);
  if (maximum === 0) return { maximum: 1, step: 1, ticks: [0, 1] };

  const roughStep = maximum / Math.max(1, targetTicks);
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const niceFactor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = niceFactor * magnitude;
  const axisMaximum = Math.ceil(maximum / step) * step;
  const ticks = [];
  for (let value = 0; value <= axisMaximum; value += step) {
    ticks.push(Math.round(value * 1000000) / 1000000);
  }
  return { maximum: axisMaximum, step, ticks };
}

/**
 * Menjumlahkan stok per kategori dan meringkas kategori di luar delapan bar.
 * @param {Array<{category: string, stock: number}>} products - Produk aktif dari API.
 * @param {number} [maximumBars=8] - Jumlah bar maksimal termasuk "Lainnya".
 * @returns {Array<{category: string, stock: number}>} Kategori terurut dari stok terbesar.
 */
function groupStockByCategory(products, maximumBars = 8) {
  const totals = new Map();
  for (const product of products) {
    const category = String(product.category || "Tanpa kategori");
    totals.set(category, (totals.get(category) || 0) + Number(product.stock || 0));
  }
  const sorted = [...totals].map(([category, stock]) => ({ category, stock }))
    .sort((left, right) => right.stock - left.stock || left.category.localeCompare(right.category, "id"));
  if (sorted.length <= maximumBars) return sorted;

  const visibleCount = Math.max(0, maximumBars - 1);
  const visible = sorted.slice(0, visibleCount);
  const remaining = sorted.slice(visibleCount).reduce((sum, item) => sum + item.stock, 0);
  visible.push({ category: "Lainnya", stock: remaining });
  return visible;
}

/**
 * Membuat elemen SVG dan menetapkan atribut serta teks dengan API DOM aman.
 * @param {string} name - Nama elemen SVG.
 * @param {Object<string, string|number>} [attributes={}] - Atribut SVG.
 * @param {string|number} [text] - Teks yang akan ditampilkan.
 * @returns {SVGElement} Elemen SVG yang dibuat.
 */
function createSvgElement(name, attributes = {}, text) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attributes)) {
    node.setAttribute(key, String(value));
  }
  if (text !== undefined) node.textContent = String(text);
  return node;
}

/**
 * Membuat label tanggal singkat berdasarkan komponen kalender lokal.
 * @param {string} key - Tanggal YYYY-MM-DD.
 * @param {Object} [options={}] - Opsi format Intl.
 * @returns {string} Label tanggal lokal.
 */
function formatDayLabel(key, options = { month: "2-digit", day: "2-digit" }) {
  const [year, month, day] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", options)
    .format(new Date(year, month - 1, day));
}

/**
 * Memotong label panjang untuk ruang sumbu tanpa mengubah tooltip nama lengkap.
 * @param {string} label - Label kategori asli.
 * @param {number} [maximumLength=15] - Panjang maksimal sebelum elipsis.
 * @returns {string} Label pendek atau label asli.
 */
function truncateChartLabel(label, maximumLength = 15) {
  return label.length > maximumLength
    ? `${label.slice(0, maximumLength - 1)}…`
    : label;
}

/**
 * Menampilkan teks role pada ringkasan dan judul tren pendapatan.
 * @returns {void}
 */
function updateRoleText() {
  const audience = isAdmin() ? "semua kasir" : "transaksi Anda";
  subtitle.textContent = isAdmin()
    ? "Ringkasan penjualan hari ini dari semua kasir."
    : "Ringkasan penjualan hari ini untuk transaksi Anda.";
  revenueTitle.textContent = `Tren pendapatan — ${audience}`;
}

/**
 * Menampilkan produk stok rendah dengan teks aman dan tautan pencarian produk.
 * @param {Array<{name: string, stock: number}>} items - Produk stok rendah dari API.
 * @returns {void}
 */
function renderLowStock(items) {
  lowStockBody.replaceChildren();
  if (!Array.isArray(items) || items.length === 0) {
    lowStockLoading.hidden = true;
    lowStockWrap.hidden = true;
    lowStockEmpty.hidden = false;
    return;
  }

  for (const product of items) {
    const row = document.createElement("tr");
    const nameCell = createEl("td", "", product.name);
    const stockCell = createEl("td", "num");
    stockCell.appendChild(createEl(
      "span",
      product.stock === 0 ? "badge badge--danger" : "badge badge--warning",
      product.stock
    ));
    const actionCell = createEl("td", "actions");
    const link = createEl("a", "btn btn--ghost btn--small dashboard-low-stock-action", "Cari produk");
    link.href = `products?q=${encodeURIComponent(product.name)}`;
    actionCell.appendChild(link);
    row.append(nameCell, stockCell, actionCell);
    lowStockBody.appendChild(row);
  }

  lowStockLoading.hidden = true;
  lowStockError.hidden = true;
  lowStockEmpty.hidden = true;
  lowStockWrap.hidden = false;
}

/**
 * Menyusun tooltip teks untuk satu bar pendapatan.
 * @param {{date: string, value: number|null, status: string}} point - Titik harian.
 * @returns {string} Keterangan tanggal, nilai, dan kelengkapan data.
 */
function revenueTooltip(point) {
  const status = point.status === "partial"
    ? " (mungkin tidak lengkap)"
    : point.status === "unavailable" ? " (tidak ada data)" : "";
  const value = point.value === null ? "Tidak ada data" : formatRupiah(point.value);
  return `${formatDayLabel(point.date, { dateStyle: "long" })}: ${value}${status}`;
}

/**
 * Menggambar grafik batang pendapatan harian dengan SVG dan label aksesibel.
 * @param {Array<{date: string, value: number|null, status: string}>} series - Data harian.
 * @param {number} days - Jumlah hari yang ditampilkan.
 * @returns {void}
 */
function renderRevenueChart(series, days) {
  const shown = series.slice(-days);
  const knownValues = shown.filter((point) => point.value !== null).map((point) => point.value);
  const highest = Math.max(0, ...knownValues);
  const peak = shown.find((point) => point.value === highest && point.value !== null);
  const audience = isAdmin() ? "semua kasir" : "transaksi Anda";
  const periodLabel = `${days} hari terakhir`;
  revenueSubtitle.textContent = `Data ${audience} • ${periodLabel}`;
  revenueSummary.textContent = peak
    ? `Pendapatan ${periodLabel} (${audience}), tertinggi ${formatRupiah(highest)} pada ${formatDayLabel(peak.date, { dateStyle: "long" })}.`
    : `Tidak ada transaksi ${audience} pada ${periodLabel}.`;
  revenueSummary.hidden = false;
  revenueNote.hidden = true;
  revenueChart.replaceChildren();

  const svg = createSvgElement("svg", {
    viewBox: "0 0 720 300",
    role: "img",
    "aria-label": `Grafik batang pendapatan ${periodLabel} untuk ${audience}`,
    class: "dashboard-chart dashboard-chart--revenue",
    preserveAspectRatio: "xMidYMid meet",
  });
  const left = 118;
  const top = 18;
  const plotWidth = 586;
  const plotHeight = 218;
  const scale = calculateAxisScale(highest, 4);
  const tickLabelSize = 11;

  for (const tick of scale.ticks) {
    const y = top + plotHeight - (tick / scale.maximum) * plotHeight;
    svg.appendChild(createSvgElement("line", {
      x1: left, y1: y, x2: left + plotWidth, y2: y, class: "chart-gridline",
    }));
    svg.appendChild(createSvgElement("text", {
      x: left - 9, y: y + 4, "text-anchor": "end", class: "chart-axis-label",
      "font-size": tickLabelSize,
    }, formatRupiah(tick)));
  }

  const slot = plotWidth / Math.max(1, shown.length);
  const barWidth = Math.max(5, Math.min(28, slot * 0.62));
  shown.forEach((point, index) => {
    const center = left + slot * (index + 0.5);
    const isUnavailable = point.status === "unavailable";
    const barHeight = point.value === null || highest === 0
      ? 0
      : (point.value / scale.maximum) * plotHeight;
    const bar = createSvgElement("rect", {
      x: center - barWidth / 2,
      y: top + plotHeight - barHeight,
      width: barWidth,
      height: isUnavailable ? 2 : Math.max(1, barHeight),
      rx: 4,
      class: `chart-bar ${point.status === "partial" ? "chart-bar--partial" : ""} ${isUnavailable ? "chart-bar--unavailable" : ""}`,
      "data-tooltip": revenueTooltip(point),
      tabindex: "0",
    });

    if (point.status !== "unavailable" && point.status !== "partial") {
      const params = new URLSearchParams({ from: point.date, to: point.date });
      bar.setAttribute("data-href", `transactions?${params.toString()}`);
      bar.setAttribute("role", "link");
      bar.setAttribute("aria-label", `${revenueTooltip(point)}. Buka riwayat transaksi tanggal ini.`);
    } else {
      bar.setAttribute("role", "img");
      bar.setAttribute("aria-label", revenueTooltip(point));
    }
    svg.appendChild(bar);

    const labelEvery = days === 7 ? 1 : 5;
    if (index % labelEvery === 0 || index === shown.length - 1) {
      svg.appendChild(createSvgElement("text", {
        x: center, y: top + plotHeight + 20, "text-anchor": "middle",
        class: "chart-axis-label chart-date-label",
      }, formatDayLabel(point.date)));
    }
  });

  revenueChart.appendChild(svg);
  revenueChart.hidden = false;

  if (revenueRows.length === 200) {
    const oldest = shown.find((point) => point.status === "partial");
    revenueNote.textContent = oldest
      ? `Respons mencapai batas 200 transaksi. Tanggal sebelum ${formatDayLabel(oldest.date, { dateStyle: "long" })} tidak memiliki data; tanggal tersebut mungkin belum lengkap. Bar yang ditandai tidak dapat dibuka.`
      : "Respons mencapai batas 200 transaksi, sehingga data periode ini mungkin tidak lengkap.";
    revenueNote.hidden = false;
  }
}

/**
 * Menggambar grafik batang horizontal jumlah stok per kategori.
 * @param {Array<{category: string, stock: number}>} categories - Data stok terkelompok.
 * @returns {void}
 */
function renderStockChart(categories) {
  const highest = Math.max(0, ...categories.map((item) => item.stock));
  const peak = categories.find((item) => item.stock === highest);
  stockSummary.textContent = peak
    ? `Stok terbanyak: ${peak.category}, ${peak.stock} unit.`
    : "Belum ada stok produk aktif.";
  stockSummary.hidden = false;
  stockChart.replaceChildren();

  const rowHeight = 36;
  const svgHeight = Math.max(100, 54 + categories.length * rowHeight);
  const svg = createSvgElement("svg", {
    viewBox: `0 0 720 ${svgHeight}`,
    role: "img",
    "aria-label": "Grafik stok produk aktif per kategori",
    class: "dashboard-chart dashboard-chart--stock",
    preserveAspectRatio: "xMidYMid meet",
  });
  const scale = calculateAxisScale(highest, 4);
  const labelX = 8;
  const barX = 198;
  const barWidth = 420;
  const valueX = 632;
  const top = 22;

  categories.forEach((item, index) => {
    const y = top + index * rowHeight;
    const length = highest === 0 ? 0 : (item.stock / scale.maximum) * barWidth;
    const fullLabel = item.category;
    svg.appendChild(createSvgElement("text", {
      x: labelX, y: y + 15, class: "chart-axis-label chart-category-label",
      "font-size": 12,
    }, truncateChartLabel(fullLabel)));
    const bar = createSvgElement("rect", {
      x: barX, y, width: Math.max(1, length), height: 22, rx: 5,
      class: "chart-bar chart-bar--stock",
      "data-tooltip": `${fullLabel}: ${item.stock} unit`,
      tabindex: "0",
      role: "img",
      "aria-label": `${fullLabel}, ${item.stock} unit`,
    });
    svg.appendChild(bar);
    svg.appendChild(createSvgElement("text", {
      x: valueX, y: y + 15, class: "chart-value-label", "font-size": 12,
    }, String(item.stock)));
  });

  stockChart.appendChild(svg);
  stockChart.hidden = false;
}

/**
 * Menampilkan tooltip chart pada posisi elemen yang sedang diinteraksikan.
 * @param {Element} target - Bar SVG yang memiliki keterangan tooltip.
 * @returns {void}
 */
function showChartTooltip(target) {
  const message = target.getAttribute("data-tooltip");
  if (!message) return;
  chartTooltip.textContent = message;
  chartTooltip.hidden = false;
  const bounds = target.getBoundingClientRect();
  const tooltipBounds = chartTooltip.getBoundingClientRect();
  const left = Math.min(
    Math.max(8, bounds.left + bounds.width / 2 - tooltipBounds.width / 2),
    window.innerWidth - tooltipBounds.width - 8
  );
  const above = bounds.top - tooltipBounds.height - 8;
  chartTooltip.style.left = `${Math.max(8, left)}px`;
  chartTooltip.style.top = `${above >= 8 ? above : bounds.bottom + 8}px`;
}

/**
 * Menyembunyikan tooltip chart.
 * @returns {void}
 */
function hideChartTooltip() {
  chartTooltip.hidden = true;
}

/**
 * Mengembalikan bar SVG terdekat dari target event, jika tersedia.
 * @param {EventTarget|null} target - Target event DOM.
 * @returns {Element|null} Elemen bar interaktif atau null.
 */
function getChartTarget(target) {
  return target instanceof Element ? target.closest("[data-tooltip]") : null;
}

/**
 * Menampilkan tooltip saat pointer berada di atas bar chart.
 * @param {PointerEvent} event - Event pointer.
 * @returns {void}
 */
function handleChartPointerOver(event) {
  const target = getChartTarget(event.target);
  if (target) showChartTooltip(target);
}

/**
 * Menampilkan tooltip saat bar chart menerima fokus keyboard.
 * @param {FocusEvent} event - Event fokus.
 * @returns {void}
 */
function handleChartFocus(event) {
  const target = getChartTarget(event.target);
  if (target) showChartTooltip(target);
}

/**
 * Menampilkan tooltip saat pengguna mengetuk bar pada layar sentuh.
 * @param {PointerEvent} event - Event pointer.
 * @returns {void}
 */
function handleChartPointerUp(event) {
  if (event.pointerType !== "touch") return;
  const target = getChartTarget(event.target);
  if (target) showChartTooltip(target);
}

/**
 * Membuka riwayat pada tanggal bar yang dipilih.
 * @param {MouseEvent} event - Event klik chart.
 * @returns {void}
 */
function handleChartClick(event) {
  const target = getChartTarget(event.target);
  const href = target && target.getAttribute("data-href");
  if (href) window.location.href = href;
}

/**
 * Mendukung navigasi bar chart dengan Enter/Space dan menutup tooltip dengan Escape.
 * @param {KeyboardEvent} event - Event keyboard.
 * @returns {void}
 */
function handleChartKeydown(event) {
  if (event.key === "Escape") {
    hideChartTooltip();
    return;
  }
  if (event.key !== "Enter" && event.key !== " ") return;
  const target = getChartTarget(event.target);
  const href = target && target.getAttribute("data-href");
  if (href) {
    event.preventDefault();
    window.location.href = href;
  }
}

/**
 * Memuat ringkasan, tren transaksi, dan produk secara independen.
 * @returns {Promise<void>}
 */
async function loadDashboard() {
  updateRoleText();
  setAlert(summaryError, "");
  setAlert(lowStockError, "");
  setAlert(revenueError, "");
  setAlert(stockError, "");
  summaryLoading.hidden = false;
  statTransactions.textContent = "-";
  statRevenue.textContent = "-";
  statProducts.textContent = "-";
  statAverage.textContent = "-";
  lowStockLoading.hidden = false;
  lowStockWrap.hidden = true;
  lowStockEmpty.hidden = true;
  revenueLoading.hidden = false;
  revenueEmpty.hidden = true;
  revenueSummary.hidden = true;
  revenueChart.hidden = true;
  revenueNote.hidden = true;
  stockLoading.hidden = false;
  stockEmpty.hidden = true;
  stockSummary.hidden = true;
  stockChart.hidden = true;

  const dates = createDateRange(30);
  const query = new URLSearchParams({
    from: dates[0],
    to: dates[dates.length - 1],
    limit: "200",
  });
  const results = await Promise.allSettled([
    apiFetch("/dashboard"),
    apiFetch(`/transactions?${query.toString()}`),
    apiFetch("/products"),
  ]);

  const summaryResult = results[0];
  if (summaryResult.status === "fulfilled") {
    try {
      const summary = summaryResult.value;
      if (!summary || !summary.today || !Array.isArray(summary.low_stock)) {
        throw new Error("Respons ringkasan dashboard tidak valid.");
      }
      const transactionCount = Number(summary.today.transactions ?? 0);
      const revenue = Number(summary.today.revenue ?? 0);
      statTransactions.textContent = String(transactionCount);
      statRevenue.textContent = formatRupiah(revenue);
      statProducts.textContent = String(summary.active_products ?? 0);
      statAverage.textContent = transactionCount > 0
        ? formatRupiah(Math.round(revenue / transactionCount))
        : "-";
      renderLowStock(summary.low_stock);
    } catch (error) {
      const message = error.message || "Gagal memuat ringkasan.";
      setAlert(summaryError, message);
      lowStockLoading.hidden = true;
      setAlert(lowStockError, message);
    }
  } else {
    const message = summaryResult.reason && summaryResult.reason.message
      ? summaryResult.reason.message
      : "Gagal memuat ringkasan.";
    setAlert(summaryError, message);
    lowStockLoading.hidden = true;
    setAlert(lowStockError, message);
  }
  summaryLoading.hidden = true;

  const transactionsResult = results[1];
  if (transactionsResult.status === "fulfilled") {
    try {
      if (!Array.isArray(transactionsResult.value)) {
        throw new Error("Respons riwayat transaksi tidak valid.");
      }
      revenueRows = transactionsResult.value;
      revenueSeries = buildDailySeries(revenueRows, dates, revenueRows.length === 200);
      revenueLoading.hidden = true;
      if (revenueRows.length === 0) {
        revenueEmpty.textContent = `Belum ada transaksi ${isAdmin() ? "semua kasir" : "Anda"} pada 30 hari terakhir.`;
        revenueEmpty.hidden = false;
      } else {
        renderRevenueChart(revenueSeries, revenueDays);
      }
    } catch (error) {
      revenueLoading.hidden = true;
      revenueChart.hidden = true;
      revenueSummary.hidden = true;
      setAlert(revenueError, error.message || "Gagal memuat tren pendapatan.");
    }
  } else {
    revenueLoading.hidden = true;
    setAlert(
      revenueError,
      transactionsResult.reason && transactionsResult.reason.message
        ? transactionsResult.reason.message
        : "Gagal memuat tren pendapatan."
    );
  }

  const productsResult = results[2];
  if (productsResult.status === "fulfilled") {
    try {
      if (!Array.isArray(productsResult.value)) {
        throw new Error("Respons daftar produk tidak valid.");
      }
      const products = productsResult.value;
      stockLoading.hidden = true;
      if (products.length === 0) {
        stockEmpty.hidden = false;
      } else {
        renderStockChart(groupStockByCategory(products));
      }
    } catch (error) {
      stockLoading.hidden = true;
      stockChart.hidden = true;
      stockSummary.hidden = true;
      setAlert(stockError, error.message || "Gagal memuat stok per kategori.");
    }
  } else {
    stockLoading.hidden = true;
    setAlert(
      stockError,
      productsResult.reason && productsResult.reason.message
        ? productsResult.reason.message
        : "Gagal memuat stok per kategori."
    );
  }
}

/**
 * Mengubah periode tampilan tanpa mengirim request transaksi baru.
 * @param {number} days - Periode pilihan, 7 atau 30 hari.
 * @returns {void}
 */
function selectRevenuePeriod(days) {
  revenueDays = days;
  document.querySelectorAll("[data-period]").forEach((button) => {
    const selected = Number(button.dataset.period) === days;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  if (revenueRows.length > 0) renderRevenueChart(revenueSeries, revenueDays);
  else {
    const audience = isAdmin() ? "semua kasir" : "Anda";
    revenueSubtitle.textContent = `Data ${audience} • ${days} hari terakhir`;
    revenueEmpty.textContent = `Belum ada transaksi ${audience} pada ${days} hari terakhir.`;
  }
}

document.querySelectorAll("[data-period]").forEach((button) => {
  button.addEventListener("click", () => selectRevenuePeriod(Number(button.dataset.period)));
});
document.querySelectorAll(".chart-wrap").forEach((chart) => {
  chart.addEventListener("pointerover", handleChartPointerOver);
  chart.addEventListener("pointerout", (event) => {
    if (!getChartTarget(event.relatedTarget)) hideChartTooltip();
  });
  chart.addEventListener("focusin", handleChartFocus);
  chart.addEventListener("focusout", hideChartTooltip);
  chart.addEventListener("pointerup", handleChartPointerUp);
  chart.addEventListener("click", handleChartClick);
});
document.addEventListener("keydown", handleChartKeydown);
refreshButton.addEventListener("click", loadDashboard);
updateRoleText();
loadDashboard();
