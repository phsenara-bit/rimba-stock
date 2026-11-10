// Uji Code.gs gabungan (gate + v3.2) di Node dengan stub Apps Script.
// Tujuan: buktikan satu file yang ditempel benar-benar jalan, bukan cuma "parsing OK".
const fs = require("fs");
const vm = require("vm");

const CODE = fs.readFileSync("Code.gs", "utf8");

const USERS = [
  ["admin", "Admin Rimba Alam", "'1212", "KITCHEN, BAR", "superadmin", "x", "2026-01-01"],
  ["ragil", "Ragil", 5678, "KITCHEN", "admin", "x", "2026-01-01"],
  ["chef", "Chef Rina", "'9999", "KITCHEN", "staff", "x", "2026-01-01"],
];

function makeSheet(rows) {
  const writes = [];
  const sheet = {
    __writes: writes,
    getName: () => "DATA_PENGGUNA",
    getLastRow: () => rows.length + 1, // +1 header
    getLastColumn: () => 7,
    getRange(r, c, nr, nc) {
      const nRows = nr === undefined ? 1 : nr;
      const nCols = nc === undefined ? 1 : nc;
      const start = Math.max(0, r - 2); // baris 2 = data[0]
      const slice = rows.slice(start, start + nRows).map((row) => row.slice(c - 1, c - 1 + nCols));
      const api = {
        getValues: () => slice,
        getValue: () => (slice[0] ? slice[0][0] : ""),
        setValue: (v) => {
          writes.push({ r, c, v });
          return api;
        },
        setValues: () => api,
        setFontSize: () => api,
        setFontFamily: () => api,
        setHorizontalAlignment: () => api,
        setBorder: () => api,
        setNumberFormat: () => api,
        getNumberFormat: () => '"Rp"#,##0',
        getFormulaR1C1: () => "",
        clearContent: () => api,
        setBackground: () => api,
        setFontColor: () => api,
        setFontWeight: () => api,
        merge: () => api,
        copyTo: () => api,
      };
      return api;
    },
    appendRow: (row) => writes.push({ append: row }),
    setFrozenRows: () => {},
    setRowHeight: () => {},
    autoResizeColumns: () => {},
  };
  return sheet;
}

function makeCtx(props = {}) {
  const cache = new Map();
  const usersSheet = makeSheet(USERS);
  const ss = {
    getSheetByName: (n) => (n === "DATA_PENGGUNA" ? usersSheet : null),
    insertSheet: () => usersSheet,
    getSheets: () => [usersSheet],
    getActiveSheet: () => usersSheet,
  };
  const ctx = {
    console: { log() {}, warn() {} },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss,
      BorderStyle: { SOLID: "SOLID" },
      CopyPasteType: { PASTE_FORMAT: "PASTE_FORMAT" },
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (cache.has(k) ? cache.get(k) : null),
        put: (k, v) => cache.set(k, v),
        remove: (k) => cache.delete(k),
      }),
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null) }) },
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput(t) {
        const o = { text: t };
        o.setMimeType = () => o;
        return o;
      },
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    Utilities: { formatDate: () => "2026-01-01" },
    __usersSheet: usersSheet,
  };
  vm.createContext(ctx);
  vm.runInContext(CODE, ctx, { filename: "Code.gs" });
  return ctx;
}

const results = [];
const check = (n, c, x = "") => results.push([c ? "PASS" : "FAIL", n, x]);
const body = (o) => ({ parameter: {}, postData: { contents: JSON.stringify(o) } });
const parse = (r) => (r && r.text ? JSON.parse(r.text) : r);

// ── 1. Struktur file
check("hanya satu doGet", (CODE.match(/\nfunction doGet\(/g) || []).length === 1);
check("hanya satu doPost", (CODE.match(/\nfunction doPost\(/g) || []).length === 1);
check("handler lama ter-rename", CODE.includes("function _realDoGet(") && CODE.includes("function _realDoPost("));

// ── 2. Gate menolak tanpa kredensial
let ctx = makeCtx();
let r = parse(ctx.doPost(body({ type: "IN", qty: 5 })));
check("tanpa kredensial ditolak", r.success === false && r.code === "UNAUTHORIZED", JSON.stringify(r));

r = parse(ctx.doPost(body({ authUser: "chef", authPin: "0000", type: "IN" })));
check("PIN salah ditolak", r.code === "UNAUTHORIZED");

// ── 3. Kredensial benar menembus ke kode v3.2 yang asli
ctx = makeCtx();
r = parse(ctx.doPost(body({ authUser: "chef", authPin: "9999", action: "updateUserPin", username: "chef", pin: "4444" })));
check("PIN benar -> handler v3.2 jalan (updateUserPin)", r.success === true && /berhasil diupdate di sheet/.test(r.message), JSON.stringify(r));
const wrote = ctx.__usersSheet.__writes.find((w) => w.c === 3);
check("PIN baru benar-benar ditulis ke kolom 3", !!wrote && wrote.v === "'4444", JSON.stringify(wrote));

// ── 4. Hak akses
ctx = makeCtx();
r = parse(ctx.doPost(body({ authUser: "chef", authPin: "9999", action: "deleteUser", username: "ragil" })));
check("staff tidak boleh deleteUser", r.code === "FORBIDDEN");

r = parse(ctx.doPost(body({ authUser: "ragil", authPin: "5678", action: "deleteUser", username: "chef" })));
check("admin boleh deleteUser (sampai ke v3.2)", r.success === true || r.code === undefined, JSON.stringify(r));

// ── 5. GET baca data lewat handler v3.2
ctx = makeCtx();
r = parse(ctx.doGet({ parameter: { action: "readUsers", authUser: "admin", authPin: "1212" } }));
check("readUsers jalan dengan kredensial", r.success === true && r.count === 3, JSON.stringify(r).slice(0, 120));
check("PIN satian (1212) milik admin masih cocok", r.users[0].username === "admin");

ctx = makeCtx();
r = parse(ctx.doGet({ parameter: { action: "readUsers" } }));
check("readUsers tanpa kredensial ditolak", r.code === "UNAUTHORIZED");

// ── 6. Lockout
ctx = makeCtx();
for (let i = 0; i < 10; i++) ctx.doPost(body({ authUser: "chef", authPin: "0000" }));
r = parse(ctx.doPost(body({ authUser: "chef", authPin: "9999", type: "IN" })));
check("akun terkunci setelah 10x salah", r.code === "LOCKED", JSON.stringify(r));

// ── 7. Owner opsional
ctx = makeCtx({ OWNER_USERNAME: "satian", OWNER_PIN: "777777" });
r = parse(ctx.doPost(body({ authUser: "satian", authPin: "777777", action: "updateUserPin", username: "chef", pin: "2222" })));
check("owner dari Script Property diterima", r.success === true, JSON.stringify(r));

ctx = makeCtx();
r = parse(ctx.doPost(body({ authUser: "satian", authPin: "1212", action: "updateUserPin", username: "chef", pin: "2222" })));
check("satian ditolak kalau properti kosong", r.code === "UNAUTHORIZED");

let fails = 0;
for (const [st, n, x] of results) {
  if (st === "FAIL") fails++;
  console.log(st.padEnd(5), n, st === "FAIL" ? "-> " + x : "");
}
console.log(`\n${results.length - fails}/${results.length} lolos`);
process.exit(fails ? 1 : 0);
