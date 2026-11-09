/* Uji: tambah barang baru tidak boleh menyuntik stok ke tab bulan lain. */
const fs = require("fs");
const vm = require("vm");

const src = fs.readFileSync("/home/xellium/rimba-stock/Code.gs", "utf8");
const calls = [];

const sb = {
  console: { log() {}, warn() {}, error() {} },
  SpreadsheetApp: { BorderStyle: { SOLID: "SOLID" } },
  Utilities: { formatDate: () => "2026-11-09 22:00:00" },
  PropertiesService: {},
  CacheService: {},
  ContentService: { MimeType: { JSON: "json" }, createTextOutput: (s) => ({ setMimeType: () => s }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) }
};
vm.createContext(sb);
vm.runInContext(src, sb);

function matrix(nr, nc, firstCol) {
  const rows = Math.max(1, nr || 1), cols = Math.max(1, nc || 1);
  const m = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ""));
  if (firstCol) m.forEach((r, i) => { r[0] = firstCol(i); });
  return m;
}
function fakeRange(nr, nc, firstCol) {
  const data = matrix(nr, nc, firstCol);
  const r = {
    getValues: () => data, getValue: () => data[0][0], getFormulaR1C1: () => "",
    getNumberFormat: () => '"Rp"#,##0',
    setValue: () => r, setValues: () => r, setFontSize: () => r, setFontFamily: () => r,
    setHorizontalAlignment: () => r, setVerticalAlignment: () => r, setNumberFormat: () => r,
    setFontWeight: () => r, setFontColor: () => r, setBackground: () => r, setBorder: () => r,
    clearContent: () => r, setFormulaR1C1: () => r, merge: () => r, copyTo: () => r
  };
  return r;
}
function sheet(name, rows, firstCol) {
  const s = {
    _n: name, _rows: rows,
    getName: () => s._n, setName: (v) => { s._n = v; return s; },
    getLastRow: () => s._rows, getLastColumn: () => 72,
    getRange: (row, col, nr, nc) => fakeRange(nr, nc, firstCol || (() => "")),
    appendRow: () => {}, setFrozenRows: () => {}, autoResizeColumns: () => {},
    insertColumnsAfter() {}, deleteColumns() {}, insertRowAfter() {}, insertRowBefore() {}, deleteRow() {},
    copyTo: () => sheet(name + " COPY", rows)
  };
  return s;
}

const nov = sheet("Nov 2026", 40, (i) => (i === 0 ? "Item" : ""));   // baris header + kosong
const okt = sheet("Okt 2026", 40, () => "");
const logSheet = sheet("MUTASI_APP", 3);
const sheets = [nov, okt, logSheet, sheet("DATA_PENGGUNA", 8), sheet("REKAP_SPOIL", 5)];
const ss = {
  getSheets: () => sheets,
  getActiveSheet: () => nov,
  getSheetByName: (n) => sheets.find((s) => s._n === n) || null,
  insertSheet: (n) => sheet(n, 1)
};
sb.SpreadsheetApp.getActiveSpreadsheet = () => ss;

// Spy: catat argumen ke insertItemAlphabetically
sb.insertItemAlphabetically = (target, item) => {
  calls.push({ target: target.getName(), stock: item.stock, name: item.name, division: item.division });
  return 20;
};

const res = JSON.parse(sb._realDoPost({
  postData: {
    contents: JSON.stringify({
      action: "addItem",
      name: "saus tiram baru",
      division: "KITCHEN",
      unit: "btl",
      price: 25000,
      stock: 12,
      staffName: "Admin"
    })
  }
}));

let pass = 0, fail = 0;
const eq = (l, g, w) => { const ok = JSON.stringify(g) === JSON.stringify(w); ok ? pass++ : fail++; console.log((ok ? "PASS" : "FAIL") + " · " + l + " → " + JSON.stringify(g) + (ok ? "" : " harap " + JSON.stringify(w))); };

console.log("respons:", res.message);
eq("respons sukses", res.success, true);
eq("dua tab disentuh", calls.length, 2);

const target = calls.find((c) => c.target === "Nov 2026");
const other = calls.find((c) => c.target === "Okt 2026");
eq("tab bulan aktif dapat stok awal 12", target && target.stock, 12);
eq("tab bulan lain dapat stok awal 0", other && other.stock, 0);
eq("nama dinormalisasi Title Case", target && target.name, "Saus Tiram Baru");

console.log("\n" + (fail === 0 ? "SEMUA LULUS" : "ADA YANG GAGAL") + `: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);