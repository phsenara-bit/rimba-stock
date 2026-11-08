// Uji security-gate-pin.gs di Node dengan stub Apps Script.
const fs = require("fs");
const vm = require("vm");

const GATE = "Rimba-Alam-Web/security-gate-pin.gs";
if (!fs.existsSync(GATE)) {
  console.error("RED: file gate belum ada -> " + GATE);
  process.exit(1);
}

const users = [
  ["USERNAME", "NAMA KARYAWAN", "PIN", "IZIN AKSES DIVISI", "ROLE", "AVATAR", "TANGGAL DAFTAR"],
  ["admin", "Admin Rimba Alam", "'1212", "KITCHEN, BAR", "superadmin", "x", "2026-01-01"],
  ["ragil", "Ragil", 5678, "KITCHEN", "admin", "x", "2026-01-01"],
  ["chef", "Chef Rina", "'9999", "KITCHEN", "staff", "x", "2026-01-01"],
];

function makeCtx(props) {
  const cache = new Map();
  const ctx = {
    console: { log() {}, warn() {} },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (n) =>
          n === "DATA_PENGGUNA"
            ? { getLastRow: () => users.length, getRange: () => ({ getValues: () => users }) }
            : null,
      }),
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (cache.has(k) ? cache.get(k) : null),
        put: (k, v) => cache.set(k, v),
        remove: (k) => cache.delete(k),
      }),
    },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null) }),
    },
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput(t) {
        const o = { text: t };
        o.setMimeType = () => o;
        return o;
      },
    },
    _realDoGet: () => ({ ok: "GET" }),
    _realDoPost: () => ({ ok: "POST" }),
    Utilities: { formatDate: () => "2026-11-08" },
    __cache: cache,
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(GATE, "utf8"), ctx);
  return ctx;
}

const results = [];
const check = (n, c, x = "") => results.push([c ? "PASS" : "FAIL", n, x]);
const body = (o) => ({ parameter: {}, postData: { contents: JSON.stringify(o) } });
const parse = (r) => (r && r.text ? JSON.parse(r.text) : r);

// ── 1. gate aktif tanpa konfigurasi owner
let ctx = makeCtx({});
let r = ctx.doPost(body({ type: "IN", qty: 5 }));
r = parse(r);
check("tanpa kredensial -> ditolak", r.success === false && r.code === "UNAUTHORIZED", JSON.stringify(r));

r = parse(ctx.doPost(body({ authUser: "chef", authPin: "0000", type: "IN" })));
check("PIN salah -> ditolak", r.code === "UNAUTHORIZED");

r = parse(ctx.doPost(body({ authUser: "chef", authPin: "9999", type: "IN", qty: 5 })));
check("PIN benar -> diteruskan ke doPost asli", r && r.ok === "POST", JSON.stringify(r));

// PIN tersimpan sebagai teks ber-apostrof di sheet
r = parse(ctx.doPost(body({ authUser: "admin", authPin: "1212", type: "OUT" })));
check("PIN dengan apostrof di sheet tetap cocok", r && r.ok === "POST");

// PIN angka (bukan teks) di sheet
r = parse(ctx.doPost(body({ authUser: "ragil", authPin: "5678", type: "OUT" })));
check("PIN numerik di sheet tetap cocok", r && r.ok === "POST");

// username case-insensitive
r = parse(ctx.doPost(body({ authUser: "  CHEF ", authPin: "9999", type: "IN" })));
check("username case/spasi dinormalisasi", r && r.ok === "POST");

// ── 2. hapus user & ubah PIN user lain = hanya admin
r = parse(ctx.doPost(body({ authUser: "chef", authPin: "9999", action: "deleteUser", username: "ragil" })));
check("staff tidak boleh deleteUser", r.code === "FORBIDDEN", JSON.stringify(r));

r = parse(ctx.doPost(body({ authUser: "chef", authPin: "9999", action: "updateUserPin", username: "ragil", pin: "1111" })));
check("staff tidak boleh ubah PIN orang lain", r.code === "FORBIDDEN");

r = parse(ctx.doPost(body({ authUser: "chef", authPin: "9999", action: "updateUserPin", username: "chef", pin: "4444" })));
check("staff boleh ubah PIN sendiri", r && r.ok === "POST");

r = parse(ctx.doPost(body({ authUser: "ragil", authPin: "5678", action: "deleteUser", username: "chef" })));
check("admin boleh deleteUser", r && r.ok === "POST");

r = parse(ctx.doPost(body({ authUser: "admin", authPin: "1212", action: "saveUser", username: "baru", pin: "1234" })));
check("superadmin boleh saveUser", r && r.ok === "POST");

// ── 3. GET (baca) juga butuh kredensial
r = parse(ctx.doGet({ parameter: {} }));
check("GET tanpa kredensial -> ditolak", r.code === "UNAUTHORIZED");

r = ctx.doGet({ parameter: { action: "readSheetData", authUser: "chef", authPin: "9999" } });
check("GET dengan kredensial -> lolos", r && r.ok === "GET");

// ── 4. owner (satian) tidak ada di sheet
r = parse(ctx.doPost(body({ authUser: "satian", authPin: "1212", type: "IN" })));
check("satian ditolak kalau OWNER_PIN belum diset", r.code === "UNAUTHORIZED");

ctx = makeCtx({ OWNER_USERNAME: "satian", OWNER_PIN: "777777" });
r = parse(ctx.doPost(body({ authUser: "satian", authPin: "777777", type: "IN" })));
check("satian diterima lewat Script Property", r && r.ok === "POST", JSON.stringify(r));
r = parse(ctx.doPost(body({ authUser: "satian", authPin: "1212", type: "IN" })));
check("PIN 1212 lama milik satian sudah tidak berlaku", r.code === "UNAUTHORIZED");

// ── 5. lockout setelah percobaan gagal berulang
ctx = makeCtx({});
for (let i = 0; i < 10; i++) ctx.doPost(body({ authUser: "chef", authPin: "0000" }));
r = parse(ctx.doPost(body({ authUser: "chef", authPin: "9999", type: "IN" })));
check("akun terkunci setelah 10x salah", r.code === "LOCKED" && r.success === false, JSON.stringify(r));
r = parse(ctx.doPost(body({ authUser: "admin", authPin: "1212", type: "IN" })));
check("akun lain tidak ikut terkunci", r && r.ok === "POST");

// ── 6. payload rusak tidak boleh meloloskan
r = parse(ctx.doPost({ parameter: {}, postData: { contents: "bukan json{{" } }));
check("body rusak -> ditolak rapi", r.code === "UNAUTHORIZED", JSON.stringify(r));

// ── 7. field authUser tidak boleh dipakai untuk memalsukan identitas lain
ctx = makeCtx({});
r = parse(ctx.doPost(body({ authUser: "chef", authPin: "9999", username: "admin", action: "deleteUser" })));
check("payload username tidak menimpa identitas terautentikasi", r.code === "FORBIDDEN", JSON.stringify(r));

let fails = 0;
for (const [st, n, x] of results) {
  if (st === "FAIL") fails++;
  console.log(st.padEnd(5), n, st === "FAIL" ? "-> " + x : "");
}
console.log(`\n${results.length - fails}/${results.length} lolos`);
process.exit(fails ? 1 : 0);
