// Uji: kredensial login otomatis ikut di setiap request ke Apps Script.
const fs = require("fs");
const vm = require("vm");

const html = fs.readFileSync("index.html", "utf8");
const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const dsCode = blocks.find(b => b.includes("const DataService"));
const authCode = blocks.find(b => b.includes("const AuthService"));

const results = [];
const check = (n, c, x = "") => results.push([c ? "PASS" : "FAIL", n, x]);

function loadDS(cred) {
  const calls = [];
  const ls = new Map();
  const ss = new Map();
  if (cred) ss.set("rimba_alam_device_cred_v1", JSON.stringify(cred));
  const win = {
    localStorage: { getItem: k => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: k => ls.delete(k) },
    sessionStorage: { getItem: k => (ss.has(k) ? ss.get(k) : null), setItem: (k, v) => ss.set(k, String(v)), removeItem: k => ss.delete(k) },
    addEventListener() {},
    fetch(input, init) {
      calls.push({ url: typeof input === "string" ? input : input.url, init });
      return Promise.resolve({ ok: true, status: 200, type: "cors", json: async () => ({ success: true }) });
    },
  };
  win.window = win;
  const ctx = vm.createContext({ window: win, console: { log() {}, warn() {} }, setTimeout, clearTimeout, JSON, Math, Date, Object, Array, String, Number, decodeURIComponent, encodeURIComponent, parseFloat, isNaN });
  vm.runInContext(dsCode, ctx);
  return { calls, win };
}

// 1. POST mutasi biasa
let { calls } = loadDS({ u: "chef", p: "9999" });
calls.length = 0;
vm.runInContext("0", vm.createContext({}));
let ctx = loadDS({ u: "chef", p: "9999" });
ctx.win.fetch("https://script.google.com/macros/s/AK/exec", { method: "POST", body: JSON.stringify({ id: "TXN1", qty: 3, type: "OUT" }) });
let body = JSON.parse(ctx.calls[0].init.body);
check("POST membawa authUser", body.authUser === "chef", JSON.stringify(body));
check("POST membawa authPin", body.authPin === "9999");
check("field transaksi tetap utuh", body.id === "TXN1" && body.qty === 3 && body.type === "OUT");

// 2. updateUserPin: username/pin milik TARGET tidak boleh tertimpa
ctx = loadDS({ u: "chef", p: "9999" });
ctx.win.fetch("https://script.google.com/macros/s/AK/exec", {
  method: "POST",
  body: JSON.stringify({ action: "updateUserPin", username: "ragil", pin: "1111" }),
});
body = JSON.parse(ctx.calls[0].init.body);
check("target username tidak tertimpa", body.username === "ragil", JSON.stringify(body));
check("target pin tidak tertimpa", body.pin === "1111");
check("identitas pengirim tetap terkirim", body.authUser === "chef" && body.authPin === "9999");

// 3. GET baca data
ctx = loadDS({ u: "admin", p: "1212" });
ctx.win.fetch("https://script.google.com/macros/s/AK/exec?action=readSheetData&t=1");
check("GET membawa authUser", ctx.calls[0].url.includes("authUser=admin"), ctx.calls[0].url);
check("GET membawa authPin", ctx.calls[0].url.includes("authPin=1212"));

// 4. tanpa kredensial -> tidak menempel apa pun
ctx = loadDS(null);
ctx.win.fetch("https://script.google.com/macros/s/AK/exec?action=ping");
check("tanpa login tidak mengirim kredensial", !ctx.calls[0].url.includes("authUser"), ctx.calls[0].url);

// 5. URL non-Google tidak disentuh
ctx = loadDS({ u: "chef", p: "9999" });
ctx.win.fetch("https://example.com/api", { method: "POST", body: JSON.stringify({ a: 1 }) });
check("URL lain tidak diubah", ctx.calls[0].url === "https://example.com/api" && !JSON.parse(ctx.calls[0].init.body).authUser);

// 6. Kode AuthService menyimpan & menghapus kredensial di titik yang benar
check("login menyimpan kredensial", /_saveDeviceCred\(session\.username, cleanPin\)/.test(authCode));
check("login satian menyimpan kredensial", /_saveDeviceCred\("satian", cleanPin\)/.test(authCode));
check("logout menghapus kredensial", /_clearDeviceCred\(\)/.test(authCode));
check("ganti PIN memperbarui kredensial", /_saveDeviceCred\(session\.username, newPin\.trim\(\)\)/.test(authCode));

// 7. AuthService benar-benar menyimpan saat login (uji langsung, tanpa DOM)
function loadAuth(preUsers) {
  const ls = new Map();
  const ss = new Map();
  if (preUsers) ls.set("rimba_alam_users_db_v3", JSON.stringify(preUsers));
  const win = {
    localStorage: { getItem: k => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: k => ls.delete(k) },
    sessionStorage: { getItem: k => (ss.has(k) ? ss.get(k) : null), setItem: (k, v) => ss.set(k, String(v)), removeItem: k => ss.delete(k) },
    addEventListener() {},
    fetch: () => Promise.resolve({ ok: true, json: async () => ({ success: true }) }),
  };
  win.window = win;
  const c = vm.createContext({ window: win, console: { log() {}, warn() {} }, setTimeout, clearTimeout, JSON, Math, Date, Object, Array, String, Number, encodeURIComponent, decodeURIComponent, parseFloat, isNaN });
  vm.runInContext(authCode, c);
  return { A: win.AuthService, ss };
}

const { A, ss } = loadAuth({ chef: { username: "chef", name: "Chef Rina", pin: "9999", role: "staff", division: "KITCHEN", divisions: ["KITCHEN"] } });
const loginRes = A.login("chef", "9999");
check("login berhasil (setup uji)", loginRes.success === true, JSON.stringify(loginRes));
const stored = ss.get("rimba_alam_device_cred_v1");
check("kredensial tersimpan setelah login", !!stored && JSON.parse(stored).u === "chef" && JSON.parse(stored).p === "9999", String(stored));
A.logout();
check("logout membersihkan kredensial", !ss.get("rimba_alam_device_cred_v1"));

let fails = 0;
for (const [st, n, x] of results) {
  if (st === "FAIL") fails++;
  console.log(st.padEnd(5), n, st === "FAIL" ? "-> " + x : "");
}
console.log(`\n${results.length - fails}/${results.length} lolos`);
process.exit(fails ? 1 : 0);
