import io, sys

p = "Code.gs"
s = io.open(p, encoding="utf-8").read()

def rep(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        sys.exit("FAIL (%d): %r" % (n, old[:110]))
    s = s.replace(old, new)

# ══ E1. Revisi sesi: cabut sesi lama saat akun berubah ══════════════════
rep('''function _g2CreateSession(user) {
  const token = _g2NewToken();
  const payload = {
    username: user.username,
    name: user.name || user.username,
    role: user.role || "staff",
    divisions: (user.divisions || ["KITCHEN"]).slice(),
    avatar: user.avatar || "",
    loginAt: new Date().getTime()
  };''',
'''// Revisi akun: naikkan saat PIN/role/divisi berubah atau akun dihapus.
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
  };''')

rep('''  if (!data || !data.username) return null;
  // sliding expiration: sesi yang aktif tidak mati di tengah kerja
  try {
    cache.put(key, raw, G2_SESSION_TTL);
  } catch (e) {}
  return data;''',
'''  if (!data || !data.username) return null;
  // Akun dihapus, PIN diganti, atau role/divisi berubah → sesi lama mati.
  if (parseInt(data.rev, 10) !== _g2UserRev(data.username)) {
    try { cache.remove(key); } catch (e) {}
    return null;
  }
  // sliding expiration: sesi yang aktif tidak mati di tengah kerja
  try {
    cache.put(key, raw, G2_SESSION_TTL);
  } catch (e) {}
  return data;''')

# ══ E2. Hapus bootstrap owner satian/1234 (fail closed) ══════════════════
rep('''  let matched = null;
  // Akun owner boleh login sebelum PIN-nya diganti. Tanpa ini, deploy pertama
  // akan mengunci owner karena properti OWNER_PIN belum diisi.
  const owner = _g2Owner();
  const ownerFallback = login === "satian" && pin === "1234" && !owner;
  if (ownerFallback) {
    try {
      PropertiesService.getScriptProperties().setProperty("OWNER_PIN", "1234");
      PropertiesService.getScriptProperties().setProperty("OWNER_USERNAME", "satian");
    } catch (e) {}
  }
  if (owner && owner.username === login) {
    if (_g2Same(owner.pin, pin)) matched = owner;
  }
  if (!matched && ownerFallback) {
    matched = {
      username: "satian",
      name: "Owner",
      role: "owner",
      divisions: ["KITCHEN", "BAR", "PASTRY", "LAINNYA"],
      avatar: "👑",
      pin: "1234"
    };
  }
  if (!matched) {''',
'''  let matched = null;
  // Owner HANYA dari Script Properties (OWNER_PIN). Tidak ada PIN bawaan:
  // kalau propertinya kosong, owner sengaja tidak bisa masuk sampai diisi.
  const owner = _g2Owner();
  if (owner && owner.username === login) {
    if (_g2Same(owner.pin, pin)) matched = owner;
  }
  if (!matched) {''')

# ══ E3. Throttle login global (cegah 1 PIN dicoba ke banyak akun) ══════
rep('''  const cache = CacheService.getScriptCache();
  const lockKey = "g2_fail_" + login;
  const fails = parseInt(cache.get(lockKey) || "0", 10) || 0;
  if (fails >= G2_LOGIN_MAX_FAILS) {
    return _g2Deny("LOCKED", "Akun terkunci sementara karena terlalu banyak PIN salah. Coba lagi 10 menit.");
  }''',
'''  const cache = CacheService.getScriptCache();
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
  }''')

rep('''  if (!matched) {
    try {
      cache.put(lockKey, String(fails + 1), G2_LOGIN_LOCK_SECONDS);
    } catch (e) {}
    return _g2Deny("UNAUTHORIZED", "Nama atau PIN tidak cocok.");
  }''',
'''  if (!matched) {
    try {
      cache.put(lockKey, String(fails + 1), G2_LOGIN_LOCK_SECONDS);
      cache.put(globalKey, String(globalFails + 1), G2_LOGIN_LOCK_SECONDS);
    } catch (e) {}
    return _g2Deny("UNAUTHORIZED", "Nama atau PIN tidak cocok.");
  }''')

rep('const G2_LOGIN_MAX_FAILS = 5;        // salah PIN sebelum akun dikunci',
    'const G2_LOGIN_MAX_FAILS = 5;        // salah PIN sebelum akun dikunci\n'
    'const G2_LOGIN_GLOBAL_MAX_FAILS = 25; // batas gabungan semua akun per 10 menit')

# ══ E4. Identitas audit dari sesi, bukan dari body klien ═══════════════
rep('''  const denied = _g2Authorize(user, body, action);
  if (denied) return denied;
''',
'''  const denied = _g2Authorize(user, body, action);
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
''')

# ══ E5. handleSaveUser: jangan pernah default PIN 1234 ═════════════════
rep('''    const name = String(payload.name || username).trim();
    const pin = String(payload.pin || "1234").trim();''',
'''    const name = String(payload.name || username).trim();
    let pin = String(payload.pin || "").trim();''')

rep('''    if (foundRow > 0) {
      sheet.getRange(foundRow, 1, 1, 7).setValues([[
        username, name, "'" + pin, divisionsStr, role, avatar, createdAt
      ]]);
    } else {''',
'''    if (foundRow > 0) {
      // Edit akun tanpa PIN baru → PIN lama dipertahankan, bukan direset.
      if (!pin) {
        const cur = String(sheet.getRange(foundRow, 3).getValue() || "").trim().replace(/^'/, "");
        pin = _g2Pin(cur);
      }
    } else if (pin.length < 4) {
      return createJsonResponse({
        success: false,
        message: "PIN wajib diisi (minimal 4 digit) untuk akun baru."
      }, 400);
    }

    if (foundRow > 0) {
      sheet.getRange(foundRow, 1, 1, 7).setValues([[
        username, name, "'" + pin, divisionsStr, role, avatar, createdAt
      ]]);
    } else {''')

# ══ E6. Seed akun: PIN acak, bukan 1234 ═════════════════════════════════
rep('''    // Akun default awal (Tanpa satian!)
    const initialUsers = [
      ["admin", "Admin Rimba Alam", "1234", "KITCHEN, BAR, PASTRY, LAINNYA", "superadmin", "👔", "2026-01-01"],
      ["ragil", "Ragil", "1234", "KITCHEN, BAR, PASTRY, LAINNYA", "admin", "👨‍💼", "2026-01-01"],
      ["angel", "Angel", "1234", "KITCHEN, BAR, PASTRY, LAINNYA", "admin", "👩‍💼", "2026-01-01"],
      ["chef", "Chef Rina", "1234", "KITCHEN, LAINNYA", "staff", "🍳", "2026-01-01"],
      ["rey", "Rey", "1234", "KITCHEN, LAINNYA", "staff", "🍳", "2026-01-01"],
      ["barista", "Doni", "1234", "BAR, LAINNYA", "staff", "☕", "2026-01-01"],
      ["pastry", "Dewi Pastry", "1234", "PASTRY, LAINNYA", "staff", "🍰", "2026-01-01"]
    ];''',
'''    // Akun awal untuk sheet BARU. PIN dibuat acak per akun — bukan 1234 —
    // dan bisa dilihat pemilik di tab DATA_PENGGUNA lalu diganti.
    const initialUsers = [
      ["admin", "Admin Rimba Alam", "", "KITCHEN, BAR, PASTRY, LAINNYA", "superadmin", "👔", "2026-01-01"],
      ["ragil", "Ragil", "", "KITCHEN, BAR, PASTRY, LAINNYA", "admin", "👨‍💼", "2026-01-01"],
      ["angel", "Angel", "", "KITCHEN, BAR, PASTRY, LAINNYA", "admin", "👩‍💼", "2026-01-01"],
      ["chef", "Chef Rina", "", "KITCHEN, LAINNYA", "staff", "🍳", "2026-01-01"],
      ["rey", "Rey", "", "KITCHEN, LAINNYA", "staff", "🍳", "2026-01-01"],
      ["barista", "Doni", "", "BAR, LAINNYA", "staff", "☕", "2026-01-01"],
      ["pastry", "Dewi Pastry", "", "PASTRY, LAINNYA", "staff", "🍰", "2026-01-01"]
    ].map(function (u) {
      u[2] = String(Math.floor(1000 + Math.random() * 9000));
      return u;
    });''')

io.open(p, "w", encoding="utf-8").write(s)
print("Code.gs: 6 perbaikan keamanan diterapkan")
