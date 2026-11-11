/**
 * Uji END-TO-END ke Gemini untuk keluhan nyata pengguna:
 *   1. "lontong bulan oktober berapa"                → harus dijawab
 *   2. "perbandingan lontong bulan ini dan bulan lalu" → harus dijawab dua periode
 *   3. "cari ayam cut 4 bulan ini ... berapa out"    → harus dijawab
 *   4. "sebutkan semua barang di kitchen"            → harus dijawab (bukan ditolak)
 *   5. "resep ayam bakar"                            → memang di luar topik, boleh ditolak
 *
 * Jalankan: GOOGLE_API_KEY=... node security-tools/test_ai_live_mirim.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");

const CODE = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const KEY = process.env.AI_KEY || process.env.GOOGLE_API_KEY || "";
const MODEL = process.env.AI_MODEL || "gemini-3.5-flash-lite";
if (!KEY) { console.error("Tidak ada API key (set GOOGLE_API_KEY)."); process.exit(2); }

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

function buildMonth(name, monthNum, spec) {
  const items = Object.keys(spec).map((n, idx) => {
    const s = spec[n];
    const days = new Set([...Object.keys(s.out || {}), ...Object.keys(s.in || {})]);
    const hist = {};
    let to = 0, ti = 0;
    for (const d of days) {
      const o = Number((s.out || {})[d] || 0), q = Number((s.in || {})[d] || 0);
      hist[d] = { in: q, out: o }; to += o; ti += q;
    }
    return {
      id: 100 + idx, name: n, division: s.division || "KITCHEN", unit: s.unit || "PCS",
      price: s.price || 10000, stock: s.stock == null ? 20 : s.stock,
      stokAwal: s.stokAwal == null ? 20 : s.stokAwal,
      inQtyMonth: ti, outQtyMonth: to, minStock: 2, dailyHistory: hist
    };
  });
  return {
    success: true, sheetName: name, year: 2026, month: monthNum, dayToDate: 11,
    stats: {
      totalItems: items.length,
      totalNilaiStokAset: items.reduce((a, b) => a + b.stock * b.price, 0),
      totalRupiahMasuk: 0, totalRupiahKeluar: 0
    },
    items
  };
}

// Ayam Cut 4 sengaja HANYA ada di November (kasus nyata: barang baru)
const OKT = buildMonth("Okt 2026", 10, {
  "Lontong": { unit: "PCS", out: { 2: 40, 5: 35, 8: 30, 12: 25, 20: 40 } },
  "Ayam Kampung": { unit: "EKOR", out: { 3: 20, 9: 25 } },
  "Beras 1 Krng =50kg": { unit: "KRNG", out: { 1: 3, 10: 2 }, stock: 7 }
});
const NOV = buildMonth("Nov 2026", 11, {
  "Lontong": { unit: "PCS", out: { 1: 50, 4: 45, 7: 55, 9: 40 }, stock: 45 },
  "Ayam Cut 4": { unit: "KG", out: { 2: 12, 6: 15, 10: 9 }, in: { 3: 30 } },
  "Ayam Kampung": { unit: "EKOR", out: { 5: 18 }, stock: -53, price: 44000 },
  "Minyak Goreng @2000ml": { unit: "LITER", out: { 3: 4, 7: 3 }, stock: 12 },
  "Beras 1 Krng =50kg": { unit: "KRNG", out: { 2: 2, 8: 3 }, stock: 7 }
});

const props = { AI_PROVIDER: "gemini", AI_KEY: KEY, AI_MODEL: MODEL };
const sandbox = {
  console, JSON, Math, Date, String, Number, Array, Object, parseInt, parseFloat, isNaN, Error,
  Utilities: { formatDate: (d, tz, f) => ({ yyyy: "2026", MM: "11", dd: "11", yyyyMMdd: "20261111" }[f] || "") },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; } }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put: () => {}, remove: () => {} }) },
  ContentService: { MimeType: { JSON: "application/json" }, createTextOutput: s => ({ getContent: () => s, setMimeType() { return this; } }) },
  UrlFetchApp: { fetch: curlFetch },
  SpreadsheetApp: { getActiveSpreadsheet: () => ({}) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }
};
const ctx = vm.createContext(sandbox);
vm.runInContext(CODE, ctx, { filename: "Code.gs" });
vm.runInContext("_findMonthlySheet_ = function(ss,y,m){ return m===10 ? {getName:function(){return 'Okt 2026';}} : (m===11 ? {getName:function(){return 'Nov 2026';}} : null); };", ctx);
ctx.handleReadMonthlySheetData = (p) => {
  const sh = (p && p.parameter && p.parameter.sheet) || "";
  return { getContent: () => JSON.stringify(sh.indexOf("Okt") === 0 ? OKT : NOV) };
};

const ask = (q, hist, topic) => {
  const facts = vm.runInContext("_aiFacts_", ctx)(q, topic || "");
  const prompt = vm.runInContext("_aiPrompt_", ctx)(facts, q, hist || [], topic || "");
  const t0 = Date.now();
  let answer = "", err = "";
  try { answer = vm.runInContext("_aiCall_", ctx)(prompt); } catch (e) { err = String(e.message || e); }
  return { answer, err, ms: Date.now() - t0, mode: facts.mode, period: facts.period, topic: facts.topic };
};

const TOLAK = /di luar jangkauan|di luar topik|di luar konteks|tidak bisa bantu|bukan wewenang/i;
// Mirim tidak boleh membuka dengan sapaan — harus langsung ke inti seperti agen.
const GREET = /^\s*(halo|hai|hi|hello|selamat|aduh|maaf|oke|baik|tentu)\b/i;

const CASES = [
  { q: "lontong bulan oktober berapa keluar?", mustAnswer: true, want: /lontong/i },
  { q: "perbandingan lontong bulan ini dan bulan lalu berapa?", mustAnswer: true, want: /lontong/i },
  { q: "cari ayam cut 4 bulan ini berapa out nya?", mustAnswer: true, want: /ayam cut 4/i },
  { q: "sebutkan semua barang di divisi kitchen", mustAnswer: true, want: /lontong|beras|ayam/i },
  { q: "stok ayam cut 4 bulan lalu berapa?", mustAnswer: true, want: /ayam cut 4/i },
  { q: "beras berapa karung sisanya sekarang?", mustAnswer: true, want: /beras/i },
  { q: "minyak goreng perbandingan bulan ini dan bulan lalu berapa?", mustAnswer: true, want: /minyak goreng/i },
  { q: "barang dengan stok terbanyak bulan ini apa?", mustAnswer: true, want: /lontong/i, wantNot: /belum tercatat|belum ada/i },
  { q: "berapa total minus bulan ini?", mustAnswer: true, want: /ayam kampung|minus/i, wantNot: /nilai aset|total aset/i },
  { q: "resep ayam bakar enak gimana?", mustAnswer: false }
];

let bad = 0;
console.log("model=" + MODEL);
for (const c of CASES) {
  const r = ask(c.q);
  console.log("\n──────────────────────────────────────────────");
  console.log("Q : " + c.q);
  console.log("mode=" + r.mode + " | " + r.ms + "ms");
  if (r.err) { console.log("ERROR: " + r.err); bad++; continue; }
  console.log("A : " + r.answer);

  if (c.mustAnswer) {
    if (GREET.test(r.answer)) { console.log("  ❌ ADA SAPAAN PEMBUKA (" + (r.answer.match(GREET) || [""])[0] + ")"); bad++; }
    else if (c.wantNot && c.wantNot.test(r.answer)) { console.log("  ❌ jawaban salah arah"); bad++; }
    else if (TOLAK.test(r.answer)) { console.log("  ❌ MENOLAK padahal harus dijawab"); bad++; }
    else if (c.want && !c.want.test(r.answer)) { console.log("  ⚠️  jawaban tidak menyebut barang yang ditanya"); bad++; }
    else console.log("  ✅ dijawab");
  } else {
    if (TOLAK.test(r.answer)) console.log("  ✅ ditolak (memang di luar topik)");
    else { console.log("  ⚠️  tidak ditolak — cek apakah jawabannya masih soal stok"); }
  }
}

// ── lanjutan dalam satu percakapan: riwayat + topik harus dipakai ──
console.log("\n════════ LANJUTAN SATU PERCAKAPAN ════════");
{
  const r1 = ask("berapa total minus bulan ini?");
  console.log("\nQ1: berapa total minus bulan ini?");
  console.log("A1: " + r1.answer);
  const hist = [
    { role: "user", text: "berapa total minus bulan ini?" },
    { role: "model", text: r1.answer }
  ];
  const r2 = ask("siapa yang input?", hist, r1.topic);
  console.log("\nQ2: siapa yang input?   (topik=" + r1.topic + ")");
  console.log("A2: " + r2.answer);
  if (GREET.test(r2.answer)) { console.log("  ❌ lanjutan dibuka dengan sapaan"); bad++; }
  else if (!/minus|ayam kampung|catatan/i.test(r2.answer)) { console.log("  ❌ lanjutan kehilangan konteks minus"); bad++; }
  else console.log("  ✅ lanjutan nyambung ke topik minus");
}

console.log("\n" + (bad ? "ADA MASALAH (" + bad + ")" : "SEMUA SESUAI"));
process.exit(bad ? 1 : 0);