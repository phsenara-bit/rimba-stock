// Uji logika security-gate.gs di Node dengan stub Apps Script.
const fs = require("fs");
const vm = require("vm");

const props = {};
const ctx = {
  console,
  PropertiesService: {
    getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null) }),
  },
  ContentService: {
    MimeType: { JSON: "application/json" },
    createTextOutput(t) {
      const o = { text: t, mime: null };
      o.setMimeType = m => { o.mime = m; return o; };
      return o;
    },
  },
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync("Rimba-Alam-Web/security-gate.gs", "utf8"), ctx);

// handler asli tiruan
let realGetCalls = 0, realPostCalls = 0;
ctx._realDoGet = () => { realGetCalls++; return "REAL_GET"; };
ctx._realDoPost = () => { realPostCalls++; return "REAL_POST"; };

const results = [];
const check = (n, c, x = "") => results.push([c ? "PASS" : "FAIL", n, x]);
const parse = r => (typeof r === "string" ? { raw: r } : JSON.parse(r.text));

// 1. belum ada properti -> semua ditolak
let r = parse(ctx.doGet({ parameter: { token: "apa-saja" } }));
check("fail-closed saat token belum diset", r.success === false && r.code === "NOT_CONFIGURED");
check("handler asli tidak terpanggil", realGetCalls === 0);

// 2. properti diset
props.SYNC_TOKEN = "token-rahasia-panjang-123";

r = parse(ctx.doGet({ parameter: {} }));
check("tanpa token -> UNAUTHORIZED", r.code === "UNAUTHORIZED");

r = parse(ctx.doGet({ parameter: { token: "salah" } }));
check("token salah -> UNAUTHORIZED", r.code === "UNAUTHORIZED" && realGetCalls === 0);

r = ctx.doGet({ parameter: { token: "token-rahasia-panjang-123" } });
check("token benar -> lolos ke doGet asli", r === "REAL_GET" && realGetCalls === 1);

// POST: token di body JSON
r = parse(ctx.doPost({ parameter: {}, postData: { contents: JSON.stringify({ id: "TXN1", qty: 3 }) } }));
check("POST tanpa token -> ditolak", r.code === "UNAUTHORIZED" && realPostCalls === 0);

r = ctx.doPost({ parameter: {}, postData: { contents: JSON.stringify({ id: "TXN1", qty: 3, token: "token-rahasia-panjang-123" }) } });
check("POST token benar -> lolos", r === "REAL_POST" && realPostCalls === 1);

// token di query juga diterima untuk POST
r = ctx.doPost({ parameter: { token: "token-rahasia-panjang-123" }, postData: { contents: "{}" } });
check("POST token via query -> lolos", r === "REAL_POST" && realPostCalls === 2);

// body rusak tidak boleh bikin error
r = parse(ctx.doPost({ parameter: {}, postData: { contents: "bukan json" } }));
check("body rusak -> ditolak rapi", r.code === "UNAUTHORIZED");

// token dengan spasi di ujung tetap cocok
r = ctx.doGet({ parameter: { token: "  token-rahasia-panjang-123  " } });
check("spasi di ujung ditoleransi", r === "REAL_GET");

let fails = 0;
for (const [st, n, x] of results) { if (st === "FAIL") fails++; console.log(st.padEnd(5), n, st === "FAIL" ? "-> " + x : ""); }
console.log(`\n${results.length - fails}/${results.length} lolos`);
process.exit(fails ? 1 : 0);
