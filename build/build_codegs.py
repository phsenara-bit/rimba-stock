#!/usr/bin/env python3
"""
Bangun Code.gs dari SUMBER UTAMA: file google-apps-script-sync.js kiriman user.

Susunan hasil:
    BAGIAN 1  gate-v4.gs            (autentikasi token + otorisasi)
    BAGIAN 2  file user, doGet/doPost di-rename jadi _realDoGet/_realDoPost
              + 3 perbaikan bug tab bulanan (dijaga assert, bukan asumsi)
    BAGIAN 3  ai-section.gs         (asisten "Tanya Stok", sudah ada sebelumnya)

Jalankan: python3 build/build_codegs.py <file-user.js> [output.gs]
"""
import sys
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent

SRC = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(
    "/home/xellium/.hermes/cache/documents/doc_5ea32d856454_google-apps-script-sync.js"
)
OUT = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "Code.gs"

body = SRC.read_text(encoding="utf-8")

# ── 0. route baca berisiko tidak lagi diteruskan mentah ───────────────────
# `inspectSheets` membalas 6 baris teratas semua tab — termasuk tab
# DATA_PENGGUNA (nama + PIN). `debugSheets` aliasnya. Dimatikan total.
old_debug = """  if (action === "inspectSheets" || action === "debugSheets") {
    return handleInspectAllSheets(e);
  }"""
new_debug = """  // Dimatikan: route ini membalas isi tab termasuk DATA_PENGGUNA (PIN).
  if (action === "inspectSheets" || action === "debugSheets") {
    return createJsonResponse({ success: false, message: "Route debug sudah dinonaktifkan." });
  }"""
assert body.count(old_debug) == 1, "blok inspectSheets tidak unik"
body = body.replace(old_debug, new_debug)

# ── 1. rename titik masuk lama supaya tidak bentrok dengan gate baru ───────
for old, new in (("function doPost(e)", "function _realDoPost(e)"),
                 ("function doGet(e)", "function _realDoGet(e)")):
    assert body.count(old) == 1, f"penanda {old!r} tidak unik: {body.count(old)}"
    body = body.replace(old, new)

# ── 2. perbaikan bug tab bulanan ──────────────────────────────────────────
FIXES = []

# 2a. stok tidak boleh disuntik ke tab bulan lain
old_stock = """          insertItemAlphabetically(s, {
            name: itemName,
            division: division,
            unit: unit,
            price: price,
            stock: stock
          });
          console.log(`Menyinkronkan item baru "${itemName}" ke tab yang sudah ada: ${sName}`);"""
new_stock = """          // Tab bulan LAIN dapat baris katalog baru dengan stok awal 0.
          // Kalau stok awal ikut disalin, nilai aset bulan yang sudah lewat
          // mendadak naik padahal barangnya baru didaftarkan bulan ini.
          insertItemAlphabetically(s, {
            name: itemName,
            division: division,
            unit: unit,
            price: price,
            stock: 0
          });
          console.log(`Menyinkronkan item baru "${itemName}" ke tab yang sudah ada: ${sName} (stok awal 0)`);"""
FIXES.append(("stok tab lain", old_stock, new_stock))

# 2b. daftar bulan + helper pencocokan (bulan DAN tahun)
old_month = """  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "June",
    "July", "August", "Sep", "Okt", "Nov", "Des"
  ];
  const fullMonthNames = [
    "januari", "februari", "maret", "april", "mei", "juni",
    "juli", "agustus", "september", "oktober", "november", "desember"
  ];
  const targetPrefix = monthNames[monthNum - 1].toLowerCase();
  const fullPrefix = fullMonthNames[monthNum - 1];

  const sheets = ss.getSheets();
  
  // 1. Cek tab yang namanya mengandung bulan ini (misal "Nov", "November", "Des 2026")
  for (let s of sheets) {
    const sName = s.getName().toLowerCase();
    if (s.getName() === SHEET_LOG_NAME || s.getName() === SHEET_SPOIL_NAME) continue;
    if (sName.includes(targetPrefix) || sName.includes(fullPrefix)) {
      return s;
    }
  }"""
new_month = """  const monthNames = MONTH_SHORT;
  const fullMonthNames = [
    "januari", "februari", "maret", "april", "mei", "juni",
    "juli", "agustus", "september", "oktober", "november", "desember"
  ];

  const sheets = ss.getSheets();

  // 1. Cek tab bulan ini (bulan DAN tahun harus cocok)
  const existing = _findMonthlySheet_(ss, year, monthNum);
  if (existing) return existing;"""
FIXES.append(("pencarian tab bulan", old_month, new_month))

# 2c. tab bulan sebelumnya juga harus cocok tahun
old_prev = """  const prevPrefix = monthNames[prevMonthNum - 1].toLowerCase();
  const prevFullPrefix = fullMonthNames[prevMonthNum - 1];

  let prevSheet = null;
  // 2a. Cari tab bulan tepat sebelumnya (contoh: cari "Nov" / "November" jika sedang membuat "Des 2026")
  for (let s of sheets) {
    const sName = s.getName().toLowerCase();
    if (s.getName() === SHEET_LOG_NAME || s.getName() === SHEET_SPOIL_NAME) continue;
    if (sName.includes(prevPrefix) || sName.includes(prevFullPrefix)) {
      prevSheet = s;
      break;
    }
  }"""
new_prev = """  // 2a. Cari tab bulan tepat sebelumnya (bulan DAN tahun harus cocok)
  let prevSheet = _findMonthlySheet_(ss, prevYear, prevMonthNum);"""
FIXES.append(("tab bulan sebelumnya", old_prev, new_prev))

# 2d. tab internal tidak boleh dianggap tab bulan
old_skip = """      if (sName !== SHEET_LOG_NAME && sName !== SHEET_SPOIL_NAME && s.getLastRow() >= 14) {"""
new_skip = """      if (sName !== SHEET_LOG_NAME && sName !== SHEET_SPOIL_NAME && sName !== SHEET_USERS_NAME && s.getLastRow() >= 14) {"""
FIXES.append(("lewati tab pengguna", old_skip, new_skip))

for label, old, new in FIXES:
    assert body.count(old) == 1, f"patch '{label}' tidak ketemu/tidak unik ({body.count(old)})"
    body = body.replace(old, new)

# 2e. helper bulan disisipkan tepat sebelum getOrCreateMonthlySheet
HELPERS = '''/**
 * Alias nama bulan (Indonesia + Inggris) supaya tab "Jun 2026", "June 2026",
 * "Juni 2026" sama-sama dikenali. Sebelumnya Juni/Juli/Agustus gagal cocok
 * karena sistem hanya mencari "june"/"july"/"august".
 */
const MONTH_ALIASES = [
  ["jan", "january", "januari"],
  ["feb", "february", "februari", "pebruari"],
  ["mar", "march", "maret"],
  ["apr", "april"],
  ["mei", "may"],
  ["jun", "june", "juni"],
  ["jul", "july", "juli"],
  ["aug", "agu", "ags", "agt", "agus", "august", "agustus"],
  ["sep", "sept", "september"],
  ["okt", "oct", "october", "oktober"],
  ["nov", "november", "nopember"],
  ["des", "dec", "december", "desember"]
];

/** Nama bulan untuk tab baru, gaya yang sama dengan tab lama ("Nov 2026"). */
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
                     "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function _sheetTokens_(name) {
  return String(name || "").toLowerCase().split(/[^a-z0-9]+/).filter(function (t) { return !!t; });
}

/** 1-12 kalau nama tab memuat nama bulan, 0 kalau tidak. Dicocokkan per kata utuh. */
function _sheetMonthNum_(name) {
  const toks = _sheetTokens_(name);
  for (let i = 0; i < toks.length; i++) {
    for (let m = 0; m < 12; m++) {
      if (MONTH_ALIASES[m].indexOf(toks[i]) !== -1) return m + 1;
    }
  }
  return 0;
}

/** Tahun 4 digit di nama tab, 0 kalau tidak ada. */
function _sheetYear_(name) {
  const m = String(name || "").match(/(?:19|20)\\d{2}/);
  return m ? parseInt(m[0], 10) : 0;
}

/**
 * Cari tab bulanan untuk (tahun, bulan) tertentu.
 * - Wajib cocok bulan DAN tahun; "Nov 2027" tidak dipakai untuk Nov 2026.
 * - Tab tanpa tahun (misal "Nov") diterima sebagai cadangan.
 * - Tab log / spoil / data pengguna selalu dilewati.
 */
function _findMonthlySheet_(ss, year, monthNum) {
  const sheets = ss.getSheets();
  let tanpaTahun = null;
  for (let i = 0; i < sheets.length; i++) {
    const s = sheets[i];
    const sName = s.getName();
    if (sName === SHEET_LOG_NAME || sName === SHEET_SPOIL_NAME || sName === SHEET_USERS_NAME) continue;
    if (_sheetMonthNum_(sName) !== monthNum) continue;
    const y = _sheetYear_(sName);
    if (y === year) return s;
    if (y === 0 && !tanpaTahun) tanpaTahun = s;
  }
  return tanpaTahun;
}

'''

anchor = "function getOrCreateMonthlySheet(ss, year, monthNum) {"
assert body.count(anchor) == 1, "anchor getOrCreateMonthlySheet tidak unik"
body = body.replace(anchor, HELPERS + anchor, 1)

# ── 3. daftar pengguna: PIN tidak boleh keluar dari server ────────────────
old_users = """    return createJsonResponse({
      success: true,
      count: users.length,
      users: users
    });"""
new_users = """    // PIN tidak pernah dikirim ke browser. Kalau butuh daftar aman,
    // gate v4 sudah menyediakannya lewat _g2PublicUsers().
    const safeUsers = users.map(function (u) {
      return {
        username: u.username,
        name: u.name,
        division: u.division,
        divisions: u.divisions,
        role: u.role,
        avatar: u.avatar,
        createdAt: u.createdAt
      };
    });

    return createJsonResponse({
      success: true,
      count: safeUsers.length,
      users: safeUsers
    });"""
assert body.count(old_users) == 1, f"blok handleReadUsers tidak unik ({body.count(old_users)})"
body = body.replace(old_users, new_users)

gate = (HERE / "gate-v4.gs").read_text(encoding="utf-8").rstrip()
ai = (HERE / "ai-section.gs").read_text(encoding="utf-8").rstrip()

header = """/**
 * ════════════════════════════════════════════════════════════════════════════
 * RIMBA ALAM STOCK API — v4.0 (SESI TOKEN)
 * ════════════════════════════════════════════════════════════════════════════
 * Satu file. Cara pasang:
 *   1. Spreadsheet → Ekstensi → Apps Script
 *   2. Klik isi Code.gs → Ctrl+A → hapus → paste SELURUH file ini → Simpan
 *   3. Deploy → Manage deployments → pensil → Version: New version → Deploy
 *      (jangan "New deployment", URL-nya berubah)
 *
 * Isi:
 *   BAGIAN 1  autentikasi sesi token (PIN hanya saat login, tidak pernah dibalas)
 *   BAGIAN 2  kode stok v3.2 milik user + 3 perbaikan tab bulanan
 *   BAGIAN 3  asisten "Tanya Stok"
 *
 * Script Properties yang dipakai:
 *   OWNER_USERNAME / OWNER_PIN   → akun owner (opsional, tidak ada di sheet)
 *   AI_PROVIDER / AI_KEY / AI_MODEL / AI_BASE_URL / AI_DAILY_LIMIT
 * ════════════════════════════════════════════════════════════════════════════
 */

"""

out = header + gate + "\n\n\n" + body.rstrip() + "\n\n\n" + ai + "\n"
OUT.write_text(out, encoding="utf-8")
print(f"OK  {OUT}  ({len(out)} chars, {out.count(chr(10)) + 1} baris)")
print(f"    sumber: {SRC.name}")
print("    patch terpasang: " + ", ".join(l for l, _, _ in FIXES) + ", strip PIN readUsers")