/**
 * Regresi frontend Mirim: memori pertanyaan sesi (12 × 80), payload POST,
 * dan pembersihan saat chat ditutup.
 *
 * Yang dijaga:
 *  - Dulu riwayat+topik dikirim lewat URL GET, jadi pertanyaan/memori tambahan
 *    membuat URL membengkak dan bisa terpotong.
 *  - Memori harus berisi PERTANYAAN saja; jawaban Mirim tidak boleh ikut
 *    (jawaban lama bukan fakta).
 *  - Menutup chat harus menghapus memori, sama seperti state lain.
 *
 * Jalankan: node security-tools/test_ai_frontend_memori.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("  ok  " + name); }
  else { fail++; console.log("  FAIL " + name + (extra === undefined ? "" : "  → " + JSON.stringify(extra).slice(0, 240))); }
}

function sliceBetween(src, a, b, label) {
  const i = src.indexOf(a);
  const j = i < 0 ? -1 : src.indexOf(b, i);
  if (i < 0 || j < 0) throw new Error(label + " tidak ditemukan (a=" + (i >= 0) + ", b=" + (j >= 0) + ")");
  return src.slice(i, j);
}

function loadHelpers(html) {
  const helpers = sliceBetween(html, "var QMEM_MAX = 12;", "/* ── UI ──", "blok memori");
  const sandbox = { console, String, Array, JSON, Number };
  vm.createContext(sandbox);
  vm.runInContext(helpers, sandbox);
  return { sandbox, helpers };
}

const FILES = {
  "index.html": fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8"),
  "ask-ai-block.html": fs.readFileSync(path.join(__dirname, "..", "ask-ai-block.html"), "utf8")
};

console.log("\n=== 1. Batas memori 12 × 80 karakter ===");
for (const name of Object.keys(FILES)) {
  const { sandbox } = loadHelpers(FILES[name]);
  const sane = sandbox.sanitizeMemoryItem;
  const push = sandbox.pushQuestionMemory;
  const build = sandbox.buildAskPayload;

  ok(name + ": pertanyaan > 80 char dipotong", sane("x".repeat(200)).length === 80, sane("x".repeat(200)).length);
  ok(name + ": newline/tab jadi spasi", sane("  a\nb\tc  ") === "a b c", sane("  a\nb\tc  "));

  let mem = [];
  for (let i = 0; i < 20; i++) mem = push(mem, "pertanyaan ke-" + i);
  ok(name + ": memori maksimal 12 entri", mem.length === 12, mem.length);
  ok(name + ": entri terbaru dipertahankan", mem[mem.length - 1] === "pertanyaan ke-19", mem[mem.length - 1]);
  ok(name + ": entri terlama dibuang", mem.indexOf("pertanyaan ke-7") === -1 && mem[0] === "pertanyaan ke-8", mem);

  mem = push(mem, "  \n\t  ");
  ok(name + ": pertanyaan kosong tidak menambah entri", mem.length === 12, mem.length);

  const payload = build("stok beras?", [{ role: "user", text: "q1" }, { role: "model", text: "jawaban rahasia" }], mem, "Beras");
  ok(name + ": payload memakai action askAI", payload.action === "askAI", payload.action);
  ok(name + ": payload membawa 12 pertanyaan", payload.questionMemory.length === 12, payload.questionMemory.length);
  ok(name + ": payload tidak membawa jawaban Mirim di memori", payload.questionMemory.join("|").indexOf("jawaban rahasia") === -1);
  ok(name + ": semua entri memori <= 80", payload.questionMemory.every(s => s.length <= 80));
  ok(name + ": topik dibatasi 120 char", build("q", [], [], "t".repeat(500)).topic.length === 120);
  ok(name + ": pertanyaan dibatasi 300 char", build("q".repeat(900), [], [], "").q.length === 300);
  ok(name + ": riwayat dibatasi 8 pesan", build("q", new Array(30).fill({ role: "user", text: "x" }), [], "").history.length === 8);
}

console.log("\n=== 2. Pengiriman lewat POST, bukan URL ===");
for (const name of Object.keys(FILES)) {
  const html = FILES[name];
  const askSrc = sliceBetween(html, "  function ask(q) {", "  /* ── Buka / tutup", name + " ask()");
  ok(name + ": memakai fetch POST", /method:\s*"POST"/.test(askSrc), askSrc.slice(0, 0));
  ok(name + ": body JSON dari buildAskPayload", /buildAskPayload\(/.test(askSrc) && /JSON\.stringify\(payload\)/.test(askSrc));
  ok(name + ": tidak lagi menaruh riwayat/memori di URL", !/params\.set\("history"/.test(askSrc) && !/params\.set\("questionMemory"/.test(askSrc));
  ok(name + ": tidak ada URLSearchParams untuk askAI", !/new URLSearchParams/.test(askSrc));
  ok(name + ": memori diperbarui setelah kirim", /state\.qMemory = pushQuestionMemory\(/.test(askSrc));
  ok(name + ": Content-Type text/plain (tanpa preflight CORS)", /text\/plain/.test(askSrc));
  ok(name + ": tidak mengirim PIN/kunci", !/authPin|AI_KEY|apiKey/i.test(askSrc));

  const resetSrc = sliceBetween(html, "  function reset() {", "  function close() {", name + " reset()");
  ok(name + ": reset() menghapus memori", /state\.qMemory = \[\]/.test(resetSrc));
  ok(name + ": close() memanggil reset()", /reset\(\);/.test(sliceBetween(html, "  function close() {", "  /* ── Pasang ke App", name + " close()")));
}

console.log("\n=== 3. Dua salinan frontend tidak berbeda perilaku ===");
{
  const a = loadHelpers(FILES["index.html"]).sandbox.buildAskPayload;
  const b = loadHelpers(FILES["ask-ai-block.html"]).sandbox.buildAskPayload;
  const mem = ["stok ayam bulan lalu", "kalau beras?"];
  const hist = [{ role: "user", text: "hai" }, { role: "model", text: "jawab" }];
  ok("payload index.html == ask-ai-block.html",
    JSON.stringify(a("q", hist, mem, "topik")) === JSON.stringify(b("q", hist, mem, "topik")));
}

console.log("\n=== 4. Pesan error kuota baru punya teks ===");
for (const name of Object.keys(FILES)) {
  const src = sliceBetween(FILES[name], "  function friendlyError(data) {", "  function submit() {", name + " friendlyError");
  ok(name + ": QUOTA_SHARED punya pesan sendiri", /QUOTA_SHARED/.test(src));
  ok(name + ": THROTTLE punya pesan sendiri", /THROTTLE/.test(src));
}

console.log("\n=== 5. Sinkron dengan server (batas sama) ===");
{
  const code = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
  ok("server: AI_QMEM_MAX = 12", /const AI_QMEM_MAX = 12;/.test(code));
  ok("server: AI_QMEM_CHARS = 80", /const AI_QMEM_CHARS = 80;/.test(code));
  const idx = loadHelpers(FILES["index.html"]).sandbox;
  ok("frontend memotong sebelum kirim (<= server)",
    idx.sanitizeMemoryItem("z".repeat(500)).length <= 80);
  ok("server menerima questionMemory dari payload POST", /questionMemory/.test(code) && /_aiSanitizeMemory_/.test(code));
}

console.log("\n" + (fail ? "ADA YANG GAGAL: " + pass + " lulus, " + fail + " gagal" : "SEMUA LULUS: " + pass + " lulus, 0 gagal"));
process.exit(fail ? 1 : 0);
