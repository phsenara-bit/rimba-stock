/**
 * Tes khusus pertanyaan rentang tanggal & perbandingan antar bulan.
 * Skenario nyata yang ditolak Mirim: "periode tanggal 1-7 Oktober dan
 * November, beda barang keluar terbanyak ada di apa?"
 * Jalankan: node security-tools/test_ai_rentang.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const CODE = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");

function monthData(monthName, spec) {
  // spec: { "Ayam Kampung": {out:{1:5,...}, in:{...}, unit, price} }
  const items = Object.keys(spec).map((name, i) => {
    const s = spec[name];
    const hist = {};
    const days = new Set([...(Object.keys(s.out || {})), ...(Object.keys(s.in || {}))]);
    let totOut = 0, totIn = 0;
    for (const d of days) {
      const o = Number((s.out || {})[d] || 0);
      const n = Number((s.in || {})[d] || 0);
      hist[d] = { in: n, out: o };
      totOut += o; totIn += n;
    }
    return {
      id: 10 + i, name, division: s.division || "KITCHEN", unit: s.unit || "PCS",
      price: s.price || 10000, stock: s.stock == null ? 10 : s.stock,
      stokAwal: s.stokAwal == null ? 10 : s.stokAwal,
      inQtyMonth: totIn, outQtyMonth: totOut, minStock: 2, dailyHistory: hist
    };
  });
  return {
    success: true, sheetName: monthName, year: 2026, month: monthName.toLowerCase().startsWith("okt") ? 10 : 11,
    dayToDate: 30, stats: { totalItems: items.length, totalNilaiStokAset: 0, totalRupiahMasuk: 0, totalRupiahKeluar: 0 },
    items
  };
}

const OKT = monthData("Okt 2026", {
  "Ayam Kampung": { unit: "EKOR", out: { 1: 10, 2: 12, 3: 9, 4: 11, 5: 10, 6: 8, 7: 10 } },
  "Beras": { unit: "KG", out: { 1: 3, 2: 2, 3: 4, 4: 3, 5: 3, 6: 2, 7: 3 } },
  "Minyak Goreng": { unit: "LITER", out: { 2: 6, 5: 5 } }
});

const NOV = monthData("Nov 2026", {
  "Ayam Kampung": { unit: "EKOR", out: { 1: 6, 2: 7, 3: 5, 4: 6, 5: 5, 6: 4, 7: 5 } },
  "Beras": { unit: "KG", out: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3 } },
  "Ikan Salmon": { unit: "KG", out: { 3: 4, 6: 4 } }
});

function makeCtx() {
  const props = { AI_KEY: "test-key", AI_PROVIDER: "gemini" };
  const cache = {};
  const sandbox = {
    console: { log() {}, error() {}, warn() {} },
    JSON, Math, Date, String, Number, Array, Object, parseInt, parseFloat, isNaN, Error,
    Utilities: {
      formatDate: (d, tz, fmt) => {
        if (fmt === "yyyyMMdd") return "20261108";
        if (fmt === "yyyy") return "2026";
        if (fmt === "MM") return "11";
        if (fmt === "dd") return "08";
        return "";
      }
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: k => (k in props ? props[k] : null),
        setProperty: (k, v) => { props[k] = v; },
        deleteProperty: k => { delete props[k]; }
      })
    },
    CacheService: {
      getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } })
    },
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput: s => ({ getContent: () => s, setMimeType() { return this; } })
    },
    UrlFetchApp: { fetch: () => { throw new Error("tidak dipanggil di tes ini"); } },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({}) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(CODE, ctx, { filename: "Code.gs" });

  // Tab Oktober ada, tab Desember tidak ada
  vm.runInContext("_findMonthlySheet_ = function(ss, y, m){ return m === 10 ? { getName: function(){ return 'Okt 2026'; } } : null; };", ctx);
  vm.runInContext(
    "handleReadMonthlySheetData = function(p){ var s = (p && p.parameter && p.parameter.sheet) || ''; return { getContent: function(){ return JSON.stringify(s.indexOf('Okt') === 0 ? __OKT : __NOV); } }; };",
    ctx
  );
  ctx.__OKT = OKT;
  ctx.__NOV = NOV;
  return ctx;
}

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log("  ok  " + name); }
  else { fail++; console.log("  FAIL " + name + (extra ? "  → " + extra : "")); }
};

console.log("\n=== A. Deteksi rentang tanggal ===");
{
  const ctx = makeCtx();
  const f = q => vm.runInContext("_aiDayRange_", ctx)(q);
  ok("'tanggal 1-7' → 1..7", JSON.stringify(f("periode tanggal 1-7")) === '{"from":1,"to":7}', JSON.stringify(f("periode tanggal 1-7")));
  ok("'tgl 3 s/d 9' → 3..9", JSON.stringify(f("tgl 3 s/d 9")) === '{"from":3,"to":9}', JSON.stringify(f("tgl 3 s/d 9")));
  ok("'5 sampai 2' dibalik → 2..5", JSON.stringify(f("5 sampai 2")) === '{"from":2,"to":5}', JSON.stringify(f("5 sampai 2")));
  ok("'Nov 2026' bukan rentang", f("stok november 2026") === null, JSON.stringify(f("stok november 2026")));
  ok("tanpa angka → null", f("kenapa ayam minus") === null);
}

console.log("\n=== B. Deteksi multi-bulan ===");
{
  const ctx = makeCtx();
  const f = q => vm.runInContext("_aiMonthsInQuestion_", ctx)(q).map(x => x.month);
  ok("'Oktober dan November' → [10,11]", JSON.stringify(f("tanggal 1-7 oktober dan november")) === "[10,11]", JSON.stringify(f("tanggal 1-7 oktober dan november")));
  ok("'okt vs nov' → [10,11]", JSON.stringify(f("banding okt vs nov")) === "[10,11]", JSON.stringify(f("banding okt vs nov")));
  ok("'bulan lalu' → [10]", JSON.stringify(f("stok bulan lalu")) === "[10]", JSON.stringify(f("stok bulan lalu")));
  ok("tanpa bulan → []", JSON.stringify(f("stok ayam")) === "[]", JSON.stringify(f("stok ayam")));
}

console.log("\n=== C. Pertanyaan asli user tidak lagi jadi mode ringkasan ===");
{
  const ctx = makeCtx();
  const q = "periode tanggal 1-7 bulan Oktober dan November beda barang keluar terbanyak ada di apa?";
  const facts = vm.runInContext("_aiFacts_", ctx)(q, "");
  ok("mode = banding", facts.mode === "banding", facts.mode);
  ok("periode menyebut Okt & Nov", /Oktober 2026 vs November 2026/.test(facts.period), facts.period);
  ok("ada blok PERBANDINGAN", /PERBANDINGAN:/.test(facts.text));
  ok("total OUT kedua periode ada", /Total OUT: 101 → 67/.test(facts.text), facts.text.split("\n")[2]);
  ok("peringkat 1 Okt = Ayam Kampung 70", /Peringkat 1 keluar Oktober 2026: Ayam Kampung 70 EKOR/.test(facts.text), facts.text);
  ok("peringkat 1 Nov = Ayam Kampung 38", /Peringkat 1 keluar November 2026: Ayam Kampung 38 EKOR/.test(facts.text), facts.text);
  ok("barang baru Nov = Ikan Salmon", /Baru keluar November 2026 .*Ikan Salmon 8/.test(facts.text), facts.text.split("\n").pop());
  ok("barang hilang = Minyak Goreng", /Tidak keluar lagi November 2026: Minyak Goreng 11/.test(facts.text), facts.text);
  ok("ada note anti-tolak", /Jangan menolak/.test(facts.note || ""));
}

console.log("\n=== D. Satu bulan + rentang tanggal ===");
{
  const ctx = makeCtx();
  const facts = vm.runInContext("_aiFacts_", ctx)("barang keluar terbanyak tanggal 1-7 november", "");
  ok("mode = rentang", facts.mode === "rentang", facts.mode);
  ok("tidak ada blok perbandingan", !/PERBANDINGAN:/.test(facts.text));
  ok("menyebut 1-7 November 2026", /tanggal 1-7 November 2026/.test(facts.text), facts.text.split("\n")[0]);
  ok("top keluar = Ayam Kampung 38", /Ayam Kampung 38 EKOR/.test(facts.text), facts.text.split("\n")[2]);
}

console.log("\n=== E. Bulan yang tabnya belum ada ===");
{
  const ctx = makeCtx();
  const facts = vm.runInContext("_aiFacts_", ctx)("barang keluar terbanyak tanggal 1-7 oktober dan desember", "");
  ok("tetap menjawab, tidak error", facts.mode === "banding", facts.mode);
  ok("bilang Desember belum ada", /TIDAK ADA tab stok untuk bulan ini/.test(facts.text));
  ok("tetap menyertakan angka Oktober", /Oktober 2026: Ayam Kampung 70 EKOR/.test(facts.text));
}

console.log("\n=== G. 'bulan ini dan bulan lalu' = dua periode ===");
{
  const ctx = makeCtx();
  const f = q => vm.runInContext("_aiMonthsInQuestion_", ctx)(q).map(x => x.month);
  ok("'bulan ini dan bulan lalu' → [11,10]", JSON.stringify(f("lontong bulan ini dan bulan lalu")) === "[11,10]", JSON.stringify(f("lontong bulan ini dan bulan lalu")));
  ok("'bulan lalu dan bulan ini' → [10,11] (ikut urutan kalimat)", JSON.stringify(f("bulan lalu dan bulan ini")) === "[10,11]", JSON.stringify(f("bulan lalu dan bulan ini")));
  ok("'bulan ini' saja → [11]", JSON.stringify(f("stok bulan ini")) === "[11]", JSON.stringify(f("stok bulan ini")));
  ok("'bulan lalu' saja → [10]", JSON.stringify(f("stok bulan lalu")) === "[10]", JSON.stringify(f("stok bulan lalu")));

  const facts = vm.runInContext("_aiFacts_", ctx)("perbandingan lontong bulan ini dan bulan lalu", "");
  ok("pertanyaan lontong jadi mode banding", facts.mode === "banding", facts.mode);
  ok("blok perbandingan berisi kedua periode", /PERBANDINGAN: November 2026 vs Oktober 2026/.test(facts.text), facts.text.match(/PERBANDINGAN:[^\n]*/) || facts.text.slice(0, 200));
  ok("blok perbandingan menyebut barang tersering", /Ayam Kampung/.test(facts.text));
}

console.log("\n=== H. Katalog saat diminta daftar ===");
{
  const ctx = makeCtx();
  const facts = vm.runInContext("_aiFacts_", ctx)("sebutkan daftar semua barang", "");
  ok("daftar barang ikut di FAKTA", /DAFTAR BARANG LENGKAP/.test(facts.text), facts.text.slice(-200));
  ok("nama barang muncul", /Beras/.test(facts.text) && /Ayam Kampung/.test(facts.text));

  const facts2 = vm.runInContext("_aiFacts_", ctx)("stok ayam berapa", "");
  ok("pertanyaan biasa tidak memuat katalog penuh", !/DAFTAR BARANG LENGKAP/.test(facts2.text));
}

console.log("\n=== F. Prompt: aturan perbandingan masuk ===");
{
  const ctx = makeCtx();
  const facts = vm.runInContext("_aiFacts_", ctx)("periode tanggal 1-7 oktober dan november", "");
  const prompt = vm.runInContext("_aiPrompt_", ctx)(facts, "periode tanggal 1-7 oktober dan november", [], "");
  ok("izin perbandingan antar periode", /perbandingan antar tanggal\/bulan\/periode/.test(prompt));
  ok("aturan 12 perbandingan", /12\. Kalau FAKTA memuat blok PERBANDINGAN/.test(prompt));
  ok("aturan 13 rentang tanggal", /13\. Rentang tanggal/.test(prompt));
  ok("note 'jangan menolak' ikut ke prompt", /Jangan menolak/.test(prompt));
}

console.log(`\n${pass} lulus, ${fail} gagal`);
process.exit(fail ? 1 : 0);
