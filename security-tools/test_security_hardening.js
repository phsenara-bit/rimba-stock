/* Uji pengerasan keamanan v4.1:
 *   - identitas audit dari sesi (bukan body klien)
 *   - staf tidak bisa melabeli divisi lain
 *   - bootstrap owner satian/1234 dihapus (fail closed)
 *   - PIN default 1234 dihapus dari saveUser
 *   - pencabutan sesi saat PIN/role berubah
 *   - throttle login gabungan
 * Jalankan: node security-tools/test_security_hardening.js
 */
const fs = require("fs");
const vm = require("vm");

const src = fs.readFileSync("/home/xellium/rimba-stock/Code.gs", "utf8");

function makeRuntime(opts) {
  const t = (opts && opts.now) || 1700000000;
  const store = new Map();
  const props = new Map(Object.entries((opts && opts.props) || {}));
  let uuid = 0;

  const cache = {
    get(k) {
      const e = store.get(k);
      if (!e) return null;
      if (e.exp && e.exp < t) { store.delete(k); return null; }
      return e.v;
    },
    put(k, v, secs) { store.set(k, { v: v, exp: t + (secs || 600) }); },
    remove(k) { store.delete(k); }
  };

  const usersRows = (opts && opts.users) || [
    ["admin", "Admin Rimba Alam", "1234", "KITCHEN, BAR, PASTRY, LAINNYA", "superadmin", "👔", "2026-01-01"],
    ["ragil", "Ragil", "2468", "KITCHEN, BAR", "admin", "👨‍💼", "2026-01-01"],
    ["chef", "Chef Rina", "9999", "KITCHEN", "staff", "🍳", "2026-01-01"]
  ];

  function range(row, col, nr, nc) {
    const r = Math.max(1, nr || 1), c = Math.max(1, nc || 1);
    const data = Array.from({ length: r }, () => Array.from({ length: c }, () => ""));
    if (row === 2 && col === 1) {
      for (let i = 0; i < Math.min(r, usersRows.length); i++) {
        for (let j = 0; j < Math.min(c, 7); j++) data[i][j] = usersRows[i][j];
      }
    }
    const write = (rIdx, cIdx, val) => {
      const ri = (row || 1) + rIdx - 2;
      const ci = (col || 1) + cIdx - 1;
      if (ri >= 0 && usersRows[ri] && ci >= 0) usersRows[ri][ci] = val;
    };
    const o = {
      getValues: () => data,
      getValue: () => data[0][0],
      setValue(v) { data[0][0] = v; write(0, 0, v); return o; },
      setValues(vals) { (vals || []).forEach((rr, i) => (rr || []).forEach((vv, j) => write(i, j, vv))); return o; },
      setFontSize() { return o; }, setFontFamily() { return o; }, setHorizontalAlignment() { return o; },
      setNumberFormat() { return o; }, setFontWeight() { return o; }, setFontColor() { return o; },
      setBackground() { return o; }, setBorder() { return o; }, clearContent() { return o; },
      getFormulaR1C1: () => "", setFormulaR1C1() { return o; }, merge() { return o; }, copyTo() { return o; },
      getNumberFormat: () => '"Rp"#,##0'
    };
    return o;
  }

  const usersSheet = {
    getName: () => "DATA_PENGGUNA",
    getLastRow: () => usersRows.length + 1,
    getLastColumn: () => 7,
    getRange: range,
    appendRow: (r) => usersRows.push(r),
    deleteRow: (i) => usersRows.splice(i - 2, 1),
    setFrozenRows() {}, setRowHeight() {}, autoResizeColumns() {},
    _rows: usersRows
  };

  const ss = {
    getSheets: () => [usersSheet],
    getActiveSheet: () => usersSheet,
    getSheetByName: (n) => (n === "DATA_PENGGUNA" ? usersSheet : null),
    insertSheet: () => usersSheet
  };

  return {
    sandbox: {
      console: { log() {}, warn() {}, error() {} },
      SpreadsheetApp: { getActiveSpreadsheet: () => ss, BorderStyle: { SOLID: "SOLID" } },
      CacheService: { getScriptCache: () => cache },
      PropertiesService: {
        getScriptProperties: () => ({
          getProperty: (k) => (props.has(k) ? props.get(k) : null),
          setProperty: (k, v) => props.set(k, v)
        })
      },
      Utilities: {
        getUuid: () => "uuid-" + (++uuid) + "-" + Math.random().toString(16).slice(2),
        formatDate: () => "2026-11-10 08:00:00"
      },
      ContentService: {
        MimeType: { JSON: "json" },
        createTextOutput: (s) => ({ _s: s, setMimeType() { return this; }, getContent() { return this._s; } })
      },
      LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
      _usersRows: usersRows,
      _cache: store,
      _props: props
    },
    usersRows: usersRows
  };
}

function boot(opts) {
  const rt = makeRuntime(opts);
  vm.createContext(rt.sandbox);
  vm.runInContext(src, rt.sandbox);
  return rt;
}

const call = (r, fn, e) => JSON.parse(r.sandbox[fn](e).getContent());
const get = (r, params) => call(r, "doGet", { parameter: params || {} });
const post = (r, body) => call(r, "doPost", { postData: { contents: JSON.stringify(body) } });

let pass = 0, fail = 0;
function ok(label, cond, extra) {
  cond ? pass++ : fail++;
  console.log((cond ? "PASS" : "FAIL") + " · " + label + (cond ? "" : "  → " + JSON.stringify(extra)));
}

const OWNER = { OWNER_USERNAME: "satian", OWNER_PIN: "9999", OWNER_NAME: "Owner" };

/* ── 1. Identitas audit dari sesi ─────────────────────────────────────── */
{
  const r = boot({ props: OWNER });
  let captured = null;
  r.sandbox._realDoPost = (e) => {
    captured = JSON.parse(e.postData.contents);
    return { getContent: () => '{"success":true}' };
  };

  const tok = post(r, { action: "login", username: "ragil", pin: "2468" }).token;
  post(r, {
    authToken: tok, staffName: "Chef Rina", adminName: "Chef Rina",
    division: "PASTRY", itemName: "Ayam", type: "OUT", qty: 5
  });

  ok("staffName palsu ditimpa nama sesi", captured && captured.staffName === "Ragil", captured && captured.staffName);
  ok("adminName palsu ditimpa nama sesi", captured && captured.adminName === "Ragil", captured && captured.adminName);
  ok("token tidak ikut terbawa ke mutasi", captured && !captured.authToken, captured && captured.authToken);
}

/* ── 2. Staf tidak bisa pindah divisi ────────────────────────────────── */
{
  const r = boot({ props: OWNER });
  let captured = null;
  r.sandbox._realDoPost = (e) => {
    captured = JSON.parse(e.postData.contents);
    return { getContent: () => '{"success":true}' };
  };

  const tok = post(r, { action: "login", username: "chef", pin: "9999" }).token;
  post(r, { authToken: tok, division: "BAR", itemName: "Ayam", type: "OUT", qty: 1 });
  ok("divisi staf dipaksa ke divisinya sendiri", captured && captured.division === "KITCHEN", captured && captured.division);

  const r2 = boot({ props: OWNER });
  let cap2 = null;
  r2.sandbox._realDoPost = (e) => { cap2 = JSON.parse(e.postData.contents); return { getContent: () => '{"success":true}' }; };
  const tok2 = post(r2, { action: "login", username: "ragil", pin: "2468" }).token;
  post(r2, { authToken: tok2, division: "PASTRY", itemName: "Ayam", type: "OUT", qty: 1 });
  ok("admin boleh divisi lain", cap2 && cap2.division === "PASTRY", cap2 && cap2.division);
}

/* ── 3. Bootstrap owner satian/1234 dihapus ──────────────────────────── */
{
  const r = boot({ props: OWNER });
  const wrong = post(r, { action: "login", username: "satian", pin: "1234" });
  ok("owner PIN 1234 ditolak walau OWNER_PIN terisi", wrong.code === "UNAUTHORIZED" && !wrong.token, wrong);

  const right = post(r, { action: "login", username: "satian", pin: "9999" });
  ok("owner masuk dengan PIN dari properti", right.success === true && !!right.token, right);

  const r2 = boot({ props: {} });
  const noOwner = post(r2, { action: "login", username: "satian", pin: "1234" });
  ok("OWNER_PIN kosong → owner TIDAK bisa masuk (fail closed)", noOwner.code === "UNAUTHORIZED", noOwner);
  ok("properti OWNER_PIN tidak ditulis oleh fallback", r2.sandbox._props.has("OWNER_PIN") === false, [...r2.sandbox._props.keys()]);
}

/* ── 4. PIN default 1234 dihapus ─────────────────────────────────────── */
{
  const r = boot({ props: OWNER });
  const tok = post(r, { action: "login", username: "admin", pin: "1234" }).token;

  const noPin = post(r, { authToken: tok, action: "saveUser", username: "stafbaru", name: "Staf Baru", role: "staff" });
  ok("akun baru tanpa PIN ditolak", noPin.success === false, noPin);

  const withPin = post(r, { authToken: tok, action: "saveUser", username: "stafbaru", name: "Staf Baru", pin: "4321", role: "staff" });
  ok("akun baru dengan PIN tersimpan", withPin.success === true, withPin);

  const rows = r.usersRows.map((x) => x[0]);
  ok("akun baru benar-benar masuk sheet", rows.indexOf("stafbaru") !== -1, rows);
  const newRow = r.usersRows.find((x) => x[0] === "stafbaru");
  ok("PIN akun baru bukan 1234", newRow && String(newRow[2]).replace(/^'/, "") !== "1234", newRow);
}

/* ── 5. Pencabutan sesi ──────────────────────────────────────────────── */
{
  const r = boot({ props: OWNER });
  const login = post(r, { action: "login", username: "ragil", pin: "2468" });
  const tok = login.token;
  ok("sesi berlaku sebelum dicabut", get(r, { action: "readUsers", authToken: tok }).success === true);

  r.sandbox._g2BumpUserRev("ragil");
  const after = get(r, { action: "readUsers", authToken: tok });
  ok("ganti PIN/role membatalkan sesi lama", after.code === "UNAUTHORIZED", after);
}

/* ── 6. Throttle login gabungan ──────────────────────────────────────── */
{
  const r = boot({ props: OWNER });
  let last = null;
  for (let i = 0; i < 30; i++) {
    last = post(r, { action: "login", username: "user" + i, pin: "0000" });
  }
  ok("banyak akun diserang 1 PIN → throttle global", last.code === "LOCKED", last);

  const r2 = boot({ props: OWNER });
  let stillOk = null;
  for (let i = 0; i < 3; i++) post(r2, { action: "login", username: "x" + i, pin: "0000" });
  stillOk = post(r2, { action: "login", username: "ragil", pin: "2468" });
  ok("3 kegagalan belum memblokir login benar", stillOk.success === true, stillOk);
}

console.log("\n" + pass + " lulus, " + fail + " gagal");
process.exit(fail ? 1 : 0);
