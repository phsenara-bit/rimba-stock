/**
 * Ukur ukuran prompt Mirim per jenis pertanyaan, termasuk pengaruh riwayat.
 * Tidak memanggil API — hanya menghitung karakter prompt.
 *
 * Jalankan: node build/measure_prompt.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const CODE = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");

function buildMonth(name, monthNum, spec) {
  const items = Object.keys(spec).map((n, idx) => {
    const s = spec[n];
    const hist = {};
    let to = 0, ti = 0;
    Object.keys(s.out || {}).forEach(d => { hist[d] = { in: 0, out: s.out[d] }; to += s.out[d]; });
    Object.keys(s.in || {}).forEach(d => {
      hist[d] = hist[d] || { in: 0, out: 0 };
      hist[d].in = s.in[d]; ti += s.in[d];
    });
    return {
      id: 100 + idx, name: n, division: s.division || "KITCHEN", unit: s.unit || "PCS",
      price: s.price || 10000, stock: s.stock == null ? 20 : s.stock,
      stokAwal: 20, inQtyMonth: ti, outQtyMonth: to, minStock: 2, dailyHistory: hist
    };
  });
  return {
    success: true, sheetName: name, year: 2026, month: monthNum, dayToDate: 11,
    stats: {
      totalItems: items.length,
      totalNilaiStokAset: items.reduce((a, b) => a + b.stock * b.price, 0),
      totalRupiahMasuk: 2000000, totalRupiahKeluar: 4500000
    },
    items
  };
}

const OKT = buildMonth("Okt 2026", 10, {
  "Lontong": { unit: "PCS", out: { 2: 40, 5: 35, 8: 30 } },
  "Ayam Kampung": { unit: "EKOR", out: { 3: 20, 9: 25 }, stock: -12, price: 44000 },
  "Beras 1 Krng =50kg": { unit: "KRNG", out: { 1: 3, 10: 2 }, stock: 7 }
});
const NOV = buildMonth("Nov 2026", 11, {
  "Lontong": { unit: "PCS", out: { 1: 50, 4: 45, 7: 55 }, stock: 45 },
  "Ayam Cut 4": { unit: "KG", out: { 2: 12, 6: 15 }, in: { 3: 30 } },
  "Ayam Kampung": { unit: "EKOR", out: { 5: 18 }, stock: -53, price: 44000 },
  "Minyak Goreng @2000ml": { unit: "LITER", out: { 3: 4, 7: 3 }, stock: 12 },
  "Tepung Terigu": { unit: "KG", out: { 4: 6 }, stock: 18 },
  "Gula Pasir": { unit: "KG", out: { 5: 7 }, stock: 9 },
  "Beras 1 Krng =50kg": { unit: "KRNG", out: { 2: 2, 8: 3 }, stock: 7 }
});

// 60 baris log mutasi palsu (kolom: 0 id,1 waktu,2 tipe,3 qty,4 satuan,5 barang,6-10 lain,11 staf)
const LOG = [];
for (let i = 0; i < 60; i++) {
  const nama = ["Ayam Kampung", "Lontong", "Beras 1 Krng =50kg", "Tepung Terigu", "Gula Pasir"][i % 5];
  LOG.push(["M" + i, "2026-11-0" + ((i % 9) + 1) + " 09:12:00", i % 2 ? "OUT" : "IN", (i % 7) + 1, "PCS", nama, "", "", "", "", "", i % 3 ? "Ragil" : "-"]);
}

const props = { AI_PROVIDER: "gemini", AI_KEY: "x", AI_MODEL: "gemini-3.5-flash-lite" };
const sandbox = {
  console, JSON, Math, Date, String, Number, Array, Object, parseInt, parseFloat, isNaN, Error,
  Utilities: { formatDate: (d, tz, f) => ({ yyyy: "2026", MM: "11", dd: "11", yyyyMMdd: "20261111", "yyyy-MM-dd": "2026-11-11", "HH:mm": "09:00" }[f] || "") },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; } }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put: () => {}, remove: () => {} }) },
  ContentService: { MimeType: { JSON: "application/json" }, createTextOutput: s => ({ getContent: () => s, setMimeType() { return this; } }) },
  UrlFetchApp: { fetch: () => { throw new Error("tidak dipanggil"); } },
  SpreadsheetApp: {
    getActiveSpreadsheet: () => ({
      getSheetByName: () => ({
        getLastRow: () => LOG.length + 1,
        getRange: (r, c, nr) => ({ getValues: () => LOG.slice(Math.max(0, r - 2), Math.max(0, r - 2) + nr) })
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

const fakta = vm.runInContext("_aiFacts_", ctx);
const prompt = vm.runInContext("_aiPrompt_", ctx);

const hist = (n) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ role: "user", text: "pertanyaan contoh nomor " + (i + 1) + " soal stok bulan ini" });
    out.push({ role: "model", text: "Jawaban contoh nomor " + (i + 1) + " yang panjangnya kira-kira seperti jawaban Mirim sungguhan, empat kalimat pendek." });
  }
  return out;
};

const QS = [
  ["ringkasan", "barang dengan stok terbanyak bulan ini apa?"],
  ["minus", "berapa total minus bulan ini?"],
  ["item", "kenapa stok ayam kampung minus?"],
  ["katalog", "sebutkan semua barang di divisi kitchen"],
  ["banding", "perbandingan lontong bulan ini dan bulan lalu berapa?"]
];

const TURNS = [0, 2, 5, 8];
console.log("chars / ~token (asumsi 3.8 char per token)\n");
console.log("jenis       " + TURNS.map(t => ("riwayat " + t + " giliran").padStart(22)).join(""));
for (const [label, q] of QS) {
  const f = fakta(q, "");
  const row = TURNS.map(t => {
    const p = prompt(f, q, hist(t), "");
    const tok = Math.round(p.length / 3.8);
    return ((p.length + " / " + tok)).padStart(22);
  });
  console.log((label + "        ").slice(0, 12) + row.join(""));
}

const f0 = fakta("barang dengan stok terbanyak bulan ini apa?", "");
console.log("\n--- potongan FAKTA ringkasan (maks 700 char) ---");
console.log(f0.text.slice(0, 700));
