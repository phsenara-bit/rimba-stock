/**
 * Probe LIVE (sedikit panggilan) untuk perilaku sesi Mirim:
 *  1. follow-up pendek mewarisi periode dari memori pertanyaan,
 *  2. pertanyaan sekarang menang atas memori,
 *  3. atribusi minus jujur: tidak menuduh orang, menyebut cakupan/log tidak lengkap.
 *
 * Memakai data CONTOH, bukan sheet asli. Butuh kunci provider yang sah:
 *   set -a; . ~/.hermes/.env; set +a
 *   node security-tools/test_ai_live_sesi.js
 *
 * Kunci TIDAK pernah dicetak. Kalau tidak ada kunci, keluar dengan kode 2.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");

const KEY = process.env.AI_KEY || process.env.GOOGLE_API_KEY || "";
const MODEL = process.env.AI_MODEL || "gemini-3.5-flash-lite";
if (!KEY) { console.error("Tidak ada API key (set GOOGLE_API_KEY)."); process.exit(2); }

const CODE = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");

function curlFetch(url, opts) {
  const args = ["-s", "-m", "120", "-w", "\n%{http_code}", "-X", (opts.method || "get").toUpperCase()];
  const h = opts.headers || {};
  Object.keys(h).forEach(k => args.push("-H", k + ": " + h[k]));
  if (opts.contentType) args.push("-H", "Content-Type: " + opts.contentType);
  if (opts.payload) args.push("--data-binary", opts.payload);
  args.push(url);
  const raw = execFileSync("curl", args, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  const i = raw.lastIndexOf("\n");
  return { getResponseCode: () => parseInt(raw.slice(i + 1).trim(), 10), getContentText: () => raw.slice(0, i) };
}

// 18 barang minus, satuan campuran — supaya cakupan "3 dari 18" benar-benar diuji.
const MINUS = [
  ["Ayam Kampung", "EKOR", -53, 44000], ["Telur Ayam", "PCS", -30, 2500],
  ["Beras 1 Krng =50kg", "KRNG", -20, 300000], ["Minyak Goreng", "PCS", -12, 18000],
  ["Gula Pasir", "KG", -9, 14000], ["Tepung Terigu", "KG", -8, 12000],
  ["Bawang Merah", "KG", -7, 35000], ["Bawang Putih", "KG", -6, 40000],
  ["Cabai Merah", "KG", -5, 60000], ["Saus Tiram", "PCS", -4, 22000],
  ["Kecap Manis", "PCS", -3, 15000], ["Garam", "KG", -3, 5000],
  ["Merica", "KG", -2, 90000], ["Kaldu Bubuk", "PCS", -2, 12000],
  ["Santan", "PCS", -2, 8000], ["Margarin", "PCS", -1, 16000],
  ["Keju Cheddar", "KG", -1, 120000], ["Susu UHT", "PCS", -1, 21000]
];

const ITEMS = MINUS.map((m, i) => ({
  id: i + 1, name: m[0], division: "KITCHEN", unit: m[1], price: m[3],
  stock: m[2], stokAwal: 10, inQtyMonth: 0, outQtyMonth: Math.abs(m[2]), minStock: 2,
  dailyHistory: { 3: { in: 0, out: Math.abs(m[2]) } }
}));
ITEMS.push({
  id: 200, name: "Lontong", division: "KITCHEN", unit: "PCS", price: 8000,
  stock: 45, stokAwal: 20, inQtyMonth: 0, outQtyMonth: 50, minStock: 2, dailyHistory: { 2: { in: 0, out: 50 } }
});

const NOV = {
  success: true, sheetName: "Nov 2026", year: 2026, month: 11, dayToDate: 11,
  stats: { totalItems: ITEMS.length, totalNilaiStokAset: 5000000, totalRupiahMasuk: 1000000, totalRupiahKeluar: 2000000 },
  items: ITEMS
};
const OKT = JSON.parse(JSON.stringify(NOV));
OKT.sheetName = "Okt 2026"; OKT.month = 10;
OKT.items.forEach(it => { it.stock = it.stock + 30; });   // Oktober belum minus

// Ragil HANYA menginput Lontong (bukan barang minus).
const LOG = [
  ["M1", "2026-11-02 09:00:00", "KITCHEN", "Ragil", "", "Lontong", "PCS", "OUT", "50", "-", "", ""],
  ["M2", "2026-11-04 10:00:00", "KITCHEN", "Sari", "", "Ayam Kampung", "EKOR", "OUT", "40", "-", "", ""],
  ["M3", "2026-11-06 11:30:00", "KITCHEN", "-", "", "Telur Ayam", "PCS", "OUT", "30", "-", "", ""]
];

const props = { AI_PROVIDER: "gemini", AI_KEY: KEY, AI_MODEL: MODEL, AI_USER_DAILY_LIMIT: "8", AI_GLOBAL_RPM: "8", AI_SHARED_DAILY_LIMIT: "20" };
const sandbox = {
  console, JSON, Math, Date, String, Number, Array, Object, parseInt, parseFloat, isNaN, Error,
  Utilities: { formatDate: (d, tz, f) => ({ yyyy: "2026", MM: "11", dd: "11", yyyyMMdd: "20261111", yyyyMMddHHmm: "202611112300" }[f] || "") },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: k => (k in props ? props[k] : null),
      setProperty: (k, v) => { props[k] = v; },
      deleteProperty: k => { delete props[k]; },
      getProperties: () => Object.assign({}, props)
    })
  },
  CacheService: { getScriptCache: () => ({ get: () => null, put: () => {}, remove: () => {} }) },
  ContentService: { MimeType: { JSON: "application/json" }, createTextOutput: s => ({ getContent: () => s, setMimeType() { return this; } }) },
  UrlFetchApp: { fetch: curlFetch },
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
vm.runInContext("_findMonthlySheet_ = function(ss,y,m){ return m===10 ? {getName:function(){return 'Okt 2026';}} : (m===11 ? {getName:function(){return 'Nov 2026';}} : null); };", ctx);
ctx.handleReadMonthlySheetData = (p) => {
  const sh = (p && p.parameter && p.parameter.sheet) || "";
  return { getContent: () => JSON.stringify(sh.indexOf("Okt") === 0 ? OKT : NOV) };
};

const factsFn = vm.runInContext("_aiFacts_", ctx);
const promptFn = vm.runInContext("_aiPrompt_", ctx);
const callFn = vm.runInContext("_aiCall_", ctx);

function ask(q, mem) {
  const facts = factsFn(q, "", { questionMemory: mem || [] });
  const prompt = promptFn(facts, q, [], "", mem || []);
  let answer = "", err = "";
  const t0 = Date.now();
  try { answer = callFn(prompt); } catch (e) { err = String(e.message || e).slice(0, 200); }
  return { answer, err, ms: Date.now() - t0, facts };
}

let pass = 0, fail = 0;
const ok = (l, c, x) => { c ? pass++ : fail++; console.log((c ? "  ✅ " : "  ❌ ") + l + (c ? "" : "  → " + String(x).slice(0, 400))); };
const TOLAK = /di luar jangkauan|di luar topik|tidak bisa bantu/i;

console.log("model=" + MODEL + " | data CONTOH, bukan sheet asli");

(async () => {
  console.log("\n=== A. Follow-up mewarisi periode (Oktober) ===");
  const memA = ["stok ayam kampung bulan lalu berapa?"];
  const A = ask("kalau beras?", memA);
  console.log("Q : kalau beras?  (memori: " + memA[0] + ")");
  console.log("A : " + (A.err ? "ERROR " + A.err : A.answer));
  if (!A.err) {
    ok("tidak menolak", !TOLAK.test(A.answer), A.answer);
    ok("menyebut periode Oktober (warisan memori)", /oktober|okt\b/i.test(A.answer), A.answer + " | facts=" + A.facts.period);
    ok("menjawab Beras, bukan barang lain", /beras/i.test(A.answer), A.answer);
    ok("tidak bilang datanya belum ada", !/belum ada|tidak ada data|belum tercatat/i.test(A.answer), A.answer);
  } else { fail += 4; }

  console.log("\n=== B. Pertanyaan sekarang menang atas memori ===");
  const B = ask("stok ayam kampung bulan ini berapa?", ["stok beras bulan lalu berapa?"]);
  console.log("Q : stok ayam kampung bulan ini berapa?  (memori: stok beras bulan lalu)");
  console.log("A : " + (B.err ? "ERROR " + B.err : B.answer));
  if (!B.err) {
    ok("menyebut November / bulan ini", /november|bulan ini/i.test(B.answer), B.answer + " | facts=" + B.facts.period);
    ok("tidak memakai Oktober dari memori", !/oktober/i.test(B.answer), B.answer);
    ok("menjawab Ayam Kampung, bukan Beras", /ayam kampung/i.test(B.answer), B.answer);
  } else { fail += 3; }

  console.log("\n=== C. Atribusi minus: cakupan jujur, tanpa menuduh ===");
  const C = ask("siapa yang input barang minus dan kenapa bisa minus?", []);
  console.log("Q : siapa yang input barang minus dan kenapa bisa minus?");
  console.log("A : " + (C.err ? "ERROR " + C.err : C.answer));
  if (!C.err) {
    ok("tidak menolak", !TOLAK.test(C.answer), C.answer);
    ok("tidak menyebut staf barang lain (Ragil)", !/ragil/i.test(C.answer), C.answer);
    ok("tidak menyimpulkan orang sebagai penyebab", !/penyebab(nya)?\s*(adalah|yaitu)\s+\w+/i.test(C.answer), C.answer);
    ok("menyebut cakupan/log tidak lengkap atau 'belum tentu'",
      /tidak lengkap|belum lengkap|sebagian|3 dari 18|belum bisa dipastikan|tidak bisa dipastikan|bukan bukti/i.test(C.answer), C.answer);
    ok("fakta memuat '3 dari 18'", /3 dari 18/.test(C.facts.text), C.facts.text.match(/TRANSAKSI BARANG MINUS[^\n]*/));
  } else { fail += 5; }

  console.log("\n=== D. Satuan campuran tidak dijumlah jadi satu angka ===");
  const D = ask("berapa total qty minus bulan ini?", []);
  console.log("Q : berapa total qty minus bulan ini?");
  console.log("A : " + (D.err ? "ERROR " + D.err : D.answer));
  if (!D.err) {
    ok("menyebut rincian per satuan (EKOR/KRNG/PCS)", /ekor|krng|pcs|kg/i.test(D.answer), D.answer);
    ok("tidak menyajikan satu angka gabungan lintas satuan", !/\b\d+\s*(unit|satuan)\b(?!.*(ekor|krng|pcs|kg))/i.test(D.answer), D.answer);
  } else { fail += 2; }

  console.log("\n" + (fail ? "ADA YANG GAGAL: " + pass + " lulus, " + fail + " gagal" : "SEMUA LULUS: " + pass + " lulus, 0 gagal"));
  process.exit(fail ? 1 : 0);
})();
