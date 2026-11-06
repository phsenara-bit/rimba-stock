# 📱 Rimba Alam - Mobile Stock App

Aplikasi manajemen stok harian restoran **Rimba Alam** yang didesain khusus agar **nyaman, ringan, dan ergonomis saat digunakan di HP Android maupun PC** oleh staf dapur (*kitchen*), barista (*bar*), *pastry*, dan admin/manajer.

Data katalog di dalam aplikasi ini **100% tersinkronisasi dari Google Sheets resmi**:
**"DAILY STOK IN-OUT RIMBA ALAM"** (Periode: Oktober 2026 — 441 Barang Lengkap).

---

## 🚀 Cara Menjalankan Aplikasi (Paling Mudah)

### Cara 1: Sekali Klik di Windows (Direkomendasikan untuk Klien)
Cukup **klik ganda (double click)** file:
👉 [**`JALANKAN-APLIKASI.bat`**](file:///C:/Users/kelvi/.gemini/antigravity/scratch/rimba-alam-mobile-app/JALANKAN-APLIKASI.bat)

Server lokal akan otomatis berjalan dan browser laptop akan langsung terbuka!

### Cara 2: Akses Langsung dari HP Android Staf (Via Wi-Fi Lokal)
1. Pastikan laptop server dan HP Android staf terhubung ke **jaringan Wi-Fi yang sama**.
2. Jalankan `JALANKAN-APLIKASI.bat` di laptop.
3. Di layar hitam terminal akan tertera alamat IP lokal, contoh: `http://192.168.1.15:8080/`.
4. Buka alamat tersebut di Google Chrome pada HP staf!
5. *(Opsional)* Tekan menu titik tiga (⋮) di Chrome HP lalu pilih **"Tambahkan ke Layar Utama" (Install App)** agar menjadi aplikasi mandiri di HP seperti APK asli.

---

## 🔐 Akun Login & Hak Akses

Layar login menggunakan form resmi berlogo Rimba Alam dengan input **"Masukan Username"** dan **"Masukan PIN"**:
* 👨‍💼 **Admin**: `ragil` atau `angel` (PIN: `1234`) — **Satu-satunya peran yang dapat melihat nilai uang/Rupiah**, filter riwayat per nama karyawan, mengubah harga satuan barang, menambah barang baru, serta mengekspor rekap mutasi ke CSV.
* 👩‍🍳 **Kitchen Staff**: `chef` atau `rey` (PIN: `1234`) — Input stok bahan dapur, mutasi masuk/keluar, cek sisa stok fisik. *(Tidak menampilkan informasi uang & filter karyawan)*.
* 🍸 **Bar Staff**: `barista` (PIN: `1234`) — Input mutasi stok bar, sirup, dan beans kopi. *(Tidak menampilkan informasi uang)*.
* 📦 **Gudang / Inventory**: `gudang` (PIN: `1234`) — Input penerimaan stok belanja harian. *(Tidak menampilkan informasi uang)*.
* 👑 **Super Admin**: `satian` (PIN: `1234`) — Pemilik sistem, manajemen pengguna & reset PIN seluruh karyawan. *(Tidak melakukan input transaksi stok harian & tidak muncul di filter riwayat staf)*.

---

## 🌟 Fitur & Pengamanan Sistem

1. **📦 Detail Barang & Riwayat Mutasi (Klik Nama Barang)**:
   * **Klik Nama/Kartu Barang**: Membuka popup detail lengkap:
     - Jumlah stok saat ini, akumulasi stok masuk (IN) dan keluar (OUT) per satuan.
     - **Nilai Rupiah Stok Akhir, Masuk & Keluar Total** (Khusus Admin Only).
     - Riwayat transaksi khusus barang tersebut dengan default **sejak tanggal 1 tiap bulannya**, serta dilengkapi opsi **Rentang Tanggal Custom**.
   * **Tombol `[➕ Input]` Tersendiri**: Di samping kanan setiap barang tersedia tombol input cepat untuk staf operasional yang ingin langsung mencatat mutasi tanpa membuka popup detail.

2. **🕒 Riwayat Transaksi Canggih (Rentang Tanggal & Filter Karyawan)**:
   * **Rentang Tanggal Fleksibel**: Secara default menampilkan transaksi **Hari Ini**, dengan tombol cepat: *Hari Ini*, *7 Hari*, *Bulan Ini*, dan *Semua Tanggal*.
   * **Filter Nama Karyawan (Khusus Admin Only)**: Dropdown filter staf untuk memantau siapa yang menginput transaksi. Staf non-admin tidak melihat opsi filter ini.

3. **💰 Nilai Finansial Rupiah (Khusus Admin)**:
   * **Nilai Aset Stok Fisik**: Total nilai nominal dari seluruh stok yang tersimpan di resto saat ini.
   * **Belanja (Rupiah Masuk)** & **Pemakaian (Rupiah Keluar)**.
   * Super Admin dan Staff tidak menampilkan angka uang demi menjaga kerahasiaan margin dan harga beli.

2. **🛡️ Validasi Stok Ketat (Mencegah Saldo Negatif)**:
   * Form pengeluaran (*OUT*) otomatis menolak jika jumlah keluar melebihi stok yang ada di sistem, mencegah terjadinya 19 saldo minus seperti pada data spreadsheet lama.

3. **📱 Navigasi Ergonomis Android**:
   * **Tombol Back HP**: Menekan tombol kembali di HP Android kini otomatis menutup dialog/modal yang sedang terbuka atau kembali ke Beranda (tidak langsung keluar dari aplikasi).
   * **Konfirmasi Keluar**: Menekan tombol 🚪 akan memunculkan dialog konfirmasi terlebih dahulu untuk mencegah salah pencet.

4. **⚡ Anti Transaksi Ganda (Debounce & State Jaringan)**:
   * Tombol konfirmasi otomatis dinonaktifkan (*disabled*) saat proses simpan agar staf tidak mencatat transaksi dobel saat menekan berkali-kali.
   * Dilengkapi deteksi offline/online otomatis.

5. **🔒 Pengamanan PIN & Anti Brute-Force**:
   * Sistem otomatis mengunci sementara akun jika PIN salah dimasukkan berturut-turut sebanyak 5 kali.
   * Form ganti PIN mandiri mewajibkan verifikasi PIN lama.

6. **📦 441 Barang Lengkap dengan 4 Devisi**:
   * **🍳 Kitchen** (267 bahan baku dapur & master bumbu)
   * **🍸 Bar** (117 bahan minuman, sirup Delifru, beans kopi, dsb.)
   * **🍰 Pastry** (48 bahan kue, butter, whipping cream, dsb.)
   * **Lainnya** (Bahan kemasan & pelengkap)
   * Dilengkapi pembeda devisi yang tegas (misal *Keju [KITCHEN]* vs *Keju [BAR]*).

7. **📥 Ekspor Laporan Excel / CSV**:
   * Unduh rekap stok dan riwayat mutasi dalam format CSV yang kompatibel langsung dengan Microsoft Excel.
