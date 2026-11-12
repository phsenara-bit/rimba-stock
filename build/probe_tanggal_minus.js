/**
 * Probe: apakah jawaban "kenapa minus" menyebut TANGGAL kejadian + penginput?
 * Data contoh: Ayam Cut 4 minus tepat pada tanggal 13 karena OUT 40 KG.
 *
 * Jalankan: set -a && . ~/.hermes/.env && set +a && node build/probe_tanggal_minus.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");

const CODE = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const KEY = process.env.AI_KEY || process.env.GOOGLE_API_KEY || "";
if (!KEY) { console.error("Tidak ada GOOGLE_API_KEY."); process.exit(2); }

function curlFetch(url, opts) {
  const args = ["-s", "-m", "120", "-w", "\n%{http_code}", "-X", (opts.method || "get").toUpperCase()];
  const h = opts.headers || {};
  Object.keys(h).forEach(k => args.push("-H", k + ": " + h[k]));
  if (opts.contentType) args.push("-H", "Content-Type: " + opts.contentType);
  if (opts.payload) args.push("--data-binary", opts.payload);
  args.push(url);
  const raw = execFileSync("curl", args, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  const i = raw.lastIndexOf("\n");
  return { getResponseCode: () => parseInt(raw.slice(i + 1).trim(), 10), getContentText: () => raw.slice(0, i) };
}

// Ayam Cut 4: stok awal 30, keluar 5,6,40 → minus 21 pada tanggal 13
const DATA = {
  success: true, sheetName: "Nov 2026", year: 2026, month: 11, dayToDate: 15,
  stats: { totalItems: 2, totalNilaiStokAset: 0, totalRupiahMasuk: 0, totalRupiahKeluar: 0 },
  items: [
    {
      id: 1, name: "Ayam Cut 4", division: "KITCHEN", unit: "KG", price: 65000,
      stock: -21, stokAwal: 30, inQtyMonth: 0, outQtyMonth: 51, minStock: 2,
      dailyHistory: { 10: { in: 0, out: 5 }, 11: { in: 0, out: 6 }, 13: { in: 0, out: 40 } }
    },
    {
      id: 2, name: "Beras 1 Krng =50kg", division: "KITCHEN", unit: "KRNG", price: 300000,
      stock: 7, stokAwal: 10, inQtyMonth: 0, outQtyMonth: 3, minStock: 1,
      dailyHistory: { 5: { in: 0, out: 3 } }
    }
  ]
};

// kolom: [id, waktu, ?, staf, ?, barang, satuan, tipe, qty, catatan, ?, ?]
const LOG = process.env.PROBE_NOLOG
  ? []
  : [
    ["M1", "2026-11-13 09:12:00", "", "Sari", "", "Ayam Cut 4", "KG", "OUT", "40", "-", "", ""],
    ["M2", "2026-11-11 08:00:00", "", "Ragil", "", "Ayam Cut 4", "KG", "OUT", "6", "-", "", ""]
  ];

const props = { AI_PROVIDER: "gemini", AI_KEY: KEY, AI_MODEL: "gemini-3.5-flash-lite" };
const sandbox = {
  console: { log() {}, warn() {}, error() {} },
  JSON, Math, Date, String, Number, Array, Object, parseInt, parseFloat, isNaN, Error,
  Utilities: { formatDate: (d, tz, f) => ({ yyyy: "2026", MM: "11", dd: "15", yyyyMMdd: "20261115" }[f] || "") },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; }, deleteProperty: k => { delete props[k]; } }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put: () => {}, remove: () => {} }) },
  ContentService: { MimeType: { JSON: "application/json" }, createTextOutput: s => ({ getContent: () => s, setMimeType() { return this; } }) },
  UrlFetchApp: { fetch: curlFetch },
  SpreadsheetApp: {
    getActiveSpreadsheet: () => ({
      getSheetByName: () => ({
        getLastRow: () => LOG.length + 1,
        getRange: (r, c, n) => ({ getValues: () => LOG.slice(Math.max(0, r - 2), Math.max(0, r - 2) + n) })
      })
    })
  },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }
};
const ctx = vm.createContext(sandbox);
vm.runInContext(CODE, ctx, { filename: "Code.gs" });
ctx.handleReadMonthlySheetData = () => ({ getContent: () => JSON.stringify(DATA) });

const q = process.argv[2] || "kenapa ayam cut 4 minus?";
const facts = vm.runInContext("_aiFacts_", ctx)(q, "");
const prompt = vm.runInContext("_aiPrompt_", ctx)(facts, q, [], "");
const ans = vm.runInContext("_aiCall_", ctx)(prompt);

console.log("Q : " + q + "   [mode=" + facts.mode + "]");
console.log("A : " + ans);
console.log("\n--- fakta yang tersedia (potongan) ---");
console.log(facts.text.split("\n").filter(l => /Mulai minus|tidak wajar|diinput oleh|Stok awal|out/i.test(l)).slice(0, 8).join("\n"));
console.log("\n--- cek ---");
console.log("sebut tanggal 13 : " + (/13/.test(ans) ? "YA" : "TIDAK"));
console.log("sebut nama Sari  : " + (/sari/i.test(ans) ? "YA" : "TIDAK"));
console.log("sebut angka 40   : " + (/40/.test(ans) ? "YA" : "TIDAK"));
