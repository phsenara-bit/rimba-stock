/**
 * Uji END-TO-END ke provider AI sungguhan (bukan mock).
 * Memakai prompt yang benar-benar dihasilkan _aiPrompt_ dari data contoh,
 * lalu memanggil Gemini lewat UrlFetchApp tiruan (curl sinkron).
 *
 * Jalankan: GOOGLE_API_KEY=... node security-tools/test_ai_live.js
 * Opsional: AI_PROVIDER=openai AI_BASE_URL=https://api-plan.vikey.ai/v1 AI_MODEL=vikey/plan AI_KEY=...
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");

const CODE = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const PROVIDER = process.env.AI_PROVIDER || "gemini";
const KEY = process.env.AI_KEY || process.env.GOOGLE_API_KEY || "";
const MODEL = process.env.AI_MODEL || (PROVIDER === "gemini" ? "gemini-3.5-flash-lite" : "gpt-4o-mini");
const BASE = process.env.AI_BASE_URL || "";

if (!KEY) {
  console.error("Tidak ada API key (set GOOGLE_API_KEY atau AI_KEY).");
  process.exit(2);
}

// ── UrlFetchApp tiruan: curl sinkron ──────────────────────────────
function curlFetch(url, opts) {
  const args = ["-s", "-m", "90", "-w", "\n%{http_code}", "-X", (opts.method || "get").toUpperCase()];
  const headers = opts.headers || {};
  Object.keys(headers).forEach((h) => { args.push("-H", h + ": " + headers[h]); });
  if (opts.contentType) args.push("-H", "Content-Type: " + opts.contentType);
  if (opts.payload) args.push("--data-binary", opts.payload);
  args.push(url);

  const raw = execFileSync("curl", args, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  const idx = raw.lastIndexOf("\n");
  const body = raw.slice(0, idx);
  const code = parseInt(raw.slice(idx + 1).trim(), 10);
  return {
    getResponseCode: () => code,
    getContentText: () => body
  };
}

const props = { AI_PROVIDER: PROVIDER, AI_KEY: KEY, AI_MODEL: MODEL };
if (BASE) props.AI_BASE_URL = BASE;

const sandbox = {
  console,
  JSON, Math, Date, String, Number, Array, Object, parseInt, parseFloat, isNaN, Error,
  Utilities: { formatDate: () => "20261108" },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: (k) => (k in props ? props[k] : null),
      setProperty: (k, v) => { props[k] = v; }
    })
  },
  CacheService: { getScriptCache: () => ({ get: () => null, put: () => {} }) },
  ContentService: {
    MimeType: { JSON: "application/json" },
    createTextOutput: (s) => ({ getContent: () => s, setMimeType() { return this; } })
  },
  UrlFetchApp: { fetch: curlFetch },
  SpreadsheetApp: { getActiveSpreadsheet: () => ({}) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }
};

const ctx = vm.createContext(sandbox);
vm.runInContext(CODE, ctx, { filename: "Code.gs" });

// Data contoh: kasus Ayam Kampung minus (sama seperti test_ai.js)
const fakeData = {
  success: true, sheetName: "Nov 2026", year: 2026, month: 11, dayToDate: 8,
  stats: { totalItems: 4, totalNilaiStokAset: 12500000, totalRupiahMasuk: 2000000, totalRupiahKeluar: 4500000, totalInQty: 30, totalOutQty: 108 },
  items: [
    { id: 15, name: "Ayam Kampung", division: "KITCHEN", unit: "EKOR", price: 44000, stock: -53, stokAwal: 25, inQtyMonth: 30, outQtyMonth: 108, minStock: 2,
      dailyHistory: { 1: { in: 0, out: 12 }, 2: { in: 0, out: 15 }, 3: { in: 10, out: 8 }, 4: { in: 0, out: 14 }, 5: { in: 0, out: 11 }, 6: { in: 20, out: 9 }, 7: { in: 0, out: 13 }, 8: { in: 0, out: 16 } } },
    { id: 16, name: "Ayam Fillet", division: "KITCHEN", unit: "KG", price: 65000, stock: 4.5, stokAwal: 3, inQtyMonth: 5, outQtyMonth: 3.5, minStock: 2,
      dailyHistory: { 3: { in: 5, out: 0 }, 6: { in: 0, out: 2 }, 8: { in: 0, out: 1.5 } } },
    { id: 40, name: "Blueband Margarine", division: "PASTRY", unit: "PCS", price: 15000, stock: 0, stokAwal: 2, inQtyMonth: 0, outQtyMonth: 2, minStock: 2,
      dailyHistory: { 2: { in: 0, out: 1 }, 5: { in: 0, out: 1 } } },
    { id: 55, name: "Soda Gembira", division: "LAINNYA", unit: "PCS", price: 8000, stock: 12, stokAwal: 12, inQtyMonth: 0, outQtyMonth: 0, minStock: 2, dailyHistory: {} }
  ]
};
ctx.handleReadMonthlySheetData = () => ({ getContent: () => JSON.stringify(fakeData) });

function ask(question, history, topic) {
  const facts = vm.runInContext("_aiFacts_", ctx)(question);
  const prompt = vm.runInContext("_aiPrompt_", ctx)(facts, question, history, topic);
  const t0 = Date.now();
  const answer = vm.runInContext("_aiCall_", ctx)(prompt);
  return { answer, ms: Date.now() - t0, promptChars: prompt.length, topic: facts.topic };
}

console.log("provider=" + PROVIDER + " model=" + MODEL + (BASE ? " base=" + BASE : ""));

// 1: diagnosa
const q1 = ask("kenapa stok ayam kampung bulan ini minus?");
console.log("\n[1] " + q1.ms + "ms · " + q1.promptChars + " char prompt · topik=" + q1.topic);
console.log(q1.answer);

// 2: lanjutan, memakai riwayat
const hist = [
  { role: "user", text: "kenapa stok ayam kampung minus?" },
  { role: "model", text: q1.answer }
];
const q2 = ask("kapan dia mulai minus?", hist, "Ayam Kampung");
console.log("\n[2] " + q2.ms + "ms · " + q2.promptChars + " char prompt");
console.log(q2.answer);

// 3: ringkasan umum
const q3 = ask("nilai stok bulan ini berapa dan ada yang minus?");
console.log("\n[3] " + q3.ms + "ms · " + q3.promptChars + " char prompt · topik=" + q3.topic);
console.log(q3.answer);