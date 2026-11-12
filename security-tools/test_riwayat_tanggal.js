/**
 * Regresi filter tanggal Riwayat.
 *
 * Gejala user: transaksi muncul di Beranda tetapi tab Riwayat kosong.
 * Beranda memakai `getTransactions()` (tanpa filter tanggal); Riwayat memakai
 * `getFilteredTransactions()` yang membandingkan `t.date` sebagai STRING.
 * Begitu tanggal berbentuk "2026-11-11T09:12:00" (ISO + jam), pembandingan
 * `date <= "2026-11-11"` jadi false karena "..." > "2026-11-11" secara leksikal
 * → semua baris hari itu terbuang.
 *
 * Jalankan: node security-tools/test_riwayat_tanggal.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("  ok  " + name); }
  else { fail++; console.log("  FAIL " + name + (extra === undefined ? "" : "  → " + JSON.stringify(extra))); }
}

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const a = html.indexOf("function _localYmd(");
const b = html.indexOf("function getStaffList(");
if (a < 0 || b < 0) { console.error("blok getFilteredTransactions tidak ditemukan"); process.exit(2); }
const block = html.slice(a, b);

function makeFilter(rows, todayIso) {
  const sandbox = {
    console, String, Array, JSON, Number, Object, Date, isNaN, parseInt,
    _transactions: rows,
    _deepClone: (o) => JSON.parse(JSON.stringify(o)),
    AuthService: { getAllUsers: () => [] }
  };
  vm.createContext(sandbox);
  // _localYmd + _txnDateIso ikut di dalam blok yang diekstrak

  vm.runInContext(block, sandbox);
  return (opts) => vm.runInContext("getFilteredTransactions(" + JSON.stringify(opts) + ")", sandbox);
}

const TODAY = "2026-11-11";
const YDAY = "2026-11-10";

console.log("\n=== 1. Semua bentuk tanggal hari ini harus ikut ===");
{
  const rows = [
    { id: "a", date: TODAY, time: "09:00:00", type: "OUT", staff: "Sari" },
    { id: "b", date: TODAY + "T09:12:00", type: "OUT", staff: "Sari" },
    { id: "c", date: TODAY + " 09:12:00", type: "IN", staff: "Ragil" },
    { id: "d", date: new Date(2026, 10, 11, 9, 12), type: "IN", staff: "Ragil" },
    { id: "e", date: "11/11/2026", type: "OUT", staff: "Sari" },
    { id: "f", date: TODAY + "T23:59:59.000Z", type: "SPOIL", staff: "Sari" }
  ];
  const f = makeFilter(rows, TODAY);
  const got = f({ startDate: TODAY, endDate: TODAY }).map(x => x.id).sort().join(",");
  ok("6 baris hari ini terbaca semua", got === "a,b,c,d,e,f", got);
}

console.log("\n=== 2. Tanggal lain tetap tersaring ===");
{
  const rows = [
    { id: "today", date: TODAY, type: "OUT", staff: "Sari" },
    { id: "yday", date: YDAY, type: "OUT", staff: "Sari" },
    { id: "older", date: "2026-10-05", type: "OUT", staff: "Sari" },
    { id: "ydayTime", date: YDAY + "T15:00:00", type: "OUT", staff: "Sari" }
  ];
  const f = makeFilter(rows, TODAY);
  const got = f({ startDate: TODAY, endDate: TODAY }).map(x => x.id).join(",");
  ok("hanya hari ini", got === "today", got);
  const all = f({ startDate: null, endDate: null }).map(x => x.id).sort().join(",");
  ok("preset Semua mengambil semua", all === "older,today,yday,ydayTime", all);
}

console.log("\n=== 3. Rentang tanggal ===");
{
  const rows = [
    { id: "1", date: "2026-11-01", type: "OUT" },
    { id: "2", date: "2026-11-05T10:00:00", type: "OUT" },
    { id: "3", date: "2026-11-09", type: "OUT" },
    { id: "4", date: "2026-11-12", type: "OUT" }
  ];
  const f = makeFilter(rows, TODAY);
  const got = f({ startDate: "2026-11-01", endDate: "2026-11-09" }).map(x => x.id).join(",");
  ok("1-9 Nov ikut, 12 Nov tidak", got === "1,2,3", got);
}

console.log("\n=== 4. Filter tipe & staf tetap jalan ===");
{
  const rows = [
    { id: "i1", date: TODAY, type: "IN", staff: "Ragil" },
    { id: "o1", date: TODAY, type: "OUT", staff: "Sari" },
    { id: "s1", date: TODAY, type: "SPOIL", staff: "Sari" }
  ];
  const f = makeFilter(rows, TODAY);
  ok("tipe IN", f({ type: "IN", startDate: TODAY, endDate: TODAY }).map(x => x.id).join(",") === "i1");
  ok("tipe SPOIL", f({ type: "SPOIL", startDate: TODAY, endDate: TODAY }).map(x => x.id).join(",") === "s1");
  ok("staf Sari", f({ staff: "Sari", startDate: TODAY, endDate: TODAY }).map(x => x.id).sort().join(",") === "o1,s1");
}

console.log("\n=== 5. Baris tanpa tanggal tidak meledak ===");
{
  const rows = [
    { id: "x", date: "", type: "OUT", staff: "Sari" },
    { id: "y", type: "OUT", staff: "Sari" },
    { id: "ok", date: TODAY, type: "OUT", staff: "Sari" }
  ];
  const f = makeFilter(rows, TODAY);
  let threw = "";
  let got = "";
  try { got = f({ startDate: TODAY, endDate: TODAY }).map(x => x.id).join(","); }
  catch (e) { threw = String(e.message || e); }
  ok("tidak error", !threw, threw);
  ok("baris valid tetap tampil", got === "ok", got);
}

console.log("\n" + (fail ? "ADA YANG GAGAL: " + pass + " lulus, " + fail + " gagal" : "SEMUA LULUS: " + pass + " lulus, 0 gagal"));
process.exit(fail ? 1 : 0);
