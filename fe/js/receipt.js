/**
 * Pembuat struk yang dipakai halaman kasir dan detail transaksi.
 * Struk dibuat dengan createElement/textContent agar data API tidak menjadi HTML mentah.
 */

function appendMetaRow(parent, label, value) {
  const row = createEl("div", "receipt-meta-row");
  row.append(createEl("span", "", label), createEl("span", "", value));
  parent.appendChild(row);
}

/**
 * Menambahkan satu baris nominal pada bagian total struk.
 * @param {HTMLElement} parent - Elemen struk yang menerima baris.
 * @param {string} label - Label nominal yang ditampilkan.
 * @param {string} value - Nilai nominal yang ditampilkan.
 * @param {boolean} [grand=false] - Apakah baris menampilkan total utama.
 * @returns {void}
 */
function appendTotalRow(parent, label, value, grand = false) {
  const row = createEl(
    "div",
    grand ? "receipt-total-row receipt-total-row--grand" : "receipt-total-row"
  );
  row.append(createEl("span", "", label), createEl("span", "", value));
  parent.appendChild(row);
}

/**
 * @param {object} receipt - Respons POST /transactions atau GET /transactions/:id.
 * @param {{paid: number, change: number}|null} payment - Hanya tersedia di halaman kasir.
 * @returns {HTMLElement}
 */
function createReceiptPaper(receipt, payment = null) {
  const paper = createEl("div", "receipt-paper");

  const head = createEl("div", "receipt-head");
  head.appendChild(createEl("p", "receipt-store", APP_CONFIG.APP_NAME));
  head.appendChild(createEl("p", "receipt-title", "Struk Transaksi"));
  paper.appendChild(head);

  const meta = createEl("div", "receipt-meta");
  appendMetaRow(meta, "No. Transaksi", `#${receipt.id}`);
  appendMetaRow(meta, "Waktu", formatDateTime(receipt.created_at));
  appendMetaRow(meta, "Kasir", receipt.cashier || "-");
  paper.appendChild(meta);

  paper.appendChild(createEl("hr", "receipt-divider"));

  const table = createEl("table", "receipt-items");
  const tbody = document.createElement("tbody");

  const items = Array.isArray(receipt.items) ? receipt.items : [];
  for (const item of items) {
    const row = document.createElement("tr");

    const nameCell = createEl("td", "receipt-item-name");
    nameCell.appendChild(createEl("div", "", item.name || "-"));
    nameCell.appendChild(
      createEl("div", "receipt-item-qty", `${item.qty} x ${formatRupiah(item.price)}`)
    );

    const totalCell = createEl("td", "right", formatRupiah(item.line_total));

    row.append(nameCell, totalCell);
    tbody.appendChild(row);
  }

  table.appendChild(tbody);
  paper.appendChild(table);
  paper.appendChild(createEl("hr", "receipt-divider"));

  appendTotalRow(paper, "Subtotal", formatRupiah(receipt.subtotal));
  appendTotalRow(
    paper,
    formatRateLabel("Diskon", receipt.discount_rate),
    `-${formatRupiah(receipt.discount)}`
  );
  appendTotalRow(
    paper,
    formatRateLabel("Pajak", receipt.tax_rate),
    formatRupiah(receipt.tax)
  );
  appendTotalRow(paper, "Total", formatRupiah(receipt.total), true);

  if (payment && Number.isFinite(Number(payment.paid))) {
    paper.appendChild(createEl("hr", "receipt-divider"));
    appendTotalRow(paper, "Uang Diterima", formatRupiah(payment.paid));
    appendTotalRow(paper, "Kembalian", formatRupiah(payment.change));
  }

  const footer = createEl("div", "receipt-footer");
  footer.appendChild(createEl("p", "", "Terima kasih telah berbelanja."));
  footer.appendChild(createEl("p", "", APP_CONFIG.APP_NAME));
  paper.appendChild(footer);

  return paper;
}

/**
 * Memasang struk yang dibuat dari data transaksi ke dalam kontainer.
 * @param {HTMLElement|null} container - Kontainer tujuan struk.
 * @param {object} receipt - Data transaksi untuk ditampilkan.
 * @param {{paid: number, change: number}|null} [payment=null] - Data pembayaran opsional.
 * @returns {HTMLElement|null} Elemen struk yang dipasang atau null jika kontainer tidak tersedia.
 */
function mountReceipt(container, receipt, payment = null) {
  if (!container) return null;
  const paper = createReceiptPaper(receipt, payment);
  container.replaceChildren(paper);
  return paper;
}

/**
 * Membuka dialog cetak browser untuk struk yang sedang ditampilkan.
 * @returns {void}
 */
function printReceipt() {
  window.print();
}
