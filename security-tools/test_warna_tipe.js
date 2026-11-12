/**
 * Regresi warna tipe mutasi: masuk / keluar / spoil / revisi harus beda warna.
 *
 * Sebelumnya spoIL dan "Ubah Info" sama-sama oranye (#e65100 vs #d84315) dan
 * ikon keduanya memakai kelas "out" (merah), jadi di daftar riwayat susah
 * dibedakan. Sekarang tiap tipe punya kelas + warna sendiri.
 *
 * Jalankan: node security-tools/test_warna_tipe.js
 */
const fs = require("fs");
const path = require("path");

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("  ok  " + name); }
  else { fail++; console.log("  FAIL " + name + (extra === undefined ? "" : "  → " + JSON.stringify(extra))); }
}

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const row = html.slice(html.indexOf("function renderTxnRow(txn)"), html.indexOf("// ── ALERTS"));

console.log("\n=== 1. Kelas ikon per tipe ===");
{
  const cls = (marker) => {
    const i = row.indexOf(marker);
    if (i < 0) return null;
    const seg = row.slice(i, i + 400);
    const m = seg.match(/iconClass\s*=\s*"([a-z]+)"/);
    return m ? m[1] : null;
  };
  ok("keluar tetap merah (out)", /iconClass = isIn \? "in" : "out"/.test(row));
  ok("spoil punya kelas sendiri", cls("} else if (isSpoil)") === "spoil", cls("} else if (isSpoil)"));
  ok("revisi punya kelas sendiri", cls("} else if (isEditItem)") === "revisi", cls("} else if (isEditItem)"));
  ok("hapus dibedakan dari revisi", cls("} else if (isDeleteItem)") === "hapus", cls("} else if (isDeleteItem)"));
}

console.log("\n=== 2. CSS mendefinisikan kelas tersebut ===");
for (const k of ["spoil", "revisi", "hapus"]) {
  ok(".txn-icon." + k + " ada", new RegExp("\\.txn-icon\\." + k + "\\s*\\{").test(html));
}
ok(".type-btn.type-spoil.active ada", /\.type-btn\.type-spoil\.active\s*\{/.test(html));

console.log("\n=== 3. Empat warna benar-benar berbeda ===");
{
  const vars = {};
  const rootMatch = html.match(/:root\s*\{([\s\S]*?)\}/);
  if (rootMatch) {
    rootMatch[1].replace(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})/g, (_, k, v) => { vars[k] = v.toLowerCase(); });
  }
  const grab = (sel) => {
    const m = html.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{([^}]*)\\}"));
    if (!m) return "";
    let c = m[1].match(/color:\s*(#[0-9a-fA-F]{6})/);
    if (c) return c[1].toLowerCase();
    c = m[1].match(/color:\s*var\(--([a-z-]+)\)/);
    return c ? (vars[c[1]] || "") : "";
  };
  const masuk = grab(".txn-icon.in");
  const keluar = grab(".txn-icon.out");
  const spoil = grab(".txn-icon.spoil");
  const revisi = grab(".txn-icon.revisi");
  const set = new Set([masuk, keluar, spoil, revisi].filter(Boolean));
  ok("terbaca 4 warna", set.size === 4, { masuk, keluar, spoil, revisi });
  ok("spoil bukan merah keluar", spoil !== keluar, { spoil, keluar });
  ok("revisi bukan oranye spoil", revisi !== spoil, { revisi, spoil });
}

console.log("\n=== 4. Tombol spoil tidak lagi memakai inline style ===");
{
  ok("tombol SPOIL pakai kelas", /class="type-btn type-spoil \$\{txnType === 'SPOIL' \? 'active' : ''\}" style="flex:1;"/.test(html));
  ok("tidak ada inline #e65100 di tombol", !/class="type-btn type-spoil[^>]*background:\$\{txnType/.test(html));
}

console.log("\n" + (fail ? "ADA YANG GAGAL: " + pass + " lulus, " + fail + " gagal" : "SEMUA LULUS: " + pass + " lulus, 0 gagal"));
process.exit(fail ? 1 : 0);
