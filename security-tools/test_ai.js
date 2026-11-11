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
  props.AI_KEY = "test-key";
  props.AI_PROVIDER = "gemini";
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
  ok("memuat daftar minus", /Barang stok MINUS \(stok di bawah 0\): 1 barang/.test(facts.text), facts.text.split("\n")[4]);
  ok("minus punya total qty & nilai", /total qty minus [0-9]/.test(facts.text) && /total nilai minus Rp/.test(facts.text));
  ok("ada daftar stok terbanyak", /5 stok TERBANYAK \(paling banyak\):/.test(facts.text));
  ok("ada daftar stok terendah", /5 stok TERENDAH \(paling sedikit\):/.test(facts.text));
  ok("memuat agregat divisi", /Divisi KITCHEN: 2 barang/.test(facts.text));
}

console.log("\n=== 3. Prompt: riwayat dibatasi 4 giliran ===");
{
  const ctx = makeCtx(buildFakeData());
  const facts = vm.runInContext("_aiFacts_", ctx)("stok ayam");
  const history = [];
  for (let i = 0; i < 10; i++) {
    history.push({ role: "user", text: "pertanyaan lama nomor " + i });
    history.push({ role: "model", text: "jawaban lama nomor " + i });
  }
  const prompt = vm.runInContext("_aiPrompt_", ctx)(facts, "kapan minusnya?", history, "Ayam Kampung");
  // 4 giliran terakhir = nomor 6..9; nomor 5 ke bawah dibuang
  ok("hanya 4 giliran terakhir ikut", /pertanyaan lama nomor 9/.test(prompt) && /pertanyaan lama nomor 6/.test(prompt) && !/pertanyaan lama nomor 5/.test(prompt));
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

  ctx.__props.AI_DAILY_LIMIT = "30";
  const user = { username: "chef", role: "admin" };
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
  const other = vm.runInContext("handleAskAI_", ctx)({ parameter: { q: "stok ayam" } }, { username: "barista", role: "admin" }, null);
  ok("user lain masih boleh", JSON.parse(other.getContent()).success === true);
}

console.log("\n=== 5. Cache jawaban identik ===");
{
  const ctx = makeCtx(buildFakeData());
  let calls = 0;
  vm.runInContext("_aiCall_ = function(p){ __hit = (typeof __hit==='number'?__hit:0)+1; return 'jawaban cache'; };", ctx);
  const user = { username: "admin", role: "admin" };
  const r1 = JSON.parse(vm.runInContext("handleAskAI_", ctx)({ parameter: { q: "stok ayam" } }, user, null).getContent());
  const r2 = JSON.parse(vm.runInContext("handleAskAI_", ctx)({ parameter: { q: "stok ayam" } }, user, null).getContent());
  ok("panggilan kedua ditandai cached", r2.cached === true, JSON.stringify(r2).slice(0, 100));
  ok("kedua jawaban sama", r1.answer === r2.answer);
}

console.log("\n=== 6. Guard input & error ===");
{
  const ctx = makeCtx(buildFakeData());
  vm.runInContext("_aiCall_ = function(p){ return 'x'; };", ctx);
  const empty = JSON.parse(vm.runInContext("handleAskAI_", ctx)({ parameter: { q: "" } }, { username: "a", role: "admin" }, null).getContent());
  ok("pertanyaan kosong ditolak", empty.success === false && empty.code === "EMPTY");

  const broken = makeCtx(buildFakeData());
  broken.handleReadMonthlySheetData = () => ({ getContent: () => JSON.stringify({ success: false, message: "Sheet hilang" }) });
  const err = JSON.parse(vm.runInContext("handleAskAI_", broken)({ parameter: { q: "stok ayam" } }, { username: "a", role: "admin" }, null).getContent());
  ok("sheet rusak → FAILED (pesan generik)", err.success === false && err.code === "FAILED", JSON.stringify(err));
  ok("tidak membocorkan detail internal", !/Sheet hilang/.test(err.message), err.message);
}

console.log("\n=== 7. Akses khusus admin ===");
{
  const ctx = makeCtx(buildFakeData());
  vm.runInContext("_aiCall_ = function(p){ return 'ok'; };", ctx);
  const deny = (u) => JSON.parse(vm.runInContext("handleAskAI_", ctx)({ parameter: { q: "stok ayam" } }, u, null).getContent());
  const staff = deny({ username: "chef", role: "staff" });
  ok("staff ditolak FORBIDDEN", staff.success === false && staff.code === "FORBIDDEN", JSON.stringify(staff));
  const noRole = deny({ username: "x" });
  ok("tanpa role ditolak", noRole.success === false && noRole.code === "FORBIDDEN");
  const adm = deny({ username: "adm", role: "admin" });
  ok("admin boleh", adm.success === true, JSON.stringify(adm).slice(0, 120));
  const su = deny({ username: "satian", role: "superadmin" });
  ok("superadmin boleh", su.success === true);
  const ow = deny({ username: "owner1", role: "owner" });
  ok("owner boleh", ow.success === true);
}

console.log("\n=== 8. Belum dikonfigurasi ===");
{
  const ctx = makeCtx(buildFakeData());
  delete ctx.__props.AI_KEY;
  const r = JSON.parse(vm.runInContext("handleAskAI_", ctx)({ parameter: { q: "stok ayam" } }, { username: "adm", role: "admin" }, null).getContent());
  ok("tanpa AI_KEY → NOT_CONFIGURED", r.success === false && r.code === "NOT_CONFIGURED", JSON.stringify(r));
}

console.log("\n=== 9. Kepribadian Mirim & penolakan topik lain ===");
{
  const ctx = makeCtx(buildFakeData());
  const facts = vm.runInContext("_aiFacts_", ctx)("kenapa ayam kampung minus?");
  const prompt = vm.runInContext("_aiPrompt_", ctx)(facts, "kenapa ayam kampung minus?", [], "Ayam Kampung");
  ok("nama Mirim ada di prompt", /Kamu Mirim/.test(prompt));
  ok("instruksi ceria", /ceria/.test(prompt) && /emoji/.test(prompt));
  ok("aturan tolak topik lain", /Hanya tolak yang benar-benar BUKAN soal stok/.test(prompt) && /di luar jangkauanku/.test(prompt));
  ok("aturan anti prompt-injection", /Bedakan 'di luar topik'/.test(prompt) && /datanya tidak ada di FAKTA/.test(prompt));
  ok("aturan sebut penginput", /siapa yang input/.test(prompt));
  ok("fakta memuat blok transaksi + penginput", /TRANSAKSI TERAKHIR/.test(facts.text));
  ok("fakta jujur saat catatan kosong", /TIDAK ADA CATATAN ALASAN|Tidak ada catatan transaksi/.test(facts.text), facts.text.slice(0, 160));
}

console.log("\n=== 10. Log mutasi (pembaca MUTASI_APP) ===");
{
  const vm2 = require("vm");
  const ctx = makeCtx(buildFakeData());
  const rows = [
    ["TXN-1", "2026-11-08 09:12:00", "KITCHEN", "Sari", "15", "Ayam Kampung", "EKOR", "IN", 10, "beli pasar", 44000, 440000],
    ["TXN-2", "2026-11-08 14:30:00", "KITCHEN", "Budi", "15", "Ayam Kampung", "EKOR", "OUT", 15, "", 44000, 660000],
    ["TXN-3", "2026-11-08 15:00:00", "BAR", "Dewi", "55", "Soda Gembira", "PCS", "OUT", 2, "rusak", 8000, 16000],
  ];
  const sheet = {
    getLastRow: () => rows.length + 1,
    getRange: (r, c, nr, nc) => ({ getValues: () => rows.slice(Math.max(0, r - 2), Math.max(0, r - 2) + nr) })
  };
  ctx.SpreadsheetApp = { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet }) };
  vm2.runInContext("SpreadsheetApp = __ss;", Object.assign(ctx, { __ss: ctx.SpreadsheetApp }));
  const got = vm2.runInContext("_aiMutasi_", ctx)("Ayam Kampung", 12);
  ok("hanya barang yang diminta", got.length === 2 && got.every(x => x.barang === "Ayam Kampung"), JSON.stringify(got).slice(0, 120));
  ok("nama penginput terbaca", got.map(x => x.staf).join(",") === "Budi,Sari", got.map(x => x.staf).join(","));
  const txt = vm2.runInContext("_aiMutasiText_", ctx)(got);
  ok("teks menandai catatan kosong", /TIDAK ADA CATATAN ALASAN/.test(txt), txt.slice(0, 120));
  ok("teks menyebut penginput", /diinput oleh: Budi/.test(txt));
}

console.log("\n=== 11. Pilihan periode (bulan lain) ===");
{
  const ctx = makeCtx(buildFakeData());
  const tm = (q) => vm.runInContext("_aiTargetMonth_", ctx)(q);
  const nowM = new Date().getMonth() + 1, nowY = new Date().getFullYear();

  const okt = tm("stok oktober gimana?");
  ok("nama bulan dikenali", okt.month === 10 && okt.year === nowY && okt.explicit === true, JSON.stringify(okt));
  const okt25 = tm("kenapa minus oktober 2025");
  ok("tahun eksplisit dipakai", okt25.month === 10 && okt25.year === 2025, JSON.stringify(okt25));
  const prev = tm("ringkas stok bulan lalu");
  ok("bulan lalu dihitung benar", prev.month === (nowM === 1 ? 12 : nowM - 1) && prev.explicit === true, JSON.stringify(prev));
  const def = tm("stok ayam berapa?");
  ok("tanpa nama bulan = bulan ini", def.month === nowM && def.year === nowY && def.explicit === false, JSON.stringify(def));

  // bulan lain yang tabnya tidak ada → mode kosong, jujur, tanpa angka bulan ini
  const facts = vm.runInContext("_aiFacts_", ctx)("stok desember 2019 masih ada?");
  ok("periode tanpa tab → mode kosong", facts.mode === "kosong", JSON.stringify(facts).slice(0, 150));
  ok("periode kosong tidak memakai angka bulan ini", !/Nilai stok \(aset\)/.test(facts.text) && /belum ada/.test(facts.text), facts.text.slice(0, 120));
  ok("label periode benar", /Desember 2019/.test(facts.period), facts.period);
}

console.log("\n───────────────────────────────");
console.log((fail === 0 ? "SEMUA LULUS" : "ADA YANG GAGAL") + ": " + pass + " lulus, " + fail + " gagal");
process.exit(fail === 0 ? 0 : 1);
