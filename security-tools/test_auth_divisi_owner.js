/**
 * Regresi hak kategori input untuk akun Owner / Admin.
 *
 * Bug yang dijaga:
 *  - `isAdmin()` hanya mengenal admin/superadmin/satian, TIDAK "owner".
 *    Akibatnya akun owner dianggap staf biasa: `getAllowedDivisions()` menyempit,
 *    `canInputItemDivision("BAR")` menolak, dan header menampilkan Kitchen.
 *  - `getUserDivision()` memakai divisi mentah dari sheet, jadi akun admin yang
 *    kolom divisinya "KITCHEN" menampilkan badge Kitchen padahal boleh semua.
 *
 * Jalankan: node security-tools/test_auth_divisi_owner.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("  ok  " + name); }
  else { fail++; console.log("  FAIL " + name + (extra === undefined ? "" : "  → " + JSON.stringify(extra))); }
}

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const a = html.indexOf("function canManageUsers()");
const b = html.indexOf("function canInputStock()");
if (a < 0 || b < 0 || b < a) { console.error("blok AuthService tidak ditemukan"); process.exit(2); }
const block = html.slice(a, b);

function auth(session) {
  const sandbox = { console, String, Array, JSON, Number, Set, Object };
  vm.createContext(sandbox);
  vm.runInContext("var __session = null; function _getSession(){ return __session; }", sandbox);
  vm.runInContext(block, sandbox);
  sandbox.__session = session;
  vm.runInContext("__session = __session;", sandbox);
  // expose lewat fungsi dalam scope yang sama
  return {
    isAdmin: () => vm.runInContext("isAdmin()", sandbox),
    allowed: () => vm.runInContext("getAllowedDivisions()", sandbox),
    div: () => vm.runInContext("getUserDivision()", sandbox),
    canInput: (d) => vm.runInContext("canInputItemDivision(" + JSON.stringify(d) + ")", sandbox)
  };
}

const S = (over) => Object.assign({ username: "x", name: "X", role: "staff", division: "KITCHEN", divisions: ["KITCHEN"] }, over);

console.log("\n=== 1. Owner: akses penuh semua kategori ===");
{
  const o = auth(S({ username: "rian", role: "owner", division: "KITCHEN", divisions: ["KITCHEN"] }));
  ok("owner dikenali sebagai admin", o.isAdmin() === true, o.isAdmin());
  ok("owner dapat 4 divisi", o.allowed().length === 4, o.allowed());
  ok("owner boleh input BAR", o.canInput("BAR") === true, o.canInput("BAR"));
  ok("owner boleh input PASTRY", o.canInput("PASTRY") === true, o.canInput("PASTRY"));
  ok("owner boleh input KITCHEN", o.canInput("KITCHEN") === true);
  ok("badge owner = ADMIN, bukan KITCHEN", o.div() === "ADMIN", o.div());
}

console.log("\n=== 2. Admin: akses penuh, badge tidak menyesatkan ===");
{
  const ad = auth(S({ username: "adm", role: "admin", division: "KITCHEN", divisions: ["KITCHEN"] }));
  ok("admin dikenali", ad.isAdmin() === true);
  ok("admin dapat 4 divisi", ad.allowed().length === 4, ad.allowed());
  ok("admin boleh input BAR", ad.canInput("BAR") === true);
  ok("badge admin = ADMIN walaupun kolom divisi KITCHEN", ad.div() === "ADMIN", ad.div());
}

console.log("\n=== 3. Superadmin & satian ===");
{
  const sa = auth(S({ username: "satian", role: "superadmin", division: "KITCHEN", divisions: ["KITCHEN"] }));
  ok("superadmin akses penuh", sa.isAdmin() === true && sa.allowed().length === 4);
  ok("superadmin badge ADMIN", sa.div() === "ADMIN", sa.div());
  const st = auth(S({ username: "satian", role: "staff", division: "KITCHEN", divisions: ["KITCHEN"] }));
  ok("username satian tetap dianggap admin", st.isAdmin() === true);
}

console.log("\n=== 4. Staf tetap dibatasi (jangan longgar) ===");
{
  const k = auth(S({ role: "staff", division: "KITCHEN", divisions: ["KITCHEN"] }));
  ok("staf kitchen bukan admin", k.isAdmin() === false);
  ok("staf kitchen hanya KITCHEN + LAINNYA", k.allowed().join(",") === "KITCHEN,LAINNYA", k.allowed());
  ok("staf kitchen tidak boleh input BAR", k.canInput("BAR") === false);
  ok("staf kitchen tetap boleh LAINNYA", k.canInput("LAINNYA") === true);

  const bar = auth(S({ role: "staff", division: "BAR", divisions: ["BAR"] }));
  ok("staf bar hanya BAR + LAINNYA", bar.allowed().join(",") === "BAR,LAINNYA", bar.allowed());
  ok("staf bar tidak boleh input KITCHEN", bar.canInput("KITCHEN") === false);

  const multi = auth(S({ role: "staff", division: "KITCHEN", divisions: ["KITCHEN", "BAR"] }));
  ok("staf multi-divisi dapat keduanya", multi.allowed().join(",") === "KITCHEN,BAR,LAINNYA", multi.allowed());
  ok("staf multi-divisi boleh input BAR", multi.canInput("BAR") === true);
}

console.log("\n" + (fail ? "ADA YANG GAGAL: " + pass + " lulus, " + fail + " gagal" : "SEMUA LULUS: " + pass + " lulus, 0 gagal"));
process.exit(fail ? 1 : 0);
