/**
 * Tes RENDER PENUH halaman Input & Riwayat di DOM sungguhan (jsdom).
 *
 * Kenapa tes ini ada: tes lama mengekstrak potongan kode lalu menjalankannya di
 * sandbox vm. Cara itu tidak pernah menangkap ReferenceError lintas-scope —
 * mis. `_localYmd()` dipanggil dari dalam IIFE `App` padahal fungsinya hanya
 * hidup di dalam closure `DataService`. Akibatnya tab Input jadi kosong total
 * dan tes tetap hijau.
 *
 * Tes ini memuat index.html apa adanya, menyuntik sesi + data transaksi, lalu
 * memanggil App.navigateTo('input'/'history') seperti user mengetuk tab.
 *
 * Jalankan: cd security-tools && npm install && node test_render_pages.js
 */
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const HTML = path.join(__dirname, "..", "index.html");
const html = fs.readFileSync(HTML, "utf8");

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (extra === undefined ? "" : "  → " + JSON.stringify(extra))); }
}
const ymd = d => d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
const TODAY = ymd(new Date());
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };

const BASE_TXNS = [
  { id: "T-RIN", itemId: 1, itemName: "Beras", type: "IN", qty: 10, unit: "Kg", date: TODAY, time: "09:00:00", staff: "Ragil", division: "KITCHEN", notes: "-" },
  { id: "T-KLR", itemId: 1, itemName: "Beras", type: "OUT", qty: 2, unit: "Kg", date: TODAY + "T09:12:00", time: "09:12:00", staff: "Ragil", division: "KITCHEN", notes: "-" },
  { id: "T-SPL", itemId: 2, itemName: "Susu", type: "SPOIL", qty: 1, unit: "Liter", date: TODAY + " 10:30:00", time: "10:30:00", staff: "Ragil", division: "KITCHEN", spoilReason: "Basi / Busuk / Berjamur", notes: "-" },
  { id: "T-LMA", itemId: 1, itemName: "Beras", type: "OUT", qty: 3, unit: "Kg", date: daysAgo(3), time: "08:00:00", staff: "Doni", division: "BAR", notes: "tiga hari lalu" },
  { id: "T-RVS", itemId: 3, itemName: "Gula", type: "EDIT_ITEM", qty: 0, unit: "Kg", date: TODAY, time: "11:00:00", staff: "Ragil", division: "KITCHEN", notes: "Koreksi data: harga baru", unitPrice: 15000 },
];

function boot(opts) {
  const o = opts || {};
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", e => errors.push("jsdomError: " + (e && e.message)));
  vc.on("error", (...a) => errors.push("console.error: " + a.map(String).join(" ")));
  const dom = new JSDOM(html, {
    url: "https://rimbastock.local/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      // Tidak ada jaringan: semua fetch dijawab data kosong.
      window.fetch = async () => ({
        ok: true, status: 200,
        json: async () => ({ success: true, transactions: [], data: [], items: [], users: [] }),
        text: async () => "",
      });
      window.alert = () => {};
      window.localStorage.setItem("rimba_alam_transactions_v8", JSON.stringify(o.txns || BASE_TXNS));
      window.localStorage.setItem("rimba_alam_gas_url_v4", "");
      window.sessionStorage.setItem("rimba_alam_session", JSON.stringify({
        username: "ragil", name: "Ragil", role: "admin", division: "ADMIN",
        divisions: ["KITCHEN", "BAR", "PASTRY", "LAINNYA"], loginAt: new Date().toISOString(),
      }));
    },
  });
  dom.window.addEventListener("error", ev => errors.push("window.error: " + ev.message));
  return { window: dom.window, errors };
}

function call(label, fn) {
  const out = { ok: true };
  try { out.value = fn(); }
  catch (e) { out.ok = false; out.name = e && e.name; out.message = String(e && e.message); out.stack = e && e.stack; }
  if (!out.ok) { fail++; console.log("  FAIL " + label + " melempar " + out.name + ": " + out.message); }
  return out;
}
const rowsOf = w => { const el = w.document.getElementById("historyList"); return el ? el.querySelectorAll(".txn-row").length : -1; };

// ── 1. Tab Input ─────────────────────────────────────────────────────────
console.log("\n=== 1. Tab Input merender form ===");
{
  const { window, errors } = boot();
  const r = call("navigateTo('input')", () => window.App.navigateTo("input"));
  if (r.ok) {
    const box = window.document.getElementById("inputContent");
    ok("inputContent terisi", !!box && box.innerHTML.trim().length > 200, box && box.innerHTML.length);
    ok("kolom tanggal ada", !!window.document.getElementById("inputDate"));
    const dateEl = window.document.getElementById("inputDate");
    ok("tanggal default = hari ini (lokal)", !!dateEl && dateEl.value === TODAY, dateEl && dateEl.value);
    ok("tombol MASUK/KELUAR/SPOIL ada", box.querySelectorAll(".type-btn").length === 3, box.querySelectorAll(".type-btn").length);
    ok("nama staff terisi dari sesi", (window.document.getElementById("inputStaff") || {}).value === "Ragil");
  }
  const r2 = call("setTxnType('SPOIL')", () => window.App.setTxnType("SPOIL"));
  if (r2.ok) ok("pilih SPOIL merender ulang tanpa error", !!window.document.getElementById("inputSpoilReason"));
  ok("tidak ada error konsol", errors.length === 0, errors);
}

// ── 2. Tab Riwayat: default & chip tipe ──────────────────────────────────
console.log("\n=== 2. Tab Riwayat: default & chip tipe ===");
{
  const { window, errors } = boot();
  call("navigateTo('history')", () => window.App.navigateTo("history"));
  ok("default menampilkan transaksi hari ini", rowsOf(window) === 4, rowsOf(window));
  call("filterHistory('IN')", () => window.App.filterHistory("IN"));
  ok("chip Masuk", rowsOf(window) === 1, rowsOf(window));
  call("filterHistory('OUT')", () => window.App.filterHistory("OUT"));
  ok("chip Keluar", rowsOf(window) === 1, rowsOf(window));
  call("filterHistory('SPOIL')", () => window.App.filterHistory("SPOIL"));
  ok("chip Spoil", rowsOf(window) === 1, rowsOf(window));
  call("filterHistory('ALL')", () => window.App.filterHistory("ALL"));
  ok("chip Semua (masih hari ini)", rowsOf(window) === 4, rowsOf(window));
  ok("tidak ada error konsol", errors.length === 0, errors);
}

// ── 3. Preset "Semua" harus lengket ──────────────────────────────────────
console.log("\n=== 3. Preset Semua tidak boleh di-reset ke hari ini ===");
{
  const { window, errors } = boot();
  call("navigateTo('history')", () => window.App.navigateTo("history"));
  call("setHistoryDatePreset('ALL')", () => window.App.setHistoryDatePreset("ALL"));
  ok("Semua menampilkan 5 transaksi", rowsOf(window) === 5, rowsOf(window));
  const s = window.document.getElementById("histStartDate").value;
  const e2 = window.document.getElementById("histEndDate").value;
  ok("input tanggal dikosongkan", s === "" && e2 === "", { s, e2 });

  // Render ulang terjadi nyata: sync latar menambah baris, atau user buka tab lagi.
  call("render ulang history", () => window.App.navigateTo("history"));
  ok("Semua tetap 5 transaksi setelah render ulang", rowsOf(window) === 5, rowsOf(window));
  ok("tanggal tetap kosong setelah render ulang",
    window.document.getElementById("histStartDate").value === "" &&
    window.document.getElementById("histEndDate").value === "", {
      s: window.document.getElementById("histStartDate").value,
      e: window.document.getElementById("histEndDate").value,
    });

  call("filterHistory('OUT') di preset Semua", () => window.App.filterHistory("OUT"));
  ok("Semua + Keluar = 2 (termasuk 3 hari lalu)", rowsOf(window) === 2, rowsOf(window));
  call("render ulang lagi", () => window.App.navigateTo("history"));
  ok("filter Keluar tetap 2 setelah render ulang", rowsOf(window) === 2, rowsOf(window));

  call("setHistoryDatePreset('7DAYS')", () => window.App.setHistoryDatePreset("7DAYS"));
  const kept = rowsOf(window);
  call("render ulang 7 Hari", () => window.App.navigateTo("history"));
  ok("preset 7 Hari bertahan", rowsOf(window) === kept, { sebelum: kept, sesudah: rowsOf(window) });
  ok("tidak ada error konsol", errors.length === 0, errors);
}

// ── 4. Warna & badge tipe tidak berubah ──────────────────────────────────
console.log("\n=== 4. Warna/badge tipe dipertahankan ===");
{
  const { window } = boot();
  call("navigateTo('history')", () => window.App.navigateTo("history"));
  const list = window.document.getElementById("historyList");
  const htmlList = list.innerHTML;
  ok("baris MASUK pakai ikon .in", htmlList.includes('txn-icon in'));
  ok("baris KELUAR pakai ikon .out", htmlList.includes('txn-icon out'));
  ok("baris SPOIL pakai ikon .spoil", htmlList.includes('txn-icon spoil'));
  ok("badge SPOIL ada", htmlList.includes("🗑️ SPOIL"));
  ok("baris REVISI pakai ikon .revisi", htmlList.includes('txn-icon revisi'));
  ok("badge Revisi ada", htmlList.includes("🏷️ Revisi"));
}

// ── 5. Baris dengan tanggal aneh tidak mematikan halaman ─────────────────
console.log("\n=== 5. Tanggal tak terbaca tidak mengosongkan seluruh daftar ===");
{
  const txns = BASE_TXNS.concat([{ id: "T-BAD", itemId: 9, itemName: "Kopi", type: "OUT", qty: 1, unit: "Kg", date: "", time: "", staff: "Doni", division: "BAR" }]);
  const { window, errors } = boot({ txns });
  call("navigateTo('history')", () => window.App.navigateTo("history"));
  ok("hari ini tetap tampil walau ada baris tanpa tanggal", rowsOf(window) === 4, rowsOf(window));
  call("setHistoryDatePreset('ALL')", () => window.App.setHistoryDatePreset("ALL"));
  ok("Semua tetap menampilkan baris lain", rowsOf(window) >= 5, rowsOf(window));
  ok("tidak ada error konsol", errors.length === 0, errors);
}

// ── 6. Simpan transaksi memakai tanggal lokal ────────────────────────────
console.log("\n=== 6. Submit transaksi tetap jalan & tanggal lokal terpakai ===");
(async () => {
  const { window, errors } = boot();
  const items = window.DataService.getAllItems();
  ok("ada barang untuk diuji", Array.isArray(items) && items.length > 0, items && items.length);
  if (items && items.length) {
    const item = items[0];
    call("goToInputWithItem", () => window.App.goToInputWithItem(item.id));
    const dateEl = window.document.getElementById("inputDate");
    ok("form input terisi setelah pilih barang", !!dateEl && !!window.document.getElementById("inputQty"));
    if (dateEl) dateEl.value = ""; // paksa jalur fallback tanggal
    window.App.setQty(2);
    call("confirmSubmit", () => window.App.confirmSubmit());
    const summary = (window.document.getElementById("confirmSummary") || {}).textContent || "";
    ok("dialog konfirmasi memakai tanggal hari ini", summary.includes(TODAY), summary.slice(0, 160));
    const yes = window.document.getElementById("btnConfirmYes");
    if (yes) yes.click();
    await new Promise(r => setTimeout(r, 400));
    const saved = window.DataService.getTransactions(5).find(t => t.itemId === item.id && Number(t.qty) === 2);
    ok("transaksi tersimpan", !!saved, saved && { id: saved.id, qty: saved.qty });
    ok("tanggal transaksi = hari ini (lokal)", !!saved && saved.date === TODAY, saved && saved.date);
    ok("form input dirender ulang tanpa kosong", (window.document.getElementById("inputContent").innerHTML || "").length > 200);
  }
  ok("tidak ada error konsol", errors.length === 0, errors);

  console.log("\n" + (fail ? "ADA YANG GAGAL: " + pass + " lulus, " + fail + " gagal" : "SEMUA LULUS: " + pass + " lulus, 0 gagal"));
  process.exit(fail ? 1 : 0);
})();