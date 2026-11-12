/**
 * Cek sintaks SEMUA blok <script> inline di index.html + file JS pendukung.
 * Ekstraksi dilakukan dengan mencari tag script, bukan menebak offset baris.
 */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const htmlPath = process.argv[2] || path.join(__dirname, "..", "index.html");
const html = fs.readFileSync(htmlPath, "utf8");
const blocks = [];
const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
let m;
while ((m = re.exec(html))) {
  const attrs = m[1] || "";
  if (/\bsrc\s*=/.test(attrs)) continue;
  if (/type\s*=\s*["'](application\/json|text\/template)["']/i.test(attrs)) continue;
  blocks.push({ code: m[2], index: m.index });
}

let bad = 0;
blocks.forEach((b, i) => {
  const line = html.slice(0, b.index).split("\n").length;
  try {
    new vm.Script(b.code, { filename: "index.html:block" + (i + 1) });
    console.log("  ok   blok script #" + (i + 1) + " (mulai baris " + line + ", " + b.code.length + " char)");
  } catch (e) {
    bad++;
    console.log("  FAIL blok script #" + (i + 1) + " (mulai baris " + line + "): " + e.message);
  }
});

for (const f of ["sw.js", "security-tools/test_render_pages.js"]) {
  const p = path.join(__dirname, "..", f);
  if (!fs.existsSync(p)) continue;
  try {
    new vm.Script(fs.readFileSync(p, "utf8"), { filename: f });
    console.log("  ok   " + f);
  } catch (e) {
    bad++;
    console.log("  FAIL " + f + ": " + e.message);
  }
}

console.log(bad ? "SINTAKS GAGAL: " + bad : "SINTAKS OK: " + blocks.length + " blok inline");
process.exit(bad ? 1 : 0);
