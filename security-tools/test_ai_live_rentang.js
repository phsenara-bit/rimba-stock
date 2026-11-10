/**
 * Uji END-TO-END ke Gemini sungguhan untuk kasus yang tadinya DITOLAK:
 * "periode tanggal 1-7 Oktober dan November, beda barang keluar terbanyak?"
 *
 * Jalankan: GOOGLE_API_KEY=... node security-tools/test_ai_live_rentang.js
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
  const headers = opts.headers || {};
  Object.keys(headers).forEach(h => args.push("-H", h + ": " + headers[h]));
  if (opts.contentType) args.push("-H", "Content-Type: " + opts.contentType);
  if (opts.payload) args.push("--data-binary", opts.payload);
  args.push(url);
  const raw = execFileSync("curl", args, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  const i = raw.lastIndexOf("\n");
  return { getResponseCode: () => parseInt(raw.slice(i + 1).trim(), 10), getContentText: () => raw.slice(0, i) };
}

function month(name, monthNum, spec) {
  const items = Object.keys(spec).map((n, idx) => {
    const s = spec[n];
    const days = new Set([...Object.keys(s.out || {}), ...Object.keys(s.in || {})]);
    const hist = {};
    let to = 0, ti = 0;
    for (const d of days) {
      const o = Number((s.out || {})[d] || 0), q = Number((s.in || {})[d] || 0);
      hist[d] = { in: q, out: o }; to += o; ti += q;
    }
    return { id: 10 + idx, name: n, division: "KITCHEN", unit: s.unit, price: s.price || 20000,
      stock: 10, stokAwal: 10, inQtyMonth: ti, outQtyMonth: to, minStock: 2, dailyHistory: hist };
  });
  return { success: true, sheetName: name, year: 2026, month: monthNum, dayToDate: 30,
    stats: { totalItems: items.length, totalNilaiStokAset: 1000000, totalRupiahMasuk: 0, totalRupiahKeluar: 0 }, items };
}

const OKT = month("Okt 2026", 10, {
  "Ayam Kampung": { unit: "EKOR", out: { 1: 10, 2: 12, 3: 9, 4: 11, 5: 10, 6: 8, 7: 10 } },
  "Beras": { unit: "KG", out: { 1: 3, 2: 2, 3: 4, 4: 3, 5: 3, 6: 2, 7: 3 } },
  "Minyak Goreng": { unit: "LITER", out: { 2: 6, 5: 5 } }
});
const NOV = month("Nov 2026", 11, {
  "Ayam Kampung": { unit: "EKOR", out: { 1: 6, 2: 7, 3: 5, 4: 6, 5: 5, 6: 4, 7: 5 } },
  "Beras": { unit: "KG", out: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3 } },
  "Ikan Salmon": { unit: "KG", out: { 3: 4, 6: 4 } }
});

const props = { AI_PROVIDER: "gemini", AI_KEY: KEY, AI_MODEL: MODEL };
const sandbox = {
  console, JSON, Math, Date, String, Number, Array, Object, parseInt, parseFloat, isNaN, Error,
  Utilities: { formatDate: (d, tz, f) => ({ yyyy: "2026", MM: "11", dd: "08", yyyyMMdd: "20261108" }[f] || "") },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; } }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put: () => {} }) },
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

const ask = (q) => {
  const facts = vm.runInContext("_aiFacts_", ctx)(q);
  const prompt = vm.runInContext("_aiPrompt_", ctx)(facts, q, [], "");
  const t0 = Date.now();
  let answer, err = "";
  try { answer = vm.runInContext("_aiCall_", ctx)(prompt); } catch (e) { err = String(e.message || e); }
  return { answer, err, ms: Date.now() - t0, mode: facts.mode, period: facts.period };
};

const QS = [
  "periode tanggal 1-7 bulan Oktober dan November beda barang keluar terbanyak ada di apa?",
  "barang keluar terbanyak tanggal 1-7 november apa aja?",
  "kenapa stok ayam kampung bisa minus?"
];

let bad = 0;
console.log("model=" + MODEL);
for (const q of QS) {
  const r = ask(q);
  console.log("\n──────────────────────────────────────────────");
  console.log("Q : " + q);
  console.log("mode=" + r.mode + " | periode=" + r.period + " | " + r.ms + "ms");
  if (r.err) { console.log("ERROR: " + r.err); bad++; continue; }
  console.log("A : " + r.answer);
  if (/di luar jangkauan|di luar topik|di luar konteks|tidak bisa|belum ada data/i.test(r.answer) &&
      !/belum ada/i.test(r.answer)) { console.log("  ⚠️  jawaban terlihat menolak"); bad++; }
  if (/di luar jangkauan|di luar topik|di luar konteks/i.test(r.answer)) bad++;
}
console.log("\n" + (bad ? "ADA MASALAH (" + bad + ")" : "SEMUA JAWABAN MASUK AKAL"));
process.exit(bad ? 1 : 0);
