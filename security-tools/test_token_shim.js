// Uji fungsional DataService + fetch shim di Node (tanpa browser).
const fs = require("fs");
const vm = require("vm");

const html = fs.readFileSync("index.html", "utf8");
const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const idx = blocks.findIndex(b => b.includes("const DataService"));
if (idx < 0) { console.error("FATAL: blok DataService tidak ketemu"); process.exit(1); }

const store = new Map();
const calls = [];

const win = {
  localStorage: {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
  },
  addEventListener() {},
  fetch(input, init) {
    calls.push({ url: typeof input === "string" ? input : input.url, init });
    return Promise.resolve({ ok: true, status: 200, type: "cors", json: async () => ({ success: true }) });
  },
};
win.window = win;

const ctx = vm.createContext({ window: win, console, setTimeout, clearTimeout, JSON, Math, Date, Object, Array, String, Number, encodeURIComponent, parseFloat, isNaN });
vm.runInContext(blocks[idx], ctx, { filename: "data-service.js" });

const DS = win.DataService;
const results = [];
const check = (name, cond, extra = "") => { results.push([cond ? "PASS" : "FAIL", name, extra]); };

check("DataService ter-load", !!DS);
check("setSyncToken ada", typeof DS.setSyncToken === "function");
DS.setSyncToken("  rahasia-uji-123  ");
check("token tersimpan ter-trim", DS.getSyncToken() === "rahasia-uji-123", DS.getSyncToken());

// GET ke script.google.com harus dapat ?token=
calls.length = 0;
win.fetch("https://script.google.com/macros/s/AK/exec?action=readSheetData&t=1");
check("GET dapat token", calls[0].url.includes("token=rahasia-uji-123"), calls[0].url);

// GET dengan token yang sudah ada tidak dobel
calls.length = 0;
win.fetch("https://script.google.com/macros/s/AK/exec?action=ping&token=sudah");
check("GET tidak dobel token", (calls[0].url.match(/token=/g) || []).length === 1, calls[0].url);

// POST JSON harus dapat field token
calls.length = 0;
win.fetch("https://script.google.com/macros/s/AK/exec", { method: "POST", body: JSON.stringify({ id: "TXN0001", qty: 2 }) });
const body = JSON.parse(calls[0].init.body);
check("POST dapat field token", body.token === "rahasia-uji-123", JSON.stringify(body));
check("POST field asli tetap utuh", body.id === "TXN0001" && body.qty === 2);

// POST dengan mode no-cors tetap jalan (mode tidak diubah shim)
calls.length = 0;
win.fetch("https://script.google.com/macros/s/AK/exec", { method: "POST", mode: "no-cors", body: JSON.stringify({ a: 1 }) });
check("POST no-cors tetap terkirim", calls[0].init.mode === "no-cors" && JSON.parse(calls[0].init.body).token === "rahasia-uji-123");

// URL lain tidak disentuh
calls.length = 0;
win.fetch("https://example.com/api", { method: "POST", body: JSON.stringify({ a: 1 }) });
check("URL non-Google tidak diubah", !JSON.parse(calls[0].init.body).token && calls[0].url === "https://example.com/api");

// Token kosong: tidak menambah ?token= kosong
DS.setSyncToken("");
calls.length = 0;
win.fetch("https://script.google.com/macros/s/AK/exec?action=ping");
check("token kosong tidak menempel", !calls[0].url.includes("token="), calls[0].url);

// Shim menandai dirinya supaya tidak terpasang dua kali
check("shim idempoten", win.__gasFetchShim === true);

let fails = 0;
for (const [st, name, extra] of results) { if (st === "FAIL") fails++; console.log(st.padEnd(5), name, st === "FAIL" ? "-> " + extra : ""); }
console.log(`\n${results.length - fails}/${results.length} lolos`);
process.exit(fails ? 1 : 0);
