/**
 * ═���══════════════════════════════════════════════════════════════════════════
 * BAGIAN 1 — AUTENTIKASI & OTORISASI (v4, sesi token)
 * ════════════════════════════════════════════════════════════════════════════
 * Prinsip:
 *   1. PIN hanya dikirim SEKALI, saat login. Setelah itu klien memakai token.
 *   2. Tidak ada respons server yang memuat PIN — termasuk daftar pengguna.
 *   3. Semua route baca/tulis wajib sesi, kecuali login & ping.
 *   4. Hak admin & batas divisi diperiksa di server, bukan hanya di UI.
 *
 * Sesi disimpan di CacheService (maks 6 jam), jadi tidak ada tabel sesi dan
 * tidak ada rahasia yang ikut ter-deploy.
 * ════════════════════════════════════════════════════════════════════════════
 */

const G2_USERS_SHEET = "DATA_PENGGUNA";
const G2_USERS_TTL = 120;            // cache daftar karyawan (detik)
const G2_SESSION_TTL = 21600;        // umur sesi: 6 jam (batas maksimum cache)
const G2_SESSION_PREFIX = "sess_v4_";
const G2_LOGIN_MAX_FAILS = 5;        // salah PIN sebelum akun dikunci
const G2_LOGIN_GLOBAL_MAX_FAILS = 25; // batas gabungan semua akun per 10 menit
const G2_LOGIN_LOCK_SECONDS = 600;   // 10 menit
const G2_VERSION = "4.0";

/* ── util respons ──────────────────────────────────────────────────────── */

function _g2Json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function _g2Deny(code, message) {
  return _g2Json({ success: false, code: code, message: message });
}

function _g2Str(value) {
  return String(value === undefined || value === null ? "" : value).trim();
}

function _g2User(value) {
  return _g2Str(value).toLowerCase();
}

/** PIN di sheet bisa tersimpan sebagai '1234 (teks ber-apostrof) atau angka. */
function _g2Pin(value) {
  return _g2Str(value).replace(/^'+/, "").trim();
}

function _g2Same(a, b) {
  a = String(a);
  b = String(b);
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function _g2IsPrivileged(role) {
  return role === "admin" || role === "superadmin" || role === "owner";
}

/* ── daftar karyawan (server-side, berisi PIN — JANGAN dikirim ke klien) ── */

function _g2Users() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("g2_users_v1");
  if (cached) {
    try {
      const arr = JSON.parse(cached);
      if (Array.isArray(arr)) return arr;
    } catch (e) {
      /* cache rusak → baca ulang */
    }
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = null;
  if (typeof getOrCreateUsersSheet === "function") {
    try {
      sheet = getOrCreateUsersSheet(ss);
    } catch (e) {
      sheet = null;
    }
  }
  if (!sheet) sheet = ss.getSheetByName(G2_USERS_SHEET);

  const users = [];
  if (sheet) {
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const values = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
      for (let i = 0; i < values.length; i++) {
        const row = values[i] || [];
        const username = _g2User(row[0]);
        if (!username || username === "username" || username === "satian") continue;
        const divisions = String(row[3] || "KITCHEN")
          .split(",")
          .map(function (d) { return _g2Str(d).toUpperCase(); })
          .filter(function (d) { return !!d; });
        users.push({
          username: username,
          name: _g2Str(row[1]) || username,
          pin: _g2Pin(row[2]),
          divisions: divisions.length ? divisions : ["KITCHEN"],
          role: _g2User(row[4]) || "staff",
          avatar: _g2Str(row[5])
        });
      }
    }
  }

  if (users.length) {
    try {
      cache.put("g2_users_v1", JSON.stringify(users), G2_USERS_TTL);
    } catch (e) {}
  }
  return users;
}

/** Versi aman untuk dikirim ke browser: tanpa PIN. */
function _g2PublicUser(u) {
  if (!u) return null;
  return {
    username: u.username,
    name: u.name || u.username,
    role: u.role || "staff",
    division: (u.divisions && u.divisions[0]) || "KITCHEN",
    divisions: (u.divisions || ["KITCHEN"]).slice(),
    avatar: u.avatar || ""
  };
}

/** Daftar karyawan tanpa PIN (dipakai handleReadUsers versi aman). */
function _g2PublicUsers() {
  return _g2Users().map(_g2PublicUser);
}

function _g2InvalidateUsers() {
  try {
    CacheService.getScriptCache().remove("g2_users_v1");
  } catch (e) {}
}

/* ── akun owner dari Script Properties ─────────────────────────────────── */

function _g2Owner() {
  try {
    const props = PropertiesService.getScriptProperties();
    const user = _g2User(props.getProperty("OWNER_USERNAME")) || "satian";
    const pin = _g2Pin(props.getProperty("OWNER_PIN"));
    if (!pin) return null;
    return {
      username: user,
      name: _g2Str(props.getProperty("OWNER_NAME")) || "Owner",
      pin: pin,
      role: "owner",
      divisions: ["KITCHEN", "BAR", "PASTRY", "LAINNYA"],
      avatar: "👑"
    };
  } catch (e) {
    return null;
  }
}

/** Cari karyawan berdasarkan username, lalu nama lengkap. */
function _g2FindUser(login) {
  const key = _g2User(login);
  if (!key) return null;
  const users = _g2Users();
  for (let i = 0; i < users.length; i++) {
    if (users[i].username === key) return users[i];
  }
  const squash = key.replace(/\s+/g, "");
  for (let i = 0; i < users.length; i++) {
    if (_g2User(users[i].name) === key || _g2User(users[i].name).replace(/\s+/g, "") === squash) {
      return users[i];
    }
  }
  return null;
}

/* ── sesi ──────────────────────────────────────────────────────────────── */

function _g2NewToken() {
  let raw = "";
  try {
    raw = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
  } catch (e) {
    raw = "";
  }
  while (raw.length < 32) {
    raw += Math.floor(Math.random() * 0xffffffff).toString(16);
  }
  return raw.slice(0, 48);
}

// Revisi akun: naikkan saat PIN/role/divisi berubah atau akun dihapus.
// Sesi menyimpan revisi saat login; kalau tidak cocok, sesi dianggap mati.
function _g2UserRev(username) {
  const u = _g2User(username);
  if (!u) return 0;
  try {
    return parseInt(CacheService.getScriptCache().get("g2_rev_" + u) || "0", 10) || 0;
  } catch (e) { return 0; }
}

function _g2BumpUserRev(username) {
  const u = _g2User(username);
  if (!u) return;
  try {
    CacheService.getScriptCache().put("g2_rev_" + u, String(_g2UserRev(u) + 1), G2_SESSION_TTL);
  } catch (e) {}
}

function _g2ReseatSession(token, data) {
  if (!token) return;
  try {
    data.rev = _g2UserRev(data.username);
    CacheService.getScriptCache().put(G2_SESSION_PREFIX + token, JSON.stringify(data), G2_SESSION_TTL);
  } catch (e) {}
}

function _g2CreateSession(user) {
  const token = _g2NewToken();
  const payload = {
    username: user.username,
    name: user.name || user.username,
    role: user.role || "staff",
    divisions: (user.divisions || ["KITCHEN"]).slice(),
    avatar: user.avatar || "",
    rev: _g2UserRev(user.username),
    loginAt: new Date().getTime()
  };
  CacheService.getScriptCache().put(G2_SESSION_PREFIX + token, JSON.stringify(payload), G2_SESSION_TTL);
  return { token: token, user: _g2PublicUser(payload), expiresIn: G2_SESSION_TTL };
}

function _g2ReadSession(token) {
  if (!token) return null;
  const cache = CacheService.getScriptCache();
  const key = G2_SESSION_PREFIX + token;
  let raw = null;
  try {
    raw = cache.get(key);
  } catch (e) {
    return null;
  }
  if (!raw) return null;
  let data = null;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return null;
  }
  if (!data || !data.username) return null;
  // Akun dihapus, PIN diganti, atau role/divisi berubah → sesi lama mati.
  if (parseInt(data.rev, 10) !== _g2UserRev(data.username)) {
    try { cache.remove(key); } catch (e) {}
    return null;
  }
  // sliding expiration: sesi yang aktif tidak mati di tengah kerja
  try {
    cache.put(key, raw, G2_SESSION_TTL);
  } catch (e) {}
  return data;
}

function _g2DropSession(token) {
  if (!token) return;
  try {
    CacheService.getScriptCache().remove(G2_SESSION_PREFIX + token);
  } catch (e) {}
}

/** Token bisa datang dari query (?authToken=) atau body JSON. */
function _g2Token(e, body) {
  if (body && typeof body === "object" && body.authToken) return _g2Str(body.authToken);
  if (e && e.parameter && (e.parameter.authToken || e.parameter.authtoken)) {
    return _g2Str(e.parameter.authToken || e.parameter.authtoken);
  }
  return "";
}

/* ── login ─────────────────────────────────────────────────────────────── */

function _g2HandleLogin(body) {
  const login = _g2User(body && (body.username || body.authUser || body.name));
  const pin = _g2Pin(body && (body.pin || body.authPin));

  if (!login || !pin) {
    return _g2Deny("UNAUTHORIZED", "Nama dan PIN wajib diisi.");
  }

  const cache = CacheService.getScriptCache();
  const lockKey = "g2_fail_" + login;
  const globalKey = "g2_fail_global";
  const fails = parseInt(cache.get(lockKey) || "0", 10) || 0;
  const globalFails = parseInt(cache.get(globalKey) || "0", 10) || 0;
  if (fails >= G2_LOGIN_MAX_FAILS) {
    return _g2Deny("LOCKED", "Akun terkunci sementara karena terlalu banyak PIN salah. Coba lagi 10 menit.");
  }
  // Batas gabungan: menyerang banyak username dengan 1 PIN tetap kena.
  if (globalFails >= G2_LOGIN_GLOBAL_MAX_FAILS) {
    return _g2Deny("LOCKED", "Terlalu banyak percobaan login. Coba lagi 10 menit.");
  }

  let matched = null;
  // Owner HANYA dari Script Properties (OWNER_PIN). Tidak ada PIN bawaan:
  // kalau propertinya kosong, owner sengaja tidak bisa masuk sampai diisi.
  const owner = _g2Owner();
  if (owner && owner.username === login) {
    if (_g2Same(owner.pin, pin)) matched = owner;
  }
  if (!matched) {
    const user = _g2FindUser(login);
    if (user && _g2Same(user.pin, pin)) matched = user;
  }

  if (!matched) {
    try {
      cache.put(lockKey, String(fails + 1), G2_LOGIN_LOCK_SECONDS);
      cache.put(globalKey, String(globalFails + 1), G2_LOGIN_LOCK_SECONDS);
    } catch (e) {}
    return _g2Deny("UNAUTHORIZED", "Nama atau PIN tidak cocok.");
  }

  try {
    cache.remove(lockKey);
  } catch (e) {}

  const session = _g2CreateSession(matched);
  return _g2Json({
    success: true,
    token: session.token,
    expiresIn: session.expiresIn,
    user: session.user,
    message: "Login berhasil."
  });
}

/* ── otorisasi per aksi ────────────────────────────────────────────────── */

function _g2Authorize(user, body, action) {
  action = String(action || "").toLowerCase();
  const privileged = _g2IsPrivileged(user.role);

  if (action === "saveuser" || action === "deleteuser") {
    if (!privileged) return _g2Deny("FORBIDDEN", "Aksi ini hanya untuk Admin / Super Admin.");
  }

  if (action === "updateuserpin" || action === "changemypin") {
    const target = _g2User(body && (body.username || body.targetUser)) || user.username;
    const isSelf = target === user.username;
    if (!isSelf && !privileged) {
      return _g2Deny("FORBIDDEN", "Hanya Admin / Super Admin yang boleh mengubah PIN karyawan lain.");
    }
  }

  // Batas divisi untuk staf: hanya boleh mengubah data divisinya sendiri.
  if (action === "additem" || action === "deleteitem" || action === "updateitem") {
    const div = _g2Str(body && body.division).toUpperCase();
    if (div && user.role === "staff") {
      const allowed = (user.divisions || []).map(function (d) { return _g2Str(d).toUpperCase(); });
      if (allowed.length && allowed.indexOf(div) === -1) {
        return _g2Deny("FORBIDDEN", "Divisi " + div + " bukan wewenang akun ini.");
      }
    }
  }

  return null;
}

/* ── ganti PIN (diverifikasi di server) ────────────────────────────────── */

function _g2HandlePinChange(user, body, action) {
  const target = _g2User(body && (body.username || body.targetUser)) || user.username;
  const newPin = _g2Pin(body && (body.pin || body.newPin));
  const oldPin = _g2Pin(body && body.oldPin);

  if (!newPin || newPin.length < 4) {
    return _g2Deny("BAD_REQUEST", "PIN baru minimal 4 karakter.");
  }

  const isSelf = target === user.username;
  if (!isSelf && !_g2IsPrivileged(user.role)) {
    return _g2Deny("FORBIDDEN", "Hanya Admin / Super Admin yang boleh mengubah PIN karyawan lain.");
  }

  const owner = _g2Owner();
  const targetIsOwner = owner && owner.username === target;

  // Mengganti PIN sendiri (atau mengganti PIN owner) wajib menyertakan PIN lama.
  if (isSelf || targetIsOwner) {
    const current = targetIsOwner ? owner : _g2FindUser(target);
    if (!current || !_g2Same(current.pin, oldPin)) {
      return _g2Deny("UNAUTHORIZED", "PIN lama salah.");
    }
  }

  if (targetIsOwner) {
    try {
      PropertiesService.getScriptProperties().setProperty("OWNER_PIN", newPin);
    } catch (e) {
      return _g2Deny("SERVER_ERROR", "Gagal menyimpan PIN owner.");
    }
    return _g2Json({ success: true, message: "PIN owner berhasil diperbarui." });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const res = handleUpdateUserPinInSheet({ username: target, pin: newPin }, ss);
  _g2InvalidateUsers();
  return res;
}

/* ── route yang sengaja ditangani sendiri (jangan diteruskan ke kode lama) ── */

/**
 * Aksi baca pengguna. Dulu `readUsers` membalas PIN dalam teks biasa ke siapa pun.
 * Sekarang: wajib sesi, dan PIN tidak pernah ikut.
 */
function _g2HandleReadUsers(user) {
  const list = _g2PublicUsers();
  return _g2Json({
    success: true,
    count: list.length,
    users: list,
    scope: _g2IsPrivileged(user.role) ? "admin" : "staff"
  });
}

/* ── riwayat transaksi (MUTASI_APP) ─────────────────────────────────────
 * Dulu riwayat cuma hidup di localStorage browser, jadi hilang begitu ganti
 * perangkat/incognito dan tidak pernah sama antar staf. Route ini yang
 * membuat sheet jadi sumber riwayat.
 *
 * Ringan: baca hanya N baris terakhir, dan hasilnya di-cache 60 detik di
 * CacheService supaya buka app berbarengan tidak menumpuk baca sheet.
 */
const G2_TXN_DEFAULT_LIMIT = 500;
const G2_TXN_MAX_LIMIT = 2000;
const G2_TXN_CACHE_SECONDS = 60;

function _g2HandleReadTransactions(e, user) {
  let limit = parseInt((e && e.parameter && e.parameter.limit) || "", 10);
  if (!(limit > 0)) limit = G2_TXN_DEFAULT_LIMIT;
  if (limit > G2_TXN_MAX_LIMIT) limit = G2_TXN_MAX_LIMIT;

  const cache = CacheService.getScriptCache();
  const cacheKey = "g2_txns_v1_" + limit;
  try {
    const hit = cache.get(cacheKey);
    if (hit) return _g2Json(JSON.parse(hit));
  } catch (err) { /* cache miss / rusak → baca sheet */ }

  const rows = [];
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss ? ss.getSheetByName("MUTASI_APP") : null;
    if (sh) {
      const last = sh.getLastRow();
      if (last > 1) {
        const start = Math.max(2, last - limit + 1);
        const n = last - start + 1;
        const vals = sh.getRange(start, 1, n, 12).getValues();
        for (let i = 0; i < vals.length; i++) {
          const r = vals[i];
          const id = _g2Str(r[0]);
          if (!id) continue;
          const when = _g2Str(r[1]);
          const notes = _g2Str(r[9]);
          // Catatan spoil disimpan sebagai "[SPOIL: alasan] sisa catatan".
          let spoilReason = "";
          let cleanNotes = notes;
          const m = notes.match(/^\[SPOIL:\s*([^\]]+)\]\s*/);
          if (m) {
            spoilReason = m[1].trim();
            cleanNotes = notes.replace(/^\[SPOIL:\s*[^\]]+\]\s*/, "");
          }
          rows.push({
            id: id,
            date: when.slice(0, 10),
            time: when.slice(11, 19),
            division: _g2Str(r[2]).toUpperCase(),
            staff: _g2Str(r[3]),
            itemId: _g2Str(r[4]),
            itemName: _g2Str(r[5]),
            unit: _g2Str(r[6]),
            type: _g2Str(r[7]) || "OUT",
            qty: Number(String(r[8]).replace(",", ".")) || 0,
            notes: cleanNotes,
            spoilReason: spoilReason,
            unitPrice: Number(r[10]) || 0,
            totalRupiah: Number(r[11]) || 0
          });
        }
      }
    }
  } catch (err) {
    console.error("[readTransactions] " + (err && err.stack ? err.stack : err));
  }

  // Terbaru di atas: baris sheet sudah berurut waktu menurun.
  rows.reverse();

  const out = { success: true, count: rows.length, transactions: rows };
  try { cache.put(cacheKey, JSON.stringify(out), G2_TXN_CACHE_SECONDS); } catch (err) {}
  return _g2Json(out);
}

/* ── titik masuk ───────────────────────────────────────────────────────── */

const G2_PUBLIC_GET_ACTIONS = { "": 1, ping: 1, status: 1, version: 1 };
const G2_SELF_ACTIONS = {
  login: 1, logout: 1, readUsers: 1, getUsers: 1, askAI: 1
};

function doGet(e) {
  const p = (e && e.parameter) || {};
  const action = _g2Str(p.action).toLowerCase();

  if (action === "aistatus") {
    return _aiJson_(_aiStatusPayload_());
  }




  if (G2_PUBLIC_GET_ACTIONS[action]) {
    return _g2Json({ status: "online", version: G2_VERSION, message: "Rimba Alam Stock API aktif." });
  }

  const token = _g2Token(e, null);
  const user = _g2ReadSession(token);
  if (!user) {
    return _g2Deny("UNAUTHORIZED", "Sesi tidak valid atau kedaluwarsa. Login ulang.");
  }

  if (action === "logout") {
    _g2DropSession(token);
    return _g2Json({ success: true, message: "Logout berhasil." });
  }

  if (action === "readusers" || action === "getusers") {
    return _g2HandleReadUsers(user);
  }

  if (action === "readtransactions") {
    return _g2HandleReadTransactions(e, user);
  }

  if (action === "askai") {
    if (!_g2IsPrivileged(user.role)) {
      return _aiError_("FORBIDDEN", "Mirim khusus untuk akun admin.");
    }
    return handleAskAI_(e, user, null);
  }

  // sisanya: route lama (readSheetData, getItems, inspectSheets, ...) — sudah lewat sesi
  return _realDoGet(e);
}

function doPost(e) {
  let body = null;
  try {
    body = e && e.postData ? JSON.parse(e.postData.contents) : {};
  } catch (err) {
    return _g2Deny("BAD_REQUEST", "Format permintaan tidak valid.");
  }
  if (!body || typeof body !== "object") body = {};

  const action = _g2Str(body.action).toLowerCase();

  if (action === "login") {
    return _g2HandleLogin(body);
  }

  const token = _g2Token(e, body);
  const user = _g2ReadSession(token);
  if (!user) {
    return _g2Deny("UNAUTHORIZED", "Sesi tidak valid atau kedaluwarsa. Login ulang.");
  }

  if (action === "logout") {
    _g2DropSession(token);
    return _g2Json({ success: true, message: "Logout berhasil." });
  }

  if (action === "refreshsession") {
    return _g2Json({ success: true, user: _g2PublicUser(user), expiresIn: G2_SESSION_TTL });
  }

  const denied = _g2Authorize(user, body, action);
  if (denied) return denied;

  // Jejak audit (MUTASI_APP) memakai identitas dari sesi. Body klien boleh
  // berisi staffName/division palsu, jadi kedua field itu ditimpa di server.
  body.staffName = user.name || user.username;
  body.adminName = user.name || user.username;

  // Staf tidak bisa melabeli transaksi ke divisi lain.
  if (user.role === "staff") {
    const allowed = (user.divisions || []).map(function (d) { return _g2Str(d).toUpperCase(); });
    if (allowed.length) {
      const sub = _g2Str(body.division).toUpperCase();
      body.division = allowed.indexOf(sub) !== -1 ? sub : allowed[0];
    }
  }

  // Setiap perubahan kredensial/hak akses membatalkan sesi lain akun itu.
  if (action === "updateuserpin" || action === "changemypin" ||
      action === "saveuser" || action === "deleteuser") {
    const target = _g2User(body && (body.username || body.targetUser)) || user.username;
    _g2BumpUserRev(target);
    if (target === user.username) _g2ReseatSession(token, user);
  }

  if (action === "updateuserpin" || action === "changemypin") {
    return _g2HandlePinChange(user, body, action);
  }

  if (action === "readusers" || action === "getusers") {
    return _g2HandleReadUsers(user);
  }

  if (action === "readtransactions") {
    return _g2HandleReadTransactions(e, user);
  }

  if (action === "askai") {
    if (!_g2IsPrivileged(user.role)) {
      return _aiError_("FORBIDDEN", "Mirim khusus untuk akun admin.");
    }
    return handleAskAI_(e, user, body);
  }

  // Bersihkan jejak kredensial supaya tidak ikut tersimpan di log mutasi.
  delete body.authPin;
  delete body.authUser;
  delete body.authToken;

  if (action === "saveuser" || action === "deleteuser") {
    _g2InvalidateUsers();
  }

  // Teruskan ke kode lama, tapi tanpa membawa token/PIN di dalam body.
  const clean = Object.assign({}, e);
  clean.postData = { contents: JSON.stringify(body) };
  return _realDoPost(clean);
}
