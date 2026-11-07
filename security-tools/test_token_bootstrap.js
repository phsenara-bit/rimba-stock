// Uji bootstrap token dari URL (#token=... / ?token=...)
const fs = require("fs");
const vm = require("vm");

const html = fs.readFileSync("index.html", "utf8");
const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const code = blocks.find(b => b.includes("const DataService"));

function run({ hash = "", search = "", existing = null }) {
  const store = new Map();
  if (existing) store.set("rimba_alam_sync_token_v1", existing);
  const replaced = [];
  const win = {
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
    },
    location: { hash, search, pathname: "/" },
    history: { replaceState: (a, b, c) => replaced.push(c) },
    addEventListener() {},
    fetch: () => Promise.resolve({ ok: true, json: async () => ({}) }),
  };
  win.window = win;
  const ctx = vm.createContext({ window: win, console: { log() {}, warn() {} }, setTimeout, clearTimeout, JSON, Math, Date, Object, Array, String, Number, decodeURIComponent, encodeURIComponent, parseFloat, isNaN });
  vm.runInContext(code, ctx);
  return { token: win.DataService.getSyncToken(), replaced, store };
}

const results = [];
const check = (n, c, x = "") => results.push([c ? "PASS" : "FAIL", n, x]);

let r = run({ hash: "#token=abc500a8c4bf8bf4a13e4ab9002c7731" });
check("hash: token tersimpan", r.token === "abc500a8c4bf8bf4a13e4ab9002c7731", r.token);
check("hash: URL dibersihkan", r.replaced.length === 1 && r.replaced[0] === "/", JSON.stringify(r.replaced));

r = run({ search: "?token=abc500a8c4bf8bf4a13e4ab9002c7731" });
check("query: token tersimpan", r.token === "abc500a8c4bf8bf4a13e4ab9002c7731");

r = run({ hash: "#/dashboard" });
check("tanpa token: tidak menyimpan", r.token === "" && r.replaced.length === 0);

r = run({ hash: "#token=" });
check("token kosong: diabaikan", r.token === "" && r.replaced.length === 0);

r = run({ hash: "#token=a%2Bb%2Fc%3D" });
check("token URL-encoded di-decode", r.token === "a+b/c=", r.token);

r = run({ hash: "#token=baru-banget", existing: "token-lama" });
check("token lama ditimpa saat rotasi", r.token === "baru-banget", r.token);

r = run({ hash: "#foo=1&token=xyz&bar=2" });
check("token di tengah hash terbaca", r.token === "xyz", r.token);

let fails = 0;
for (const [st, n, x] of results) { if (st === "FAIL") fails++; console.log(st.padEnd(5), n, st === "FAIL" ? "-> " + x : ""); }
console.log(`\n${results.length - fails}/${results.length} lolos`);
process.exit(fails ? 1 : 0);