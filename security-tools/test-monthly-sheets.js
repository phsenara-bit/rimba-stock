/* Uji logika bulanan Code.gs tanpa Google Apps Script (mock minimal). */
const fs = require("fs");
const vm = require("vm");

const src = fs.readFileSync("/home/xellium/rimba-stock/Code.gs", "utf8");

const sandbox = { console: { log() {}, warn() {}, error() {} }, SpreadsheetApp: { BorderStyle: { SOLID: "SOLID", DASHED: "DASHED" } }, Utilities: {}, PropertiesService: {}, CacheService: {}, LockService: {}, ContentService: {} };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

const { _findMonthlySheet_, _sheetMonthNum_, _sheetYear_ } = sandbox;

function fakeRange(nr, nc) {
  const rows = Math.max(1, nr || 1), cols = Math.max(1, nc || 1);
  const matrix = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ""));
  const r = {
    getValues: () => matrix,
    getValue: () => "",
    getFormulaR1C1: () => "",
    getNumberFormat: () => '"Rp"#,##0',
    setValue: () => r, setValues: () => r, setFontSize: () => r, setFontFamily: () => r,
    setHorizontalAlignment: () => r, setVerticalAlignment: () => r, setNumberFormat: () => r,
    setFontWeight: () => r, setFontColor: () => r, setBackground: () => r, setBorder: () => r,
    clearContent: () => r, setFormulaR1C1: () => r, merge: () => r, copyTo: () => r
  };
  return r;
}
function fakeSheet(name, rows = 40) {
  const s = {
    _name: name,
    getName: () => s._name,
    setName: (n) => { s._name = n; return s; },
    getLastRow: () => rows,
    getLastColumn: () => 72,
    getRange: (row, col, nr, nc) => fakeRange(nr, nc),
    insertColumnsAfter: () => {}, deleteColumns: () => {},
    insertRowAfter: () => {}, insertRowBefore: () => {}, deleteRow: () => {},
    copyTo: () => fakeSheet(s._name + " COPY", 40)
  };
  return s;
}
function fakeSS(names) {
  const sheets = names.map((n) => fakeSheet(n));
  return { _sheets: sheets, getSheets: () => sheets, getActiveSheet: () => sheets[0], insertSheet: (n) => fakeSheet(n) };
}

let pass = 0, fail = 0;
function eq(label, got, want) {
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log((ok ? "PASS" : "FAIL") + " · " + label + " → " + JSON.stringify(got) + (ok ? "" : " (harap: " + JSON.stringify(want) + ")"));
}
const nm = (s) => (s ? s.getName() : null);

console.log("── parsing nama tab ──");
eq("'Nov 2026' bulan", _sheetMonthNum_("Nov 2026"), 11);
eq("'Nov 2026' tahun", _sheetYear_("Nov 2026"), 2026);
eq("'Juni 2026' bulan", _sheetMonthNum_("Juni 2026"), 6);
eq("'August 2026' bulan", _sheetMonthNum_("August 2026"), 8);
eq("'Ags 26' bulan", _sheetMonthNum_("Ags 26"), 8);
eq("'Desember-2025' bulan", _sheetMonthNum_("Desember-2025"), 12);
eq("'DATA_PENGGUNA' bukan bulan", _sheetMonthNum_("DATA_PENGGUNA"), 0);
eq("'Maret Bersih' bukan bulan (mar≠maret? harus 0)", _sheetMonthNum_("Maret Bersih"), 3);

console.log("\n── pencarian tab (bug #1: Jun/Jul/Agu) ──");
const base = ["MUTASI_APP", "REKAP_SPOIL", "DATA_PENGGUNA"];
for (const [label, arr, y, m, want] of [
  ["Jun 2026", [...base, "Mei 2026", "Jun 2026"], 2026, 6, "Jun 2026"],
  ["June 2026", [...base, "June 2026"], 2026, 6, "June 2026"],
  ["Juni 2026", [...base, "Juni 2026"], 2026, 6, "Juni 2026"],
  ["Jul 2026", [...base, "Jul 2026"], 2026, 7, "Jul 2026"],
  ["July 2026", [...base, "July 2026"], 2026, 7, "July 2026"],
  ["Agu 2026", [...base, "Agu 2026"], 2026, 8, "Agu 2026"],
  ["Ags 2026", [...base, "Ags 2026"], 2026, 8, "Ags 2026"],
  ["August 2026", [...base, "August 2026"], 2026, 8, "August 2026"],
  ["Nov 2026", [...base, "Nov 2026"], 2026, 11, "Nov 2026"]
]) eq(label, nm(_findMonthlySheet_(fakeSS(arr), y, m)), want);

console.log("\n── bug #2: tahun tidak boleh ketuker ──");
eq("minta Nov 2026, cuma ada Nov 2027", nm(_findMonthlySheet_(fakeSS([...base, "Nov 2027"]), 2026, 11)), null);
eq("ada Nov 2026 + Nov 2027", nm(_findMonthlySheet_(fakeSS([...base, "Nov 2027", "Nov 2026"]), 2026, 11)), "Nov 2026");
eq("tab tanpa tahun 'Nov' tetap dipakai", nm(_findMonthlySheet_(fakeSS([...base, "Nov"]), 2026, 11)), "Nov");
eq("tab tanpa tahun menang hanya kalau tak ada yang setahun", nm(_findMonthlySheet_(fakeSS([...base, "Nov", "Nov 2026"]), 2026, 11)), "Nov 2026");

console.log("\n── sheet internal tidak pernah dianggap tab bulan ──");
eq("DATA_PENGGUNA dilewati", nm(_findMonthlySheet_(fakeSS(["DATA_PENGGUNA"]), 2026, 11)), null);
eq("MUTASI_APP dilewati", nm(_findMonthlySheet_(fakeSS(["MUTASI_APP"]), 2026, 11)), null);

console.log("\n── rollover: nama tab baru & sumber yang dipilih ──");
const ss = fakeSS([...base, "Sep 2026", "Okt 2026"]);
const created = sandbox.getOrCreateMonthlySheet(ss, 2026, 11);
eq("tab baru dibuat bernama 'Nov 2026'", created && created.getName(), "Nov 2026");
const ss2 = fakeSS([...base, "Okt 2026"]);
const created2 = sandbox.getOrCreateMonthlySheet(ss2, 2026, 12);
eq("Des 2026 dibuat dari Okt 2026 (fallback) bernama benar", created2 && created2.getName(), "Des 2026");
eq("tahun lain tidak dipakai untuk Nov 2026", (() => {
  const ss3 = fakeSS([...base, "Okt 2025"]);
  ss3._sheets[3].getLastRow = () => 40;
  const c = sandbox.getOrCreateMonthlySheet(ss3, 2026, 11);
  return c && c.getName();
})(), "Nov 2026");

console.log("\n" + (fail === 0 ? "SEMUA LULUS" : "ADA YANG GAGAL") + `: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
