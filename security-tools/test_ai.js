/**
 * Test harness untuk BAGIAN 3 (Asisten AI) di Code.gs.
 * Memuat Code.gs ke sandbox vm dengan mock Google Apps Script.
 * Jalankan: node security-tools/test_ai.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const CODE = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");

// ── Mock spreadsheet response (bentuk sama dengan handleReadMonthlySheetData) ──
function buildFakeData() {
  return {
    success: true,
    sheetName: "Nov 2026",
    year: 2026,
    month: 11,
    dayToDate: 8,
    stats: {
      totalItems: 4,
      totalNilaiStokAset: 12500000,
      totalRupiahMasuk: 2000000,
      totalRupiahKeluar: 4500000,
      totalInQty: 30,
      totalOutQty: 108
    },
    items: [
      {
        id: 15, name: "Ayam Kampung", division: "KITCHEN", unit: "EKOR", price: 44000,
        stock: -53, stokAwal: 25, inQtyMonth: 30, outQtyMonth: 108, minStock: 2,
        dailyHistory: {
          1: { in: 0, out: 12 }, 2: { in: 0, out: 15 }, 3: { in: 10, out: 8 },
          4: { in: 0, out: 14 }, 5: { in: 0, out: 11 }, 6: { in: 20, out: 9 },
          7: { in: 0, out: 13 }, 8: { in: 0, out: 16 }
        }
      },
      {
        id: 16, name: "Ayam Fillet", division: "KITCHEN", unit: "KG", price: 65000,
        stock: 4.5, stokAwal: 3, inQtyMonth: 5, outQtyMonth: 3.5, minStock: 2,
        dailyHistory: { 3: { in: 5, out: 0 }, 6: { in: 0, out: 2 }, 8: { in: 0, out: 1.5 } }
      },
      {
        id: 40, name: "Blueband Margarine", division: "PASTRY", unit: "PCS", price: 15000,
        stock: 0, stokAwal: 2, inQtyMonth: 0, outQtyMonth: 2, minStock: 2,
        dailyHistory: { 2: { in: 0, out: 1 }, 5: { in: 0, out: 1 } }
      },
      {
        id: 55, name: "Soda Gembira", division: "LAINNYA", unit: "PCS", price: 8000,
        stock: 12, stokAwal: 12, inQtyMonth: 0, outQtyMonth: 0, minStock: 2,
        dailyHistory: {}
      }
    ]
  };
}

function makeCtx(fakeData) {
  const props = {};
  const cache = {};

  const sandbox = {
    console: { log: () => {}, error: () => {}, warn: () => {} },
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
        getProperty: (k) => (k in props ? props[k] : null),
        setProperty: (k, v) => { props[k] = v; },
        deleteProperty: (k) => { delete props[k]; }
      })
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (k in cache ? cache[k] : null),
        put: (k, v) => { cache[k] = v; },
        remove: (k) => { delete cache[k]; }
      })
    },
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput: (s) => ({ _c: s, getContent: () => s, setMimeType() { return this; } })
    },
    UrlFetchApp: {
      fetch: () => { throw new Error("UrlFetchApp tidak diharapkan dipanggil di test ini"); }
    },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({}) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }
  };

  const ctx = vm.createContext(sandbox);
  vm.runInContext(CODE, ctx, { filename: "Code.gs" });

  // Override pembaca sheet + pemanggil model
  ctx.handleReadMonthlySheetData = () => ({
    getContent: () => JSON.stringify(fakeData)
  });
  ctx.__props = props;
  return ctx;
}

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("  ok  " + name); }
  else { fail++; console.log("  FAIL " + name + (extra ? "  → " + extra : "")); }
}

console.log("\n=== 1. Diagnosa & pencarian barang ===");
{
  const ctx = makeCtx(buildFakeData());
  const data = JSON.parse(ctx.handleReadMonthlySheetData().getContent());

  const found = vm.runInContext("_aiFindItems_", ctx)(data, "kenapa ayam kampung minus?");
  ok("pertanyaan 'ayam kampung' menemukan 1-3 barang", found.length >= 1 && found.length <= 3, "dapat " + found.length);
  ok("barang teratas = Ayam Kampung", found[0] && found[0].name === "Ayam Kampung", found[0] && found[0].name);

  const dg = vm.runInContext("_aiDiagnose_", ctx)(found[0], 8);
  ok("mulai minus tanggal 2", dg.firstNegative === 2, String(dg.firstNegative));
  ok("tanggal pembelian 3(10) dan 6(20)", dg.buyDays.join(",") === "3(10),6(20)", dg.buyDays.join(","));
  ok("teks diagnosa menyebut MINUS", /MINUS/.test(dg.text));
  ok("teks diagnosa menyebut pembelian", /pembelian \(IN\): 3\(10\), 6\(20\)/.test(dg.text), dg.text.split("\n")[4]);

  const facts = vm.runInContext("_aiFacts_", ctx)("kenapa ayam kampung minus?");
  ok("mode = item", facts.mode === "item", facts.mode);
  ok("topic = Ayam Kampung", facts.topic === "Ayam Kampung", facts.topic);
  ok("fakta memuat 'Mulai minus pada: tanggal 2'", /Mulai minus pada: tanggal 2/.test(facts.text));
  ok("fakta mendeteksi nama mirip (Ayam Fillet)", /Ayam Fillet/.test(facts.text));
}

console.log("\n=== 2. Mode ringkasan (pertanyaan umum) ===");
{
  const ctx = makeCtx(buildFakeData());
  const facts = vm.runInContext("_aiFacts_", ctx)("barang apa yang kritis dan berapa nilai stok bulan ini");
  ok("mode = ringkasan", facts.mode === "ringkasan", facts.mode);
  ok("memuat nilai aset", /Nilai stok \(aset\): Rp12\.500\.000/.test(facts.text), facts.text);
  ok("memuat daftar minus", /Barang stok MINUS: 1/.test(facts.text), facts.text.split("\n")[4]);
  ok("memuat agregat divisi", /Divisi KITCHEN: 2 barang/.test(facts.text));
}

console.log("\n=== 3. Prompt: riwayat dibatasi 2 giliran ===");
{
  const ctx = makeCtx(buildFakeData());
  const facts = vm.runInContext("_aiFacts_", ctx)("stok ayam");
  const history = [];
  for (let i = 0; i < 10; i++) {
    history.push({ role: "user", text: "pertanyaan lama nomor " + i });
    history.push({ role: "model", text: "jawaban lama nomor " + i });
  }
  const prompt = vm.runInContext("_aiPrompt_", ctx)(facts, "kapan minusnya?", history, "Ayam Kampung");
  ok("hanya 2 giliran terakhir ikut", /pertanyaan lama nomor 9/.test(prompt) && !/pertanyaan lama nomor 7/.test(prompt));
  ok("ada blok topik", /Topik yang sedang dibahas: Ayam Kampung/.test(prompt));
  ok("ada aturan anti-ngarang", /Dilarang mengarang angka/.test(prompt));
}

console.log("\n=== 4. Kuota harian ===");
{
  const ctx = makeCtx(buildFakeData());
  ctx._aiCall_ = () => "jawaban uji";
  vm.runInContext("_aiCall_", ctx);
  // paksa _aiCall_ versi mock di scope sandbox
  const sandbox = ctx;
  sandbox.__mock = "jawaban uji";
  vm.runInContext("_aiCall_ = function(p){ return 'jawaban uji'; };", ctx);

  const user = { username: "chef" };
  const call = (q) => {
    const r = vm.runInContext("handleAskAI_", ctx)({ parameter: { q: q } }, user, null);
    return JSON.parse(r.getContent());
  };

  const first = call("stok ayam berapa");
  ok("panggilan pertama sukses", first.success === true, JSON.stringify(first).slice(0, 120));
  ok("ada answer", typeof first.answer === "string" && first.answer.length > 0);
  ok("meta.used = 1", first.meta && first.meta.used === 1, JSON.stringify(first.meta));

  // habiskan kuota
  for (let i = 0; i < 30; i++) call("pertanyaan lain " + i);
  const blocked = call("pertanyaan ke-32");
  ok("setelah batas → QUOTA", blocked.success === false && blocked.code === "QUOTA", JSON.stringify(blocked));

  // user lain punya kuota sendiri
  const other = vm.runInContext("handleAskAI_", ctx)({ parameter: { q: "stok ayam" } }, { username: "barista" }, null);
  ok("user lain masih boleh", JSON.parse(other.getContent()).success === true);
}

console.log("\n=== 5. Cache jawaban identik ===");
{
  const ctx = makeCtx(buildFakeData());
  let calls = 0;
  vm.runInContext("_aiCall_ = function(p){ __hit = (typeof __hit==='number'?__hit:0)+1; return 'jawaban cache'; };", ctx);
  const user = { username: "admin" };
  const r1 = JSON.parse(vm.runInContext("handleAskAI_", ctx)({ parameter: { q: "stok ayam" } }, user, null).getContent());
  const r2 = JSON.parse(vm.runInContext("handleAskAI_", ctx)({ parameter: { q: "stok ayam" } }, user, null).getContent());
  ok("panggilan kedua ditandai cached", r2.cached === true, JSON.stringify(r2).slice(0, 100));
  ok("kedua jawaban sama", r1.answer === r2.answer);
}

console.log("\n=== 6. Guard input & error ===");
{
  const ctx = makeCtx(buildFakeData());
  vm.runInContext("_aiCall_ = function(p){ return 'x'; };", ctx);
  const empty = JSON.parse(vm.runInContext("handleAskAI_", ctx)({ parameter: { q: "" } }, { username: "a" }, null).getContent());
  ok("pertanyaan kosong ditolak", empty.success === false && empty.code === "EMPTY");

  const broken = makeCtx(buildFakeData());
  broken.handleReadMonthlySheetData = () => ({ getContent: () => JSON.stringify({ success: false, message: "Sheet hilang" }) });
  const err = JSON.parse(vm.runInContext("handleAskAI_", broken)({ parameter: { q: "stok ayam" } }, { username: "a" }, null).getContent());
  ok("sheet rusak → FAILED (pesan generik)", err.success === false && err.code === "FAILED", JSON.stringify(err));
  ok("tidak membocorkan detail internal", !/Sheet hilang/.test(err.message), err.message);
}

console.log("\n───────────────────────────────");
console.log((fail === 0 ? "SEMUA LULUS" : "ADA YANG GAGAL") + ": " + pass + " lulus, " + fail + " gagal");
process.exit(fail === 0 ? 0 : 1);
