# POS Kasir Restoran UKK

Aplikasi point of sale (POS) sederhana untuk mengelola produk, memproses transaksi, dan melihat riwayat penjualan. Backend menyediakan API; frontend menggunakan HTML, CSS, dan JavaScript tanpa framework.

## Tech stack

- Node.js dengan CommonJS
- Express 5
- SQLite melalui `better-sqlite3`
- JWT untuk autentikasi dan bcrypt untuk hash password
- Multer untuk unggah gambar produk
- Jest untuk test backend
- HTML, CSS, dan JavaScript native untuk frontend

## Menjalankan aplikasi

### Backend

Pastikan dependensi backend sudah terpasang dan `JWT_SECRET` sudah diatur di file `.env`. Backend membaca file tersebut saat dijalankan.

```powershell
Set-Location C:\project\ukk-pos\be
npm install
npm start
```

Secara default, API tersedia di `http://localhost:3000/api`.

### Frontend

Buka terminal PowerShell lain:

```powershell
Set-Location C:\project\ukk-pos\fe
npm start
```

Frontend tersedia di `http://localhost:5500`. Halaman awal setelah login adalah `http://localhost:5500/pages/dashboard`; halaman pengaturan ada di `http://localhost:5500/pages/settings`.

### Menjalankan test

```powershell
Set-Location C:\project\ukk-pos\be
npm test
```

## Akun awal

Akun berikut dibuat saat tabel pengguna masih kosong:

| Username | Role |
|---|---|
| `admin` | Admin |
| `kasir` | Kasir |

## Struktur folder

```text
be/
  src/
    middleware/   Middleware autentikasi, akses, dan penanganan error
    routes/       Endpoint API
    services/     Logika kalkulasi, pengaturan, transaksi, dan laporan
    db.js         Skema, migrasi, dan data awal database
    app.js        Konfigurasi dan pemasangan aplikasi Express
  tests/          Test Jest backend
fe/
  css/            Gaya tampilan
  js/             Logika halaman frontend
  pages/          Halaman HTML
  serve.json      Rewrite URL frontend
```

## Aturan transaksi

Urutan perhitungan adalah **subtotal → diskon → pajak → total**. Diskon dipilih berdasarkan tier subtotal terbesar yang sudah tercapai, lalu pajak dihitung dari subtotal setelah diskon. Nilai diskon dan pajak dibulatkan dengan `Math.round`.

Pengaturan awal yang di-seed adalah pajak 10%, diskon 5% mulai subtotal Rp20.000, 10% mulai Rp50.000, dan 15% mulai Rp100.000.

Contoh dengan pengaturan awal untuk subtotal **Rp58.000**:

1. Subtotal Rp58.000 mencapai tier Rp50.000 dengan diskon 10%: **Rp5.800**.
2. Dasar pajak: Rp58.000 − Rp5.800 = **Rp52.200**.
3. Pajak 10% dari Rp52.200: **Rp5.220**.
4. Total: Rp52.200 + Rp5.220 = **Rp57.420**.

## Pengaturan pajak dan diskon

Halaman **Pengaturan** hanya tersedia untuk admin; endpoint API juga membatasi akses ke role admin. Admin dapat mengubah persentase pajak dan menambah, mengubah, menghapus, atau mengosongkan tier diskon. Daftar tier kosong berarti tidak ada diskon.

Pengaturan yang disimpan berlaku untuk transaksi berikutnya. Transaksi menyimpan tarif yang dipakai saat dibuat, sehingga perubahan pengaturan tidak menghitung ulang nominal atau tarif transaksi lama.
