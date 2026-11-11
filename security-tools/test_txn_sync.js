/**
 * Uji sinkronisasi riwayat transaksi (backend + frontend).
 *
 * Backend : route readTransactions membaca MUTASI_APP, memetakan kolom ke bentuk
 *           transaksi app, mem-parse catatan "[SPOIL: ...]", dan memakai cache.
 * Frontend: _mergeTransactions menggabungkan riwayat server dengan cache lokal
 *           tanpa menghapus transaksi yang belum sempat dikirim (antrean offline).
 *
 * Jalankan: node security-tools/test_txn_sync.js
 */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  cond ? pass++ : fail++;
  console.log((cond ? "PASS" : "FAIL") + " · " + label + (cond ? "" : "  → " + JSON.stringify(extra)));
};

/* ══════════════════════════════════════════════════════════════════════
 * BAGIAN 1 — backend
 * ══════════════════════════════════════════════════════════════════════ */
const CODE = fs.readFileSync(path.join(ROOT, "Code.gs"), "utf8");

function bootBackend(opts) {
  const props = new Map(Object.entries((opts && opts.props) || {}));
  const store = new Map();
  const logRows = (opts && opts.logRows) || [];
  let uuid = 0;

  const cache = {
    get(k) { const e = store.get(k); return e ? e.v : null; },
    put(k, v, secs) { store.set(k, { v: v }); },
    remove(k) { store.delete(k); }
  };

  function range(row, col, nr, nc) {
    const r = Math.max(1, nr || 1), c = Math.max(1, nc || 1);
    const data = Array.from({ length: r }, () => Array.from({ length: c }, () => ""));
    if (row >= 2) {
      for (let i = 0; i < r; i++) {
        const src = logRows[row - 2 + i];
        if (!src) continue;
        for (let j = 0; j < Math.min(c, src.length); j++) data[i][j] = src[j];
      }
    }
    const o = {
      getValues: () => data,
      getValue: () => data[0][0],
      setValue(v) { data[0][0] = v; return o; },
      setValues() { return o; },
      setFontWeight() { return o; }, setFontColor() { return o; }, setBackground() { return o; },
      setFrozenRows() { return o; }, setBorder() { return o; }
    };
    return o;
  }

  const logSheet = {
    getName: () => "MUTASI_APP",
    getLastRow: () => logRows.length + 1,
    getRange: range,
    appendRow(r) { logRows.push(r); },
    setFrozenRows() {}
  };

  const ss = {
    getSheets: () => [logSheet],
    getActiveSheet: () => logSheet,
    getSheetByName: (n) => (n === "MUTASI_APP" ? logSheet : null),
    insertSheet: () => logSheet
  };

  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, BorderStyle: { SOLID: "SOLID" } },
    CacheService: { getScriptCache: () => cache },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: k => (props.has(k) ? props.get(k) : null),
        setProperty: (k, v) => props.set(k, v)
      })
    },
    Utilities: {
      getUuid: () => "uuid-" + (++uuid) + "-" + Math.random().toString(16).slice(2),
      formatDate: () => "2026-11-10 08:00:00"
    },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: s => ({ _s: s, setMimeType() { return this; }, getContent() { return this._s; } })
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    _store: store,
    _logRows: logRows,
    _props: props
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(CODE, ctx, { filename: "Code.gs" });
  return ctx;
}

const OWNER = { OWNER_USERNAME: "satian", OWNER_PIN: "9999", OWNER_NAME: "Owner" };
const LOG = [
  ["TXN-1", "2026-11-10 08:15:00", "KITCHEN", "Chef Rina", "15", "Ayam Kampung", "EKOR", "OUT", "12", "Pemakaian harian", "44000", "528000"],
  ["TXN-2", "2026-11-10 09:02:00", "KITCHEN", "Ragil", "15", "Ayam Kampung", "EKOR", "IN", "30", "", "44000", "1320000"],
  ["TXN-3", "2026-11-10 10:30:00", "BAR", "Doni", "40", "Blueband", "PCS", "SPOIL", "2,5", "[SPOIL: Basi / Busuk] ", "15000", "37500"]
];

console.log("\n=== Backend: readTransactions ===");
{
  const r = bootBackend({ props: OWNER, logRows: LOG });
  const out = JSON.parse(r._g2HandleReadTransactions({ parameter: {} }, { role: "staff" }).getContent());

  ok("success + count 3", out.success === true && out.count === 3, out.count);
  ok("urutan terbaru di atas", out.transactions[0].id === "TXN-3", out.transactions.map(t => t.id));
  ok("pemetaan kolom lengkap", (() => {
    const t = out.transactions[1];
    return t.itemName === "Ayam Kampung" && t.staff === "Ragil" && t.type === "IN" &&
      t.qty === 30 && t.unitPrice === 44000 && t.totalRupiah === 1320000;
  })(), out.transactions[1]);
  ok("date & time terpisah", out.transactions[1].date === "2026-11-10" && out.transactions[1].time === "09:02:00", out.transactions[1]);
  ok("koma desimal dibaca", out.transactions[0].qty === 2.5, out.transactions[0].qty);
  ok("catatan SPOIL dipisah", out.transactions[0].spoilReason === "Basi / Busuk" && out.transactions[0].notes === "", out.transactions[0]);
  ok("staf biasa boleh baca", true);
}

{
  const r = bootBackend({ props: OWNER, logRows: LOG });
  const first = r._g2HandleReadTransactions({ parameter: { limit: 2 } }, { role: "staff" });
  ok("limit 2 → 2 baris", JSON.parse(first.getContent()).count === 2, JSON.parse(first.getContent()).count);

  const r2 = bootBackend({ props: OWNER, logRows: LOG });
  r2._g2HandleReadTransactions({ parameter: { limit: 9999 } }, { role: "staff" });
  ok("limit dibatasi maksimum", r2._store.has("g2_txns_v1_2000") === true, [...r2._store.keys()]);
}

{
  const r = bootBackend({ props: OWNER, logRows: LOG });
  const t = JSON.parse(r._g2HandleReadTransactions({ parameter: {} }, { role: "staff" }).getContent());
  r._logRows.push(["TXN-4", "2026-11-10 11:00:00", "KITCHEN", "Rey", "16", "Ayam Fillet", "KG", "OUT", "3", "", "65000", "195000"]);
  const t2 = JSON.parse(r._g2HandleReadTransactions({ parameter: {} }, { role: "staff" }).getContent());
  ok("cache 60 detik dipakai (baris baru belum kelihatan)", t2.count === t.count, t2.count);
}

{
  const r = bootBackend({ props: OWNER, logRows: [] });
  const out = JSON.parse(r._g2HandleReadTransactions({ parameter: {} }, { role: "staff" }).getContent());
  ok("sheet kosong → sukses, 0 baris", out.success === true && out.count === 0, out);
}

/* ══════════════════════════════════════════════════════════════════════
 * BAGIAN 2 — frontend (_mergeTransactions)
 * ══════════════════════════════════════════════════════════════════════ */
console.log("\n=== Frontend: gabung riwayat lokal + server ===");
{
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const start = html.indexOf("const DataService = (() => {");
  const end = html.indexOf("\n})();", start);
  if (start < 0 || end < 0) { console.log("FAIL · blok DataService tidak ditemukan"); fail++; }
  else {
    const src = html.slice(start, end + 5);
    const store = {};
    const sandbox = {
      console: { log() {}, warn() {}, error() {} },
      window: {
        addEventListener() {},
        localStorage: {
          getItem: k => (k in store ? store[k] : null),
          setItem: (k, v) => { store[k] = String(v); },
          removeItem: k => { delete store[k]; }
        }
      },
      localStorage: {
        getItem: k => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: k => { delete store[k]; }
      },
      DEFAULT_CATALOG_ITEMS: [],
      AuthService: { getCurrentUser: () => null },
      document: { addEventListener() {}, hidden: false },
      fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    };
    sandbox.window.localStorage = sandbox.localStorage;
    const ctx = vm.createContext(sandbox);
    vm.runInContext(src + "\nthis.__ds = DataService;", ctx, { filename: "DataService.js" });
    const ds = ctx.__ds;

    const merge = ds._mergeTransactions;
    ok("fungsi merge tersedia", typeof merge === "function");

    // Kasus: lokal punya transaksi offline yang belum ada di server
    const lokal = [
      // catatan: "Chef Rina" sengaja difilter _loadData sebagai data contoh lama
      { id: "TXN-9", date: "2026-11-11", staff: "Rey", qty: 5, type: "OUT" },
      { id: "TXN-1", date: "2026-11-10", time: "08:15:00", staff: "Ragil", qty: 12, type: "OUT" }
    ];
    store["rimba_alam_transactions_v8"] = JSON.stringify(lokal);
    // muat ulang DataService dengan cache lokal
    const ctx2 = vm.createContext(Object.assign({}, sandbox, {}));
    vm.runInContext(src + "\nthis.__ds = DataService;", ctx2, { filename: "DataService.js" });
    const ds2 = ctx2.__ds;
    const added = ds2._mergeTransactions([
      { id: "TXN-1", date: "2026-11-10", time: "08:15:00", staff: "Chef Rina", qty: 12, type: "OUT" },
      { id: "TXN-2", date: "2026-11-10", time: "09:02:00", staff: "Ragil", qty: 30, type: "IN" }
    ]);
    const all = ds2.getTransactions(50);
    ok("transaksi server baru ditambah", added === 1, added);
    ok("transaksi offline lokal tidak hilang", all.some(t => t.id === "TXN-9"), all.map(t => t.id));
    ok("ID sama tidak diduplikasi", all.filter(t => t.id === "TXN-1").length === 1, all.map(t => t.id));
    ok("urutan terbaru di atas", all[0].id === "TXN-9", all.map(t => t.id));

    // Kasus urutan: transaksi lokal baru di hari yang sama dengan entri sheet
    // tidak boleh "turun" ke bawah entri sheet yang jamnya lebih pagi.
    const ctx3 = vm.createContext(Object.assign({}, sandbox, {}));
    vm.runInContext(src + "\nthis.__ds = DataService;", ctx3, { filename: "DataService.js" });
    const ds3 = ctx3.__ds;
    ds3._mergeTransactions([
      { id: "S-1", date: "2026-11-11", time: "09:00:00", staff: "Ragil", qty: 1, type: "OUT" },
      { id: "S-2", date: "2026-11-11", time: "08:00:00", staff: "Rey", qty: 1, type: "OUT" }
    ]);
    const urut = ds3.getTransactions(10).map(t => t.id);
    ok("entri lokal baru di atas entri sheet hari yang sama", urut[0] === "TXN-9", urut);
    ok("dua entri sheet tetap urut menurun", urut[1] === "S-1" && urut[2] === "S-2", urut);
  }
}

console.log("\n" + pass + " lulus, " + fail + " gagal");
process.exit(fail ? 1 : 0);
