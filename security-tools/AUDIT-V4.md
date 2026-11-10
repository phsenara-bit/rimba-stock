# Rimba Stock — audit permukaan publik (v4)

Dijalankan **setelah** `Code.gs` v4 di-deploy. Tujuan: membuktikan dari luar bahwa
tidak ada jalur umum yang bisa membaca data atau daftar pengguna tanpa sesi.

```bash
U="https://script.google.com/macros/s/<ID-DEPLOYMENT-ANDA>/exec"
```

## 1. Route publik (tidak perlu login)

| Permintaan | Hasil yang benar | Arti kalau salah |
|---|---|---|
| `curl -s -L "$U"` | `{"status":"online","version":"4.0",...}` | gate belum naik |
| `curl -s -L "$U?action=ping"` | sama seperti di atas | — |
| `curl -s -L "$U?action=readUsers"` | `{"code":"UNAUTHORIZED"}` | **PIN bisa dibaca publik** |
| `curl -s -L "$U?action=getUsers"` | `UNAUTHORIZED` | idem |
| `curl -s -L "$U?action=readSheetData"` | `UNAUTHORIZED` | stok bisa dibaca publik |
| `curl -s -L "$U?action=getItems"` | `UNAUTHORIZED` | alias lama masih terbuka |
| `curl -s -L "$U?action=syncMonthlyData"` | `UNAUTHORIZED` | idem |
| `curl -s -L "$U?action=inspectSheets"` | `UNAUTHORIZED` | bocor isi tab user |
| `curl -s -L "$U?action=debugSheets"` | `UNAUTHORIZED` | idem |
| `curl -s -L "$U?action=askAI&q=tes"` | `UNAUTHORIZED` | asisten bisa dipakai tanpa login |
| `curl -s -L "$U?action=readUsers&authToken=asal"` | `UNAUTHORIZED` | token palsu diterima |
| `curl -s -L -X POST "$U" -d '{"action":"saveUser","username":"x","pin":"1111"}'` | `UNAUTHORIZED` | siapa pun bisa menambah akun |

## 2. Login & sesi

```bash
# PIN benar → token (PIN tidak boleh muncul di respons)
curl -s -L -X POST "$U" -d '{"action":"login","username":"ragil","pin":"<PIN-ASLI>"}'

# PIN salah ×6 → akun terkunci
for i in 1 2 3 4 5 6; do
  curl -s -L -X POST "$U" -d '{"action":"login","username":"ragil","pin":"0000"}'; echo
done
```

Yang benar:
- respons sukses berisi `token` + `user` (tanpa `pin`)
- percobaan ke-6 berbunyi `"code":"LOCKED"`
- `readUsers` dengan token itu **tidak** memuat satu pun PIN
- setelah `{"action":"logout"}` token yang sama ditolak

## 3. Otorisasi

```bash
# login sebagai staf, lalu coba aksi admin
TOKEN=<token staf>
curl -s -L -X POST "$U" -d "{\"action\":\"deleteUser\",\"username\":\"ragil\",\"authToken\":\"$TOKEN\"}"
# harus FORBIDDEN
```

## 4. Aturan selesai

Jangan menyatakan "aman" atau memberi persentase sebelum bagian 1 lulus semua
dan bagian 2–3 menunjukkan hasil yang disebut di atas. Kalau satu route masih
membalas data, perbaiki dulu — jangan dilaporkan sebagai selesai.
