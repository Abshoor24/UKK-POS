const detailAlert = document.getElementById("detail-alert");
const detailLoading = document.getElementById("detail-loading");
const detailContent = document.getElementById("detail-content");
const receiptArea = document.getElementById("receipt-area");
const printButton = document.getElementById("print-btn");
const backLink = document.getElementById("back-link");
const detailSubtitle = document.getElementById("detail-subtitle");

const transactionId = toPositiveInt(getQueryParam("id"));

/**
 * Memuat detail transaksi dan menampilkan struk pada halaman.
 * @returns {Promise<void>}
 */
async function loadTransactionDetail() {
  setAlert(detailAlert, "");
  detailLoading.hidden = false;
  detailContent.hidden = true;
  printButton.hidden = true;

  if (transactionId === null) {
    detailLoading.hidden = true;
    setAlert(detailAlert, "ID transaksi pada URL tidak valid.");
    return;
  }

  backLink.href = "transactions.html";

  try {
    const transaction = await apiFetch(`/transactions/${transactionId}`);
    mountReceipt(receiptArea, transaction);
    detailSubtitle.textContent = `Struk transaksi #${transaction.id}.`;
    document.title = `Transaksi #${transaction.id} - POS UKK`;
    detailLoading.hidden = true;
    detailContent.hidden = false;
    printButton.hidden = false;
  } catch (error) {
    detailLoading.hidden = true;
    setAlert(detailAlert, error.message || "Gagal memuat detail transaksi.");
  }
}

printButton.addEventListener("click", printReceipt);
loadTransactionDetail();
