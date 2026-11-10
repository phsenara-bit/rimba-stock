/* Uji gate v4: sesi token, tanpa PIN di respons, otorisasi server. */
const fs = require("fs");
const vm = require("vm");

const src = fs.readFileSync("/home/xellium/rimba-stock/Code.gs", "utf8");

/* ── runtime tiruan Google Apps Script ─────────────────────────────────── */
function makeRuntime(opts) {
  const t = (opts && opts.now) || 1700000000;   // detik
  const store = new Map();
  const props = new Map(Object.entries((opts && opts.props) || {}));
  let uuid = 0;

  const cache = {
    get(k) {
      const e = store.get(k);
      if (!e) return null;
      if (e.exp && e.exp < (opts && opts.nowFn ? opts.nowFn() : t)) { store.delete(k); return null; }
      return e.v;
    },
    put(k, v, secs) { store.set(k, { v: v, exp: (opts && opts.nowFn ? opts.nowFn() : t) + (secs || 600) }); },
    remove(k) { store.delete(k); }
  };

  const usersRows = (opts && opts.users) || [
    ["admin", "Admin Rimba Alam", "1234", "KITCHEN, BAR, PASTRY, LAINNYA", "superadmin", "👔", "2026-01-01"],
    ["ragil", "Ragil", "2468", "KITCHEN, BAR", "admin", "👨‍💼", "2026-01-01"],
    ["chef", "Chef Rina", "9999", "KITCHEN", "staff", "🍳", "2026-01-01"]
  ];

  function range(row, col, nr, nc) {
    const r = Math.max(1, nr || 1), c = Math.max(1, nc || 1);
    const data = Array.from({ length: r }, (_, i) => Array.from({ length: c }, () => ""));
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

const call = (r, fn, e) => {
  const out = r.sandbox[fn](e);
  return JSON.parse(out.getContent());
};
const get = (r, params) => call(r, "doGet", { parameter: params || {} });
const post = (r, body) => call(r, "doPost", { postData: { contents: JSON.stringify(body) } });

let pass = 0, fail = 0;
function ok(label, cond, extra) {
  cond ? pass++ : fail++;
  console.log((cond ? "PASS" : "FAIL") + " · " + label + (cond ? "" : "  → " + JSON.stringify(extra)));
}
const noPin = (obj, pin) => JSON.stringify(obj).indexOf('"pin"') === -1 && String(JSON.stringify(obj)).indexOf(pin) === -1;

/* ── 1. permukaan publik ──────────────────────────────────────────────── */
{
  const r = boot();
  const ping = get(r, {});
  ok("ping publik dibalas tanpa data", ping.status === "online" && !ping.users, ping);

  ok("GET readUsers tanpa token ditolak", get(r, { action: "readUsers" }).code === "UNAUTHORIZED");
  ok("GET readSheetData tanpa token ditolak", get(r, { action: "readSheetData" }).code === "UNAUTHORIZED");
  ok("GET getItems tanpa token ditolak", get(r, { action: "getItems" }).code === "UNAUTHORIZED");
  ok("POST readUsers tanpa token ditolak", post(r, { action: "readUsers" }).code === "UNAUTHORIZED");
  ok("inspectSheets (bocor PIN lewat tab user) dimatikan", (() => {
    const r2 = boot();
    const tok = post(r2, { action: "login", username: "admin", pin: "1234" }).token;
    const res = get(r2, { action: "inspectSheets", authToken: tok });
    return res.success === false && JSON.stringify(res).indexOf("1234") === -1;
  })());
  ok("token palsu ditolak", get(r, { action: "readUsers", authToken: "palsu123" }).code === "UNAUTHORIZED");
}

/* ── 2. login ─────────────────────────────────────────────────────────── */
{
  const r = boot();
  const bad = post(r, { action: "login", username: "ragil", pin: "0000" });
  ok("PIN salah ditolak", bad.code === "UNAUTHORIZED" && !bad.token, bad);

  const good = post(r, { action: "login", username: "ragil", pin: "2468" });
  ok("login benar mengembalikan token", !!good.token && good.token.length >= 32, good);
  ok("respons login tidak memuat PIN", noPin(good, "2468"), good);
  ok("peran ikut dikirim", good.user && good.user.role === "admin", good.user);

  const byName = post(r, { action: "login", username: "Ragil", pin: "2468" });
  ok("login pakai nama lengkap", !!byName.token, byName);

  const tok = good.token;
  const list = get(r, { action: "readUsers", authToken: tok });
  ok("readUsers dengan token: sukses", list.success === true && Array.isArray(list.users), list);
  ok("daftar pengguna tanpa PIN", noPin(list, "2468") && noPin(list, "1234"), list.users && list.users[0]);
  ok("jumlah user benar", list.count === 3, list.count);

  const out = post(r, { action: "logout", authToken: tok });
  ok("logout sukses", out.success === true, out);
  ok("token mati setelah logout", get(r, { action: "readUsers", authToken: tok }).code === "UNAUTHORIZED");
}

/* ── 3. lockout ───────────────────────────────────────────────────────── */
{
  const r = boot();
  for (let i = 0; i < 5; i++) post(r, { action: "login", username: "chef", pin: "salah" });
  const locked = post(r, { action: "login", username: "chef", pin: "9999" });
  ok("5x salah → akun terkunci walau PIN benar", locked.code === "LOCKED", locked);
}

/* ── 4. sesi kedaluwarsa ──────────────────────────────────────────────── */
{
  let clock = 1700000000;
  const r = boot({ nowFn: () => clock });
  const tok = post(r, { action: "login", username: "admin", pin: "1234" }).token;
  ok("sesi hidup sebelum kedaluwarsa", get(r, { action: "readUsers", authToken: tok }).success === true);
  clock += 21601;
  ok("sesi kedaluwarsa ditolak", get(r, { action: "readUsers", authToken: tok }).code === "UNAUTHORIZED");
}

/* ── 5. otorisasi ─────────────────────────────────────────────────────── */
{
  const r = boot();
  const staffTok = post(r, { action: "login", username: "chef", pin: "9999" }).token;
  const adminTok = post(r, { action: "login", username: "admin", pin: "1234" }).token;

  ok("staf tidak boleh saveUser",
    post(r, { action: "saveUser", authToken: staffTok, username: "baru", pin: "1111" }).code === "FORBIDDEN");
  ok("staf tidak boleh deleteUser",
    post(r, { action: "deleteUser", authToken: staffTok, username: "ragil" }).code === "FORBIDDEN");
  ok("staf tidak boleh ganti PIN orang lain",
    post(r, { action: "updateUserPin", authToken: staffTok, username: "ragil", pin: "5555" }).code === "FORBIDDEN");

  // admin lolos gate → diteruskan ke handler lama (di-stub supaya fokus ke otorisasi)
  r.sandbox._realDoPost = (e) => {
    const b = JSON.parse(e.postData.contents);
    return r.sandbox.ContentService.createTextOutput(JSON.stringify({ success: true, routed: b.action }));
  };
  const adminSave = post(r, { action: "saveUser", authToken: adminTok, username: "baru", pin: "1111", name: "Baru" });
  ok("admin boleh saveUser", adminSave.success === true && adminSave.routed === "saveUser", adminSave);
}

/* ── 6. ganti PIN di server ───────────────────────────────────────────── */
{
  const r = boot();
  const staffTok = post(r, { action: "login", username: "chef", pin: "9999" }).token;

  const wrongOld = post(r, { action: "updateUserPin", authToken: staffTok, username: "chef", oldPin: "0000", pin: "7777" });
  ok("ganti PIN sendiri wajib PIN lama benar", wrongOld.code === "UNAUTHORIZED", wrongOld);

  const okChange = post(r, { action: "updateUserPin", authToken: staffTok, username: "chef", oldPin: "9999", pin: "7777" });
  ok("ganti PIN sendiri berhasil", okChange.success === true, okChange);
  ok("PIN baru tersimpan di sheet", String(r.usersRows[2][2]).replace(/^'/, "") === "7777", r.usersRows[2][2]);
  ok("respons ganti PIN tidak membocorkan PIN", noPin(okChange, "7777"), okChange);

  const relogin = post(r, { action: "login", username: "chef", pin: "7777" });
  ok("login dengan PIN baru berhasil", !!relogin.token, relogin);
  ok("PIN lama tidak berlaku", post(r, { action: "login", username: "chef", pin: "9999" }).code === "UNAUTHORIZED");

  const shortPin = post(r, { action: "updateUserPin", authToken: relogin.token, username: "chef", oldPin: "7777", pin: "12" });
  ok("PIN terlalu pendek ditolak", shortPin.code === "BAD_REQUEST", shortPin);
}

/* ── 7. token tidak ikut diteruskan ke kode lama ──────────────────────── */
{
  const r = boot();
  const tok = post(r, { action: "login", username: "admin", pin: "1234" }).token;
  let forwarded = null;
  r.sandbox._realDoPost = (e) => {
    forwarded = JSON.parse(e.postData.contents);
    return r.sandbox.ContentService.createTextOutput(JSON.stringify({ success: true }));
  };
  post(r, { action: "addItem", authToken: tok, authUser: "admin", authPin: "1234", name: "gula", division: "KITCHEN" });
  ok("body diteruskan tanpa authToken/authPin/authUser",
    forwarded && !forwarded.authToken && !forwarded.authPin && !forwarded.authUser,
    forwarded);
  ok("payload asli tetap utuh", forwarded && forwarded.name === "gula" && forwarded.division === "KITCHEN", forwarded);
}

/* ── 8. owner dari Script Properties ──────────────────────────────────── */
{
  const r = boot({ props: { OWNER_USERNAME: "satian", OWNER_PIN: "8888" } });
  ok("owner tanpa properti tidak bisa login", (() => {
    const r2 = boot();
    return post(r2, { action: "login", username: "satian", pin: "1212" }).code === "UNAUTHORIZED";
  })());
  const own = post(r, { action: "login", username: "satian", pin: "8888" });
  ok("owner login pakai PIN dari properti", !!own.token && own.user.role === "owner", own);
  ok("PIN owner tidak dibalas", noPin(own, "8888"), own);

  const changed = post(r, { action: "updateUserPin", authToken: own.token, username: "satian", oldPin: "8888", pin: "6565" });
  ok("owner bisa ganti PIN sendiri", changed.success === true, changed);
  ok("PIN owner baru tersimpan di properti", r.sandbox._props.get("OWNER_PIN") === "6565", r.sandbox._props.get("OWNER_PIN"));
}

console.log("\n" + (fail === 0 ? "SEMUA LULUS" : "ADA YANG GAGAL") + `: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);