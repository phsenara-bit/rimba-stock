/* Uji shim fetch (isolasi): token ditempel ke URL/body, PIN tidak pernah dipakai. */
const fs = require("fs");
const vm = require("vm");

const html = fs.readFileSync("/home/xellium/rimba-stock/index.html", "utf8");

// ambil blok shim apa adanya dari bundle
const start = html.indexOf("  function readSessionToken() {");
const end = html.indexOf("  function setGasUrl(url) {");
if (start < 0 || end < 0) throw new Error("blok shim tidak ditemukan");
const shimSrc = html.slice(start, end);

const sent = [];
const win = {
  fetch: (input, init) => { sent.push({ input: input, init: init }); return Promise.resolve({ ok: true }); },
  sessionStorage: {
    _d: { rimba_alam_session: JSON.stringify({ username: "ragil", token: "TOKEN-ABC-123" }) },
    getItem(k) { return this._d[k] === undefined ? null : this._d[k]; },
    setItem(k, v) { this._d[k] = v; },
    removeItem(k) { delete this._d[k]; }
  }
};
win.window = win;

const sandbox = { window: win, console: console, Promise: Promise, URLSearchParams: URLSearchParams, JSON: JSON, encodeURIComponent: encodeURIComponent };
vm.createContext(sandbox);
vm.runInContext(shimSrc, sandbox);   // blok shim sudah berupa IIFE yang langsung jalan

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  cond ? pass++ : fail++;
  console.log((cond ? "PASS" : "FAIL") + " · " + label + (cond ? "" : "  → " + JSON.stringify(extra)));
};

(async () => {
  // GET
  await win.fetch("https://script.google.com/macros/s/ABC/exec?action=readSheetData", { method: "GET" });
  const g = sent.pop();
  const gUrl = typeof g.input === "string" ? g.input : g.input.url;
  ok("GET: token ditempel ke URL", gUrl.indexOf("authToken=TOKEN-ABC-123") !== -1, gUrl);
  ok("GET: PIN tidak ada di URL", gUrl.indexOf("authPin") === -1 && gUrl.indexOf("authUser") === -1, gUrl);
  ok("GET: parameter asli utuh", gUrl.indexOf("action=readSheetData") !== -1, gUrl);

  // POST
  await win.fetch("https://script.google.com/macros/s/ABC/exec", {
    method: "POST",
    body: JSON.stringify({ action: "addItem", name: "gula", division: "KITCHEN" })
  });
  const p = sent.pop();
  const body = JSON.parse(p.init.body);
  ok("POST: token masuk body", body.authToken === "TOKEN-ABC-123", body);
  ok("POST: PIN tidak ikut", !body.authPin && !body.authUser, body);
  ok("POST: payload asli utuh", body.name === "gula" && body.division === "KITCHEN", body);

  // POST updateUserPin (target lain) tidak boleh tertimpa
  await win.fetch("https://script.google.com/macros/s/ABC/exec", {
    method: "POST",
    body: JSON.stringify({ action: "updateUserPin", username: "chef", pin: "7788" })
  });
  const u = JSON.parse(sent.pop().init.body);
  ok("POST: target PIN orang lain tidak tertimpa", u.username === "chef" && u.pin === "7788", u);

  // tanpa sesi
  win.sessionStorage.removeItem("rimba_alam_session");
  await win.fetch("https://script.google.com/macros/s/ABC/exec?action=readUsers", { method: "GET" });
  const anon = sent.pop();
  const anonUrl = typeof anon.input === "string" ? anon.input : anon.input.url;
  ok("tanpa sesi: URL tidak dimodifikasi", anonUrl === "https://script.google.com/macros/s/ABC/exec?action=readUsers", anonUrl);

  // URL non-GAS tidak disentuh
  await win.fetch("https://rimbastock.my.id/api/sync-gas", { method: "GET" });
  const other = sent.pop();
  ok("URL non-GAS dibiarkan", (typeof other.input === "string" ? other.input : other.input.url) === "https://rimbastock.my.id/api/sync-gas");

  console.log("\n" + (fail === 0 ? "SEMUA LULUS" : "ADA YANG GAGAL") + `: ${pass} pass, ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
})();