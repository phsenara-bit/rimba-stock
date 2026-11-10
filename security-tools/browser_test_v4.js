/* Uji frontend v4 di browser sungguhan: login lewat server, token di shim,
   PIN tidak pernah tersimpan di perangkat. */
const fs = require("fs");

const APP = "file:///home/xellium/rimba-stock/index.html";
const html = fs.readFileSync("/home/xellium/rimba-stock/index.html", "utf8");

const step = (label) => `# ${label}`;

const injectMock = () => {
  const orig = window.fetch.bind(window);
  window.__calls = [];
  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    const method = ((init && init.method) || "GET").toUpperCase();
    const body = (init && typeof init.body === "string") ? init.body : "";
    window.__calls.push({ url: url, method: method, body: body });
    if (url.indexOf("script.google.com") === -1) return orig(input, init);

    let payload = {};
    try { payload = JSON.parse(body || "{}"); } catch (e) {}
    let reply;
    if (payload.action === "login") {
      const okUser = (payload.username || "").toLowerCase() === "ragil" && payload.pin === "2468";
      reply = okUser
        ? { success: true, token: "TOKEN-UJI-1234567890abcdef", expiresIn: 21600,
            user: { username: "ragil", name: "Ragil", role: "admin", division: "KITCHEN",
                    divisions: ["KITCHEN", "BAR"], avatar: "👨‍💼" } }
        : { success: false, code: "UNAUTHORIZED", message: "Nama atau PIN tidak cocok." };
    } else if (payload.action === "logout") {
      reply = { success: true };
    } else if (payload.action === "updateUserPin") {
      reply = { success: true, message: "PIN diperbarui." };
    } else if (url.indexOf("script.google.com") !== -1 && method === "GET") {
      reply = { success: true, count: 0, users: [] };
    } else {
      reply = { success: true };
    }
    return Promise.resolve(new Response(JSON.stringify(reply), { status: 200, headers: { "Content-Type": "application/json" } }));
  };
  return "mock terpasang";
};

(async () => {
  const out = [];
  const push = (label, ok, extra) => out.push({ label, ok, extra });

  new_tab(APP);
  wait_for_load();
  await new Promise((r) => setTimeout(r, 2500));

  // pastikan URL server terisi supaya login diarahkan ke mock
  js(`(() => {
    try { localStorage.setItem("rimba_alam_gas_url_v1", "https://script.google.com/macros/s/MOCK/exec"); } catch (e) {}
    return "ok";
  })()`);

  js(`(${injectMock.toString()})()`);

  // ── 1. tidak ada PIN rahasia di bundle ──────────────────────────────
  const bundle = js(`document.documentElement.innerHTML`);
  push("bundle tidak memuat PIN owner 1212", bundle.indexOf("1212") === -1, (bundle.match(/1212/g) || []).length);
  push("login tidak lagi membandingkan PIN di browser",
    bundle.indexOf("const correctPin = String(matchedUser.pin") === -1);
  push("shim memakai authToken, bukan authPin",
    bundle.indexOf("obj.authPin") === -1 && bundle.indexOf("obj.authToken") !== -1);

  // ── 2. PIN salah ditolak server, tanpa menyimpan apa pun ────────────
  const bad = await js(`(async () => {
    const r = await window.AuthService.login("ragil", "0000");
    return JSON.stringify({ ok: r.success, msg: r.message });
  })()`);
  const badObj = JSON.parse(bad);
  push("PIN salah ditolak", badObj.ok === false && /tidak cocok/i.test(badObj.msg), badObj);

  // ── 3. login benar: token tersimpan, PIN tidak ──────────────────────
  const good = await js(`(async () => {
    const r = await window.AuthService.login("ragil", "2468");
    const sess = JSON.parse(sessionStorage.getItem("rimba_alam_session_v1") || "{}");
    const savedUsers = localStorage.getItem("rimba_alam_users_v1") || "";
    return JSON.stringify({
      ok: r.success, token: sess.token || "", name: sess.name || "",
      usersRaw: savedUsers
    });
  })()`);
  const g = JSON.parse(good);
  push("login server berhasil", g.ok === true, g);
  push("token sesi tersimpan", g.token === "TOKEN-UJI-1234567890abcdef", g.token);
  push("PIN tidak tersimpan di localStorage pengguna", g.usersRaw.indexOf("2468") === -1 && g.usersRaw.indexOf('"pin"') === -1, g.usersRaw.slice(0, 80));
  push("sessionStorage tidak lagi menyimpan PIN", (js(`sessionStorage.getItem("rimba_alam_device_cred_v1")`) === null));

  // ── 4. request berikutnya membawa token, bukan PIN ──────────────────
  await js(`(async () => {
    try { await fetch("https://script.google.com/macros/s/MOCK/exec?action=readUsers", { method: "GET" }); } catch (e) {}
    return "ok";
  })()`);
  const last = JSON.parse(js(`JSON.stringify(window.__calls[window.__calls.length - 1])`));
  push("GET ke GAS membawa authToken", /authToken=TOKEN-UJI/.test(last.url), last.url.slice(-60));
  push("GET ke GAS tidak membawa authPin", last.url.indexOf("authPin") === -1, last.url.slice(-60));

  // ── 5. logout mencabut sesi di server & menghapus token ─────────────
  await js(`(async () => { window.AuthService.logout(); await new Promise(r => setTimeout(r, 400)); return "ok"; })()`);
  const afterLogout = JSON.parse(js(`JSON.stringify({
    sess: sessionStorage.getItem("rimba_alam_session_v1"),
    logoutSent: (window.__calls || []).some(c => (c.body || "").indexOf('"logout"') !== -1)
  })`));
  push("logout mengirim permintaan ke server", afterLogout.logoutSent === true, afterLogout);
  push("sesi lokal dibersihkan", afterLogout.sess === null, afterLogout.sess);

  // ── 6. chat AI tetap ada, tutup = sesi baru ─────────────────────────
  push("modul chat AI terpasang", js(`!!document.getElementById("askAiDialog")`) === true);
  push("tombol chat ada di top bar", js(`!!document.querySelector(".top-bar #btnAskAi")`) === true);

  const failed = out.filter((o) => !o.ok);
  out.forEach((o) => console.log((o.ok ? "PASS" : "FAIL") + " · " + o.label + (o.ok ? "" : "  → " + JSON.stringify(o.extra))));
  console.log("\n" + (failed.length === 0 ? "SEMUA LULUS" : "ADA YANG GAGAL") + `: ${out.length - failed.length} pass, ${failed.length} fail`);
  if (failed.length) throw new Error("ada asersi gagal");
})();
