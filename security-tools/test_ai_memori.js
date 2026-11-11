/**
 * Regresi memori percakapan Mirim + atribusi "siapa yang input".
 *
 * Dua bug yang dijaga di sini:
 *  1. Riwayat & topik dikirim frontend lewat URL (?history=...&topic=...), tetapi
 *     handleAskAI_ dulu hanya membaca payload (yang selalu null di jalur GET),
 *     sehingga model TIDAK PERNAH menerima riwayat percakapan.
 *  2. Pertanyaan lanjutan "siapa yang input" untuk barang minus dijawab dari
 *     transaksi terakhir barang LAIN (mis. "Ragil"), bukan dari barang minusnya.
 *
 * Jalankan: node security-tools/test_ai_memori.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const CODE = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("  ok  " + name); }
  else { fail++; console.log("  FAIL " + name + (extra === undefined ? "" : "  → " + JSON.stringify(extra))); }
}

// ── log mutasi palsu: Ragil menginput Lontong (BUKAN barang minus) ──
// kolom: [id, waktu, ?, staf, ?, barang, satuan, tipe, qty, catatan, ?, ?]
const LOG = [
  ["M1", "2026-11-02 09:00:00", "", "Ragil", "", "Lontong", "PCS", "OUT", "50", "-", "", ""],
  ["M2", "2026-11-05 14:10:00", "", "-", "", "Ayam Kampung", "EKOR", "OUT", "18", "-", "", ""]
];

const SHEET = {
  success: true, sheetName: "Nov 2026", year: 2026, month: 11, dayToDate: 11,
  stats: { totalItems: 3, totalNilaiStokAset: 500000, totalRupiahMasuk: 100000, totalRupiahKeluar: 200000 },
  items: [
    { id: 1, name: "Lontong", division: "KITCHEN", unit: "PCS", price: 8000, stock: 45, stokAwal: 20, inQtyMonth: 0, outQtyMonth: 50, minStock: 2, dailyHistory: { 2: { in: 0, out: 50 } } },
    { id: 2, name: "Ayam Kampung", division: "KITCHEN", unit: "EKOR", price: 44000, stock: -53, stokAwal: 20, inQtyMonth: 0, outQtyMonth: 18, minStock: 2, dailyHistory: { 5: { in: 0, out: 18 } } },
    { id: 3, name: "Beras 1 Krng =50kg", division: "KITCHEN", unit: "KRNG", price: 300000, stock: 7, stokAwal: 10, inQtyMonth: 0, outQtyMonth: 3, minStock: 1, dailyHistory: { 8: { in: 0, out: 3 } } }
  ]
};

const props = { AI_KEY: "dummy", AI_PROVIDER: "gemini", AI_MODEL: "gemini-3.5-flash-lite" };
const cacheStore = {};
let cacheKeys = [];

function makeCtx() {
  cacheKeys = [];
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    JSON, Math, Date, String, Number, Array, Object, parseInt, parseFloat, isNaN, Error,
    Utilities: { formatDate: (d, tz, f) => ({ yyyy: "2026", MM: "11", dd: "11", yyyyMMdd: "20261111" }[f] || "") },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: k => (k in props ? props[k] : null),
        setProperty: (k, v) => { props[k] = v; }
      })
    },
    CacheService: {
      getScriptCache: () => ({
        get: k => (k in cacheStore ? cacheStore[k] : null),
        put: (k, v) => { cacheKeys.push(k); cacheStore[k] = v; },
        remove: k => { delete cacheStore[k]; }
      })
    },
    ContentService: { MimeType: { JSON: "application/json" }, createTextOutput: s => ({ getContent: () => s, setMimeType() { return this; } }) },
    UrlFetchApp: { fetch: () => { throw new Error("tidak boleh memanggil API di unit test"); } },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: () => ({
          getLastRow: () => LOG.length + 1,
          getRange: (r, c, n) => ({ getValues: () => LOG.slice(Math.max(0, r - 2), Math.max(0, r - 2) + n) })
        })
      })
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(CODE, ctx, { filename: "Code.gs" });
  ctx.handleReadMonthlySheetData = () => ({ getContent: () => JSON.stringify(SHEET) });
  return ctx;
}

// ═══ 1. Riwayat dari URL benar-benar masuk ke prompt ═══
console.log("\n=== 1. Riwayat percakapan dari parameter URL ===");
{
  const ctx = makeCtx();
  let captured = "";
  ctx._aiCall_ = (p) => { captured = p; return "ok"; };

  const hist = [
    { role: "user", text: "berapa total minus bulan ini?" },
    { role: "model", text: "Total minus 1 barang, Ayam Kampung -53 EKOR." }
  ];
  const e = { parameter: { action: "askAI", q: "siapa yang input?", topic: "Barang stok MINUS", history: JSON.stringify(hist) } };
  const res = JSON.parse(ctx.handleAskAI_(e, { username: "rian", role: "admin", name: "Rian" }, null).getContent());

  ok("permintaan sukses", res.success === true, res);
  ok("prompt memuat blok RIWAYAT", /RIWAYAT/.test(captured));
  ok("pertanyaan sebelumnya ikut terkirim", /berapa total minus bulan ini/.test(captured));
  ok("jawaban sebelumnya ikut terkirim", /Ayam Kampung -53 EKOR/.test(captured));
  ok("topik ikut terkirim", /Topik yang sedang dibahas: Barang stok MINUS/.test(captured));

  // tanpa perbaikan, prompt tidak memuat riwayat sama sekali
  const e2 = { parameter: { action: "askAI", q: "siapa yang input?" } };
  captured = "";
  ctx.handleAskAI_(e2, { username: "rian", role: "admin" }, null);
  ok("tanpa history tidak ada blok RIWAYAT", !/RIWAYAT/.test(captured));
}

// ═══ 2. Konteks percakapan memisahkan kunci cache ═══
console.log("\n=== 2. Cache tidak mencampur konteks ===");
{
  const ctx = makeCtx();
  ctx._aiCall_ = () => "ok";
  const user = { username: "rian", role: "admin" };
  ctx.handleAskAI_({ parameter: { action: "askAI", q: "siapa yang input", topic: "Barang stok MINUS" } }, user, null);
  const keyMinus = cacheKeys[cacheKeys.length - 1];
  ctx.handleAskAI_({ parameter: { action: "askAI", q: "siapa yang input", topic: "Lontong" } }, user, null);
  const keyLontong = cacheKeys[cacheKeys.length - 1];
  ok("pertanyaan sama + topik beda = kunci beda", keyMinus && keyLontong && keyMinus !== keyLontong, { keyMinus, keyLontong });
}

// ═══ 3. "Siapa yang input" tidak mencomot staf barang lain ═══
console.log("\n=== 3. Atribusi khusus barang minus ===");
{
  const ctx = makeCtx();
  const facts = vm.runInContext("_aiFacts_", ctx)("berapa total minus bulan ini?", "");
  ok("topik = Barang stok MINUS", facts.topic === "Barang stok MINUS", facts.topic);
  ok("ada blok TRANSAKSI BARANG MINUS", /TRANSAKSI BARANG MINUS/.test(facts.text));
  ok("menyebut Ayam Kampung sebagai minus", /Ayam Kampung -53 EKOR/.test(facts.text));

  const blokMinus = (facts.text.match(/TRANSAKSI BARANG MINUS[\s\S]*?(?=\n\n|$)/) || [""])[0];
  ok("blok minus memuat transaksi Ayam Kampung", /Ayam Kampung/.test(blokMinus), blokMinus);
  ok("blok minus TIDAK memuat staf barang lain (Ragil)", !/Ragil/.test(blokMinus), blokMinus);
  ok("blok minus menandai penginput belum tercatat", /TIDAK TERCATAT/.test(blokMinus), blokMinus);

  ok("blok transaksi global diberi peringatan", /BUKAN khusus barang minus/.test(facts.text));

  // lanjutan: pertanyaan tanpa nama barang tetap nyambung ke topik minus
  const lanjut = vm.runInContext("_aiFacts_", ctx)("siapa yang input?", "Barang stok MINUS");
  ok("lanjutan tetap bertopik minus", lanjut.topic === "Barang stok MINUS", lanjut.topic);
  ok("lanjutan tetap memuat blok minus", /TRANSAKSI BARANG MINUS/.test(lanjut.text));
}

// ═══ 4. Jendela riwayat dibatasi & bisa diatur ═══
console.log("\n=== 4. Batas riwayat ===");
{
  const ctx = makeCtx();
  const long = [];
  for (let i = 1; i <= 10; i++) {
    long.push({ role: "user", text: "pertanyaan ke-" + i });
    long.push({ role: "model", text: "jawaban ke-" + i });
  }
  const f = vm.runInContext("_aiFacts_", ctx)("stok beras berapa?", "");
  const p = vm.runInContext("_aiPrompt_", ctx)(f, "stok beras berapa?", long, "");
  const dikirim = (p.match(/pertanyaan ke-/g) || []).length;
  ok("hanya giliran terakhir yang dikirim", dikirim === 4, dikirim);
  ok("giliran paling baru ikut", /pertanyaan ke-10/.test(p));
  ok("giliran paling lama dibuang", !/pertanyaan ke-1$/m.test(p));

  props.AI_HISTORY_TURNS = "6";
  const p6 = vm.runInContext("_aiPrompt_", ctx)(f, "stok beras berapa?", long, "");
  ok("bisa diatur lewat AI_HISTORY_TURNS", (p6.match(/pertanyaan ke-/g) || []).length === 6);
  delete props.AI_HISTORY_TURNS;
}

console.log("\n" + (fail ? "ADA YANG GAGAL: " + pass + " lulus, " + fail + " gagal" : "SEMUA LULUS: " + pass + " lulus, 0 gagal"));
process.exit(fail ? 1 : 0);
