# Laporan & Panduan Pengujian Manual KertasStruk

Dokumen ini memuat skenario uji manual, hasil pengujian, serta laporan jujur terkait batasan lingkungan pengujian.

---

## 1. Daftar Kasus Uji & Hasil Verifikasi

### Uji 1: Alur Utama dalam 3 Ketukan
- **Skenario:** Buka `/app/`, ketuk 1 chip menu (misal: "Kue Sus"), ketuk tombol "Simpan Struk", ketuk "Kirim WA".
- **Ekspektasi:** Struk tersimpan, modal pratinjau terbuka instan, tautan WhatsApp langsung terbuat dan membuka chat.
- **Hasil:** **LULUS**. Keranjang langsung menghitung total Rp 15.000, nomor struk berurutan harian terbentuk otomatis (`STR-YYYYMMDD-001`), dan omzet harian bertambah saat tombol Simpan ditekan.

### Uji 2: Kalkulasi Presisi (Qty > 1, Diskon, Item Manual)
- **Skenario:**
  - Tambah Brownies (Rp 45.000) x 2 = Rp 90.000.
  - Tambah Item Manual: "Ongkir Kilat" (Rp 15.000) x 1.
  - Subtotal = Rp 105.000.
  - Masukkan Diskon = Rp 10.000.
  - Masukkan Diskon ekstrem (Rp 200.000) yang melebihi subtotal.
- **Ekspektasi:**
  - Subtotal Rp 105.000.
  - Diskon Rp 10.000 menghasilkan Grand Total Rp 95.000.
  - Diskon ekstrem dibatasi maksimal Rp 105.000 sehingga Grand Total Rp 0 (tidak pernah negatif).
  - Tidak ada angka desimal/koma mengambang (float artifact).
- **Hasil:** **LULUS**. Semua perhitungan dilakukan menggunakan integer Rupiah murni dengan `Math.round` dan `Intl.NumberFormat`.

### Uji 3: Uji Ketahanan Karakter Ekstrem & Keamanan XSS
- **Skenario:**
  - Nama barang: `<script>alert('xss')</script> & Kue Tart 100% #1 🍰 (Pita Merah-Kuning-Hijau) Dengan Nama Sangat Panjang Melebihi Delapan Puluh Karakter Untuk Menguji Word Wrapping Pada Kanvas Struk Termal`.
  - Catatan: `Kirim jam 14:00 & jangan dibanting #urgent`.
- **Ekspektasi:**
  - Di layar UI: Karakter HTML dieksekusi sebagai teks biasa (tersanitasi, tidak muncul pop-up alert XSS).
  - Di WhatsApp: Teks ter-encode sempurna (`%26`, `%23`, `%25`, emoji utuh).
  - Di Canvas 2D (PNG): Teks panjang dibungkus per baris (word-wrapped) secara rapi tanpa keluar dari batas kertas atau menimpa harga.
  - Di PDF (@media print): Teks tercetak rapi sesuai ukuran kertas termal.
- **Hasil:** **LULUS**. Logika `escapeHtml()` mencegah injeksi tag, `wrapText()` memecah teks pada batas lebar canvas, dan `encodeURIComponent()` mengamankan seluruh string payload URL WhatsApp.

### Uji 4: Reload Halaman & Mode Offline (PWA)
- **Skenario:** Simpan struk, isi katalog baru, lalu muat ulang (F5 / reload browser). Matikan jaringan dan buka aplikasi.
- **Ekspektasi:** Data tidak hilang karena tersimpan di `localStorage` lewat `storage.js`. Berkas HTML/CSS/JS disajikan oleh Service Worker dari Cache Storage saat offline.
- **Hasil:** **LULUS**. Data lokal persisten. `manifest.webmanifest` dan `sw.js` terpasang.

### Uji 5: Ekspor dan Impor Cadangan JSON
- **Skenario:**
  - Buka tab Pengaturan -> Unduh Cadangan JSON.
  - Periksa file JSON yang terunduh: memiliki `schemaVersion: 1`, `settings`, `catalog`, dan `receipts`.
  - Unggah kembali file JSON tersebut.
  - Coba unggah file teks rusak / file gambar sembarang.
- **Ekspektasi:**
  - File valid menampilkan ringkasan data sebelum konfirmasi timpa.
  - File rusak/tidak valid ditolak dengan pesan galat ramah.
- **Hasil:** **LULUS**. Fungsi `validateImportPayload()` memvalidasi struktur data dan menolak file cacat.

### Uji 6: Pergantian Hari & Omzet Harian
- **Skenario:**
  - Simpan transaksi hari ini (misal total Rp 75.000).
  - Cek omzet hari ini = Rp 75.000.
  - Detektor tanggal mendeteksi hari berganti (misal lewat jam 00:00).
- **Ekspektasi:** Angka "Total Pemasukan Hari Ini" otomatis kembali ke Rp 0, sementara riwayat transaksi kemarin tetap utuh di grup "Kemarin".
- **Hasil:** **LULUS**. Perhitungan omzet dihitung deterministik saat query struk berjalan, bukan disimpan sebagai variabel statis terpisah yang rentan corrupt.

### Uji 7: Pembatalan Struk (Void)
- **Skenario:**
  - Simpan transaksi Rp 50.000.
  - Omzet hari ini bertambah Rp 50.000.
  - Buka struk dari riwayat, tekan "Batalkan Struk Ini (Void)".
- **Ekspektasi:**
  - Muncul konfirmasi.
  - Omzet hari ini berkurang Rp 50.000.
  - Struk tetap ada di riwayat dengan label `BATAL (VOID)` dan garis merah.
  - Tombol batalkan di modal hilang (tidak bisa void dua kali).
- **Hasil:** **LULUS**.

### Uji 8: Responsivitas & Aksesibilitas
- **Skenario:**
  - Tampilan di viewport 360px (lebar layar smartphone kecil).
  - Tampilan di viewport 1280px (laptop/desktop).
  - Navigasi menggunakan keyboard (Tab, Shift+Tab, Enter).
- **Ekspektasi:**
  - Tidak ada scrollbar horizontal di 360px.
  - Seluruh tombol dan kontrol form memiliki tinggi minimal 44px (touch target WCAG).
  - Focus visible jelas dengan garis putus-putus (`outline: 2px dashed`).
- **Hasil:** **LULUS**. Desain mobile-first terpusat dengan container max-width 640px di layar lebar.

### Uji 9: Cetak / Simpan PDF Termal Bersih (Tanpa Elemen UI)
- **Skenario:**
  - Buka pratinjau struk -> klik tombol "Cetak / PDF" (`window.print()`).
  - Periksa pratinjau cetak printer thermal / Simpan sebagai PDF.
- **Ekspektasi:**
  - HANYA kertas struk (`#rendered-receipt-paper`) yang tercetak.
  - Elemen UI seperti form input nomor WhatsApp, tombol-tombol aksi modal, tombol Void, navigasi tab, header aplikasi, dan modal katalog yang sedang tersembunyi tidak boleh ikut tercetak.
  - Ukuran kertas termal sempit (lebar 80mm/58mm auto).
- **Hasil:** **LULUS**. Selektor cetak spesifik menonaktifkan seluruh elemen UI dan hanya merender kertas struk putih bersih dengan tinta hitam tajam.

### Uji 10: Penambahan Logo & Watermark Toko
- **Skenario:**
  - Masuk ke tab Pengaturan -> Pilih Logo Toko (format PNG/JPG).
  - Pilih mode penempatan: "Atas Struk", "Watermark", atau "Keduanya".
  - Simpan Pengaturan.
  - Buat atau buka struk di Pratinjau, unduh Foto (PNG), dan Cetak / PDF.
- **Ekspektasi:**
  - Logo otomatis terkompresi secara optimal (< 25 KB) di memori lokal.
  - Di layar pratinjau: Logo muncul di header atas dan/atau watermark transparan (~8%) di tengah kertas.
  - Di cetak / PDF: Logo & watermark tercetak tajam dengan penyesuaian skala hitam-putih.
  - Di foto PNG: Logo & watermark dirender tajam oleh Canvas 2D.
- **Hasil:** **LULUS**. Gambar terkompresi mulus, tersimpan persisten di `localStorage`, dan otomatis terikut dalam file ekspor cadangan JSON.

---

## 2. Laporan Kejujuran: Batasan Pengujian yang Tidak Dapat Diuji di Lingkungan Ini

Secara jujur kami laporkan beberapa hal yang tidak dapat diuji secara fisik dalam lingkungan mesin ini:
1. **Perangkat HP Fisik Sebenarnya:** Kami menguji simulasi viewport mobile (360px), namun feel ketukan jari pada layar sentuh fisik Android murah (low-end device) belum diuji di tangan pengguna asli.
2. **Koneksi Aplikasi WhatsApp Asli:** Tautan `https://wa.me/...` terverifikasi menghasilkan format URI yang valid dan aman, namun interaksi saat sistem operasi Android mengalihkan URI scheme ke aplikasi WhatsApp native (deep link handling) bergantung pada aplikasi WhatsApp yang terpasang di HP pengguna.
3. **Printer Thermal Bluetooth Fisik (ESC/POS):** Fitur cetak menggunakan driver cetak browser bawaan (`window.print()` dengan ukuran kertas 58mm/80mm). Beberapa printer bluetooth portabel di Android memerlukan driver printer service atau raw BT printer app.
