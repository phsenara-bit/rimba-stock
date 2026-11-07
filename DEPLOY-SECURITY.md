# Menutup akses publik ke Web App Rimba Stock

## Kenapa

URL `/exec` yang sekarang beredar di repo publik menerima **semua** permintaan tanpa
autentikasi. Terbukti bisa dibaca dari luar tanpa login:

- `?action=readSheetData` → 448 barang, nilai aset, seluruh mutasi bulan ini
- `?action=readUsers` → 6 akun staf **beserta PIN dalam teks biasa**
- `POST` → bisa menambah baris dan mengubah sel stok harian

Perbaikan: satu token rahasia yang disimpan di Apps Script (server) dan di
localStorage tiap perangkat. Token **tidak** ada di repo, jadi repo boleh tetap publik.

Token yang sudah dibuat: **`abc500a8c4bf8bf4a13e4ab9002c7731`**
Simpan seperti password. Kalau bocor, ganti Script Property `SYNC_TOKEN` + isi ulang di
semua perangkat.

## Urutan deploy (penting, jangan dibalik)

Membalik urutan = semua HP berhenti bisa simpan sampai aplikasinya diperbarui.

### 1. Upload aplikasi baru (gate belum aktif)

Ganti `index.html` di root repo dengan `index.html` hasil patch ini, lalu commit.

Yang berubah di aplikasi: ada kolom **Token Sinkronisasi** di Pengaturan, dan setiap
request ke `script.google.com` otomatis membawa token. Backend lama mengabaikan field
`token` — jadi aplikasi tetap jalan normal walau gate belum dipasang.

### 2. Isi token di semua perangkat (gate masih mati)

Di tiap HP: **Pengaturan → Token Sinkronisasi → tempel token → Simpan URL**.

Cek dengan tombol **🔌 Tes Koneksi** — harus tetap hijau.

### 3. Pasang gate di Apps Script

Buka spreadsheet → Ekstensi → Apps Script:

1. Rename dua fungsi yang sudah ada (isinya jangan diubah):
   - `function doGet(e)` → `function _realDoGet(e)`
   - `function doPost(e)` → `function _realDoPost(e)`
2. Tempel seluruh isi `Rimba-Alam-Web/security-gate.gs` di paling atas file.
3. **Project Settings → Script Properties** → tambah:
   - `SYNC_TOKEN` = `abc500a8c4bf8bf4a13e4ab9002c7731`
4. **Deploy → Manage deployments → ikon pensil → Version: New version → Deploy.**
   Jangan "New deployment" — URL berubah dan semua HP harus diisi ulang.

### 4. Verifikasi

Dari terminal / browser mana pun, tanpa token harus gagal:

```
curl -sL "https://script.google.com/macros/s/AKfycbzBz8xPOywwBcj00C5qYlPCl23p_0WiS9oNDXybzu4RiaOrByhcWmXj8o3eHnlXzZlA/exec?action=readUsers"
# {"success":false,"code":"UNAUTHORIZED","message":"Token sinkronisasi tidak dikirim..."}
```

Di aplikasi, simpan satu transaksi lalu cek baris baru di tab `MUTASI_APP`.

Kalau langkah 3 dieksekusi tapi langkah 1–2 belum, aplikasi akan menampilkan "terkirim"
padahal ditolak Google (karena `no-cors` tidak bisa membaca balasan). Bukti sebenarnya
ada di tab `MUTASI_APP`.

## Yang belum diperbaiki (rekomendasi lanjutan)

1. **PIN masih dikirim ke browser.** `readUsers` mengembalikan `pin` apa adanya. Selama
   token dijaga, ini setara password internal — tapi idealnya PIN di-hash dan
   diverifikasi di server, bukan di JS.
2. **`no-cors` masih dipakai saat menulis.** Aplikasi tidak bisa membedakan "berhasil"
   dan "ditolak". Pindah ke Netlify/Cloudflare Pages (repo sudah punya `netlify.toml`)
   lalu pakai function `/api/sync-gas` yang sudah dicoba lebih dulu oleh kode:
   di sana token bisa disimpan server-side, dan balasan JSON bisa dibaca.
3. **Sumber kode backend tidak ada di repo.** `Rimba-Alam-Web/google-apps-script-sync.js`
   sudah ketinggalan (belum punya `readSheetData`/`readUsers`). Simpan salinan `Code.gs`
   yang asli ke repo supaya bisa dilacak.
4. **Dua salinan frontend.** `index.html` di root (yang live) vs `Rimba-Alam-Web/`
   (stale, `js/*` 404 di domain). Pilih satu; sisanya hapus.
5. `assetlinks.json` 404 → verifikasi APK/TWA gagal kalau nanti dibungkus APK.
6. Cocokkan nama barang persis (bukan `includes`) supaya transaksi tidak masuk baris lain.
