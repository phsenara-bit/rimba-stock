# Rimba Stock — verifikasi PIN di server (satu file, tanpa setup per HP)

## Masalahnya

Web App `/exec` menerima semua permintaan tanpa autentikasi. Terbukti dari luar:

- `?action=readUsers` → 7 akun staf + PIN dalam teks biasa (semua `1234`)
- `?action=readSheetData` → 448 barang, nilai aset, seluruh mutasi bulan ini
- `POST` → bisa menambah baris, mengubah sel stok harian, menghapus barang, membuat akun
- PIN `admin`/`satian` (`1212`) juga tertulis di bundle publik

## Solusinya

`Code.gs` sekarang **satu file utuh**: gate + kode v3.2, sudah digabung. Tidak ada
rename manual, tidak ada file kedua.

- `doGet`/`doPost` lama sudah di-rename jadi `_realDoGet`/`_realDoPost` di dalam file
- gate di bagian atas, semua fungsi lama utuh di bagian bawah
- setiap request wajib `authUser` + `authPin` yang cocok dengan tab `DATA_PENGGUNA`
- PIN diverifikasi di server; browser hanya mengirim PIN perangkat itu sendiri
- staff yang keluar → ganti PIN-nya, akses langsung putus
- hapus user / ubah PIN orang lain → hanya Admin / Super Admin
- 10x PIN salah → akun terkunci 10 menit, per akun
- tab `DATA_PENGGUNA` tidak terbaca → tolak semua (fail closed)

Field autentikasi sengaja `authUser`/`authPin`, bukan `username`/`pin`, karena payload
`updateUserPin` memakai dua field itu untuk menunjuk karyawan lain. Kalau ditimpa,
PIN orang lain yang berubah.

## Yang berubah di aplikasi

- saat login berhasil, nama + PIN disimpan di `sessionStorage` perangkat
- semua request ke `script.google.com` otomatis membawa `authUser` + `authPin`
- logout menghapusnya; ganti PIN memperbaruinya
- kolom "Token Sinkronisasi" dibuang (tidak dipakai lagi)

## Deploy

### 0. Ganti PIN admin dulu

Semua PIN masih `1234`, dan PIN `admin`/`satian` (`1212`) tertulis di bundle publik.
Ganti minimal PIN `admin` lewat app (Pengaturan → Atur PIN) sebelum mulai.

### 1. Upload aplikasi (GitHub)

Ganti `index.html` di root repo `phsenara-bit/rimba-stock`. Server lama mengabaikan
`authUser`/`authPin`, jadi aplikasi tetap jalan normal.

Sesudah ini **semua staf logout lalu login sekali** supaya kredensial tersimpan
di perangkatnya.

### 2. Ganti Code.gs (Apps Script)

1. Spreadsheet → **Ekstensi → Apps Script**
2. Klik isi `Code.gs` → **Ctrl+A** → paste **seluruh** isi `Code.gs` baru
3. **Ctrl+S**
4. **Deploy → Manage deployments → ikon pensil → Version: New version → Deploy**
   Jangan "New deployment": URL berubah dan semua HP harus diisi ulang.

Kalau masih memakai akun owner `satian` (tidak ada di sheet), tambahkan di
Project Settings → Script Properties:
`OWNER_USERNAME=satian`, `OWNER_PIN=<PIN baru>`. Kalau kosong, `satian` tidak bisa sync.

### 3. Verifikasi

Tanpa kredensial harus ditolak:

```
curl -sL "https://script.google.com/macros/s/AKfycbzBz8xPOywwBcj00C5qYlPCl23p_0WiS9oNDXybzu4RiaOrByhcWmXj8o3eHnlXzZlA/exec?action=readUsers"
# {"success":false,"code":"UNAUTHORIZED","message":"Akses ditolak: login ulang..."}
```

Dengan kredensial harus lolos (ganti dengan PIN admin yang baru):

```
curl -sL ".../exec?action=readUsers&authUser=admin&authPin=PIN_BARU"
```

Di aplikasi: simpan satu transaksi, lalu cek baris baru di tab `MUTASI_APP`.

### 4. Rollback

Deploy → Manage deployments → Edit → pilih versi **sebelum** gate → Deploy.
Aplikasi: commit sebelumnya di GitHub.

## Batasan yang perlu diketahui

`doPost` mengirim dengan `no-cors`, jadi browser tidak bisa membaca balasan penolakan
(`UNAUTHORIZED` / `LOCKED`). Kalau staf melapor "sudah simpan tapi tidak masuk", cek
PIN-nya di tab `DATA_PENGGUNA` lalu minta login ulang. Hilang total kalau nanti pindah
ke hosting dengan function server-side (Netlify/Cloudflare).

## Sisa pekerjaan

1. `readUsers` masih mengembalikan PIN ke klien (aman selama hanya user terautentikasi
   yang bisa memanggilnya, tapi idealnya di-hash).
2. Akun backdoor `satian` (PIN `1212` di bundle publik) sebaiknya dihapus.
3. `Rimba-Alam-Web/js/*` di repo sudah basi (404 di domain). Pilih satu sumber kode.
4. Pencocokan nama barang pakai `includes` → transaksi bisa masuk baris yang salah.
5. `assetlinks.json` 404 → verifikasi APK/TWA gagal.

## Tes

```
cd ~/rimba-stock
node security-tools/test_codegs.js        # 15 cek: gate + kode v3.2 gabungan
node security-tools/test_gate_pin.js      # 20 cek: aturan gate terpisah
node security-tools/test_device_cred.js   # 17 cek: kredensial di aplikasi
```
