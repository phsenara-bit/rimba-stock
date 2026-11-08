# Rimba Stock — verifikasi PIN di server (tanpa token, tanpa setup per HP)

## Masalahnya

Web App `/exec` menerima semua permintaan tanpa autentikasi. Terbukti dari luar:

- `?action=readUsers` → 7 akun staf + PIN dalam teks biasa (semua `1234`)
- `?action=readSheetData` → 448 barang, nilai aset, seluruh mutasi bulan ini
- `POST` → bisa menambah baris, mengubah sel stok harian, menghapus barang, dan membuat akun baru
- PIN `admin`/`satian` (`1212`) juga tertulis di bundle publik

## Solusinya

Setiap request wajib membawa identitas karyawan yang terdaftar di tab `DATA_PENGGUNA`.
PIN diverifikasi **di Apps Script**, bukan di browser.

- staf tidak perlu token, tidak perlu link khusus — cukup login seperti biasa
- PIN tidak lagi dikirim sebagai daftar; perangkat hanya mengirim PIN miliknya sendiri
- staff yang keluar → ganti PIN-nya di app, akses langsung putus
- hapus user & ubah PIN orang lain → hanya Admin/Super Admin
- 10x PIN salah → akun terkunci 10 menit

Field autentikasi memakai nama `authUser` + `authPin`, **bukan** `username`/`pin`,
supaya tidak bentrok dengan payload `updateUserPin` yang memakai dua field itu
untuk menunjuk karyawan lain.

## Yang berubah di aplikasi

- saat login berhasil, nama + PIN disimpan di `sessionStorage` perangkat
- semua request ke `script.google.com` otomatis membawa `authUser` + `authPin`
- logout menghapusnya; ganti PIN memperbaruinya
- kolom "Token Sinkronisasi" dibuang (tidak dipakai lagi)

## Urutan deploy

### 0. Sebelum mulai

Semua PIN masih `1234`. Ganti dulu minimal PIN `admin` (lewat app: Pengaturan →
Atur PIN) karena PIN itu yang akan dipakai untuk verifikasi. Kalau nanti gate aktif
dan PIN di HP beda dengan yang di sheet, sync akan ditolak.

### 1. Upload aplikasi baru (server belum berubah)

Ganti `index.html` di root repo. Server lama mengabaikan `authUser`/`authPin`,
jadi aplikasi tetap jalan normal.

Sesudah ini, **semua staf logout lalu login sekali** supaya kredensial tersimpan.
Yang sudah login sebelum update belum punya kredensial tersimpan.

### 2. Pasang gate di Apps Script (butuh ±2 menit)

Buka spreadsheet → Ekstensi → Apps Script:

1. Rename dua fungsi yang sudah ada, **isinya jangan diubah**:
   - `function doGet(e)` → `function _realDoGet(e)`
   - `function doPost(e)` → `function _realDoPost(e)`
2. Tempel seluruh isi `security-gate-pin.gs` di paling atas file.
3. Deploy → **Manage deployments** → ikon pensil → Version: **New version** → Deploy.
   Jangan "New deployment": URL berubah dan semua HP harus diisi ulang.

Kalau masih memakai akun `satian` (akun ini tidak ada di sheet):
Project Settings → Script Properties → `OWNER_USERNAME=satian`, `OWNER_PIN=<PIN baru>`.
Kalau tidak diisi, `satian` tidak bisa sync — memang disengaja.

### 3. Verifikasi

Tanpa kredensial harus ditolak:

```
curl -sL "https://script.google.com/macros/s/AKfycbzBz8xPOywwBcj00C5qYlPCl23p_0WiS9oNDXybzu4RiaOrByhcWmXj8o3eHnlXzZlA/exec?action=readUsers"
# {"success":false,"code":"UNAUTHORIZED","message":"Akses ditolak: login ulang..."}
```

Dengan kredensial harus lolos (ganti PIN sesuai yang baru):

```
curl -sL ".../exec?action=readUsers&authUser=admin&authPin=PIN_BARU"
```

Di aplikasi: simpan satu transaksi, lalu cek baris baru di tab `MUTASI_APP`.

### 4. Kalau ada yang rusak

Deploy → Manage deployments → Edit → Version: pilih versi **sebelum** gate → Deploy.
Rollback aplikasi: commit sebelumnya di GitHub.

## Catatan teknis

`doPost` mengirim dengan `no-cors`, jadi browser tidak bisa membaca balasan penolakan
(termasuk `UNAUTHORIZED`/`LOCKED`). Kalau staf melapor "sudah simpan tapi tidak masuk",
cek PIN-nya di tab `DATA_PENGGUNA` dan minta login ulang. Ini akan benar-benar rapi
kalau nanti pindah ke hosting yang punya function server-side (Netlify/Cloudflare):
token/rahasia tidak perlu di klien sama sekali.

## Sisa pekerjaan (belum dikerjakan)

1. `readUsers` masih mengembalikan PIN ke klien. Aman selama hanya user terautentikasi
   yang bisa memanggilnya, tapi idealnya PIN di-hash.
2. Hapus akun backdoor `satian` dari bundle (PIN `1212` tertulis di kode publik).
3. `Rimba-Alam-Web/js/*` di repo sudah basi (404 di domain). Pilih satu sumber kode.
4. Pencocokan nama barang pakai `includes` → transaksi bisa masuk baris yang salah.
5. `assetlinks.json` 404 → verifikasi APK/TWA gagal.
