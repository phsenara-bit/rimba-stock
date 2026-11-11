/**
 * Uji handler ganti PIN setelah perbaikan await.
 *
 * Bug asli: AuthService.changeMyPin() async, tapi submitChangePin tidak
 * menunggu hasilnya. res = Promise → res.success undefined → jatuh ke cabang
 * error → showToast(undefined) → toast merah tanpa teks, padahal PIN di server
 * SUDAH berubah (terbukti: login pakai PIN baru berhasil).
 */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const start = html.indexOf("  async function submitChangePin(e) {");
const end = html.indexOf("  // ── EDIT USER", start);
if (start < 0 || end < 0) { console.error("submitChangePin tidak ditemukan"); process.exit(1); }
const src = html.slice(start, end);

let pass = 0, fail = 0;
const ok = (l, c, x) => { c ? pass++ : fail++; console.log((c ? "PASS" : "FAIL") + " · " + l + (c ? "" : "  → " + JSON.stringify(x))); };

function run(opts) {
  const toasts = [];
  const inputs = opts.inputs || {};
  const sandbox = {
    console,
    showToast: (m, t) => toasts.push({ message: m, type: t }),
    closeChangePinDialog: () => { sandbox.__closed = true; },
    renderSettings: () => {},
    document: {
      getElementById: (id) => (id in inputs ? { value: inputs[id], focus() {} } : null)
    },
    esc: (s) => String(s == null ? "" : s),
    AuthService: opts.auth
  };
  sandbox._changePinTargetUser = opts.target || null;
  sandbox.currentPage = "settings";
  const ctx = vm.createContext(sandbox);
  vm.runInContext(src + "\nthis.__fn = submitChangePin;", ctx);
  return { ctx, toasts, run: (e) => ctx.__fn(e) };
}

(async () => {
  // 1. PIN sendiri, server sukses
  {
    const t = run({
      inputs: { inputOldPin: "1111", inputNewPin: "2222", inputConfirmPin: "2222" },
      auth: { changeMyPin: async () => ({ success: true, message: "PIN Anda berhasil diperbarui." }) }
    });
    const r = t.run({ preventDefault() {} });
    ok("handler mengembalikan Promise (async)", typeof r === "object" && typeof r.then === "function");
    await r;
    const last = t.toasts[t.toasts.length - 1];
    ok("toast sukses, bukan error", last && last.type === "success", t.toasts);
    ok("pesan punya teks", last && typeof last.message === "string" && last.message.length > 5, last);
    ok("dialog ditutup", t.ctx.__closed === true);
  }

  // 2. PIN sendiri, server menolak
  {
    const t = run({
      inputs: { inputOldPin: "0000", inputNewPin: "2222", inputConfirmPin: "2222" },
      auth: { changeMyPin: async () => ({ success: false, message: "PIN lama salah." }) }
    });
    await t.run({ preventDefault() {} });
    const last = t.toasts[t.toasts.length - 1];
    ok("penolakan server → toast error berisi pesan", last && last.type === "error" && last.message === "PIN lama salah.", last);
  }

  // 3. Admin mengubah PIN karyawan lain
  {
    const t = run({
      target: "rey",
      inputs: { inputNewPin: "3333", inputConfirmPin: "3333" },
      auth: { setEmployeePin: async () => ({ success: true, message: 'PIN untuk "Rey" berhasil diubah.' }) }
    });
    await t.run({ preventDefault() {} });
    const last = t.toasts[t.toasts.length - 1];
    ok("ubah PIN orang lain → toast sukses berteks", last && last.type === "success" && /Rey/.test(last.message), last);
  }

  // 4. AuthService melempar error (jaringan putus)
  {
    const t = run({
      inputs: { inputOldPin: "1111", inputNewPin: "2222", inputConfirmPin: "2222" },
      auth: { changeMyPin: async () => { throw new Error("network down"); } }
    });
    await t.run({ preventDefault() {} });
    const last = t.toasts[t.toasts.length - 1];
    ok("exception → toast error berisi sebab", last && last.type === "error" && /network down/.test(last.message), last);
  }

  // 5. Validasi lokal tetap jalan tanpa memanggil server
  {
    let called = false;
    const t = run({
      inputs: { inputOldPin: "", inputNewPin: "2222", inputConfirmPin: "2222" },
      auth: { changeMyPin: async () => { called = true; return { success: true }; } }
    });
    await t.run({ preventDefault() {} });
    ok("PIN lama kosong ditolak lokal", called === false, called);
    ok("ada toast 'PIN lama wajib diisi'", t.toasts.some(x => /PIN lama wajib/i.test(x.message || "")), t.toasts);
  }

  console.log("\n" + pass + " lulus, " + fail + " gagal");
  process.exit(fail ? 1 : 0);
})();
