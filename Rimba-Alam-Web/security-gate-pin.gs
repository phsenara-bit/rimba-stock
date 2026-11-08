/**
 * ============================================================================
 * SECURITY GATE — Rimba Alam Stock API (verifikasi PIN di server)
 * ============================================================================
 * Menutup Web App dari akses publik. Setiap permintaan (baca maupun tulis)
 * wajib membawa identitas karyawan yang terdaftar di tab DATA_PENGGUNA.
 *
 * Kenapa PIN, bukan token: staf sudah login pakai nama + PIN tiap hari, jadi
 * tidak ada yang perlu dipasang ulang di HP. PIN TIDAK dikirim ke browser
 * sebagai daftar; browser hanya mengirim PIN milik perangkat itu sendiri.
 *
 * ---------------------------------------------------------------------------
 * CARA PASANG (3 langkah):
 *   1. Di editor Apps Script, rename DUA fungsi yang sudah ada (isinya jangan
 *      diubah, cuma namanya):
 *           function doGet(e)   ->  function _realDoGet(e)
 *           function doPost(e)  ->  function _realDoPost(e)
 *   2. Tempel SELURUH isi file ini di paling atas Code.gs.
 *   3. Deploy -> Manage deployments -> ikon pensil -> Version: New version
 *      -> Deploy.  (JANGAN "New deployment": URL berubah, semua HP harus
 *      diisi ulang.)
 *
 * OPSIONAL — kalau masih memakai akun owner "satian" (akun ini tidak ada di
 * sheet, jadi tidak bisa diverifikasi dari DATA_PENGGUNA):
 *      Project Settings -> Script Properties:
 *           OWNER_USERNAME = satian
 *           OWNER_PIN      = <PIN baru, jangan 1212>
 *   Kalau dua properti itu kosong, akun satian otomatis tidak bisa sync.
 *
 * Kalau tab DATA_PENGGUNA tidak terbaca, gate MENOLAK semua permintaan
 * (fail closed) — lebih baik berhenti daripada diam-diam terbuka.
 * ============================================================================
 */

const GATE_USERS_SHEET = "DATA_PENGGUNA";
const GATE_MAX_FAILS = 10;      // percobaan salah sebelum akun dikunci
const GATE_LOCK_SECONDS = 600;  // durasi kunci (10 menit)
const GATE_USERS_TTL = 120;     // cache daftar user (detik)

function _gateJson_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function _gateDeny_(code, message) {
  return _gateJson_({ success: false, code: code, message: message });
}

/** Normalisasi username: huruf kecil, tanpa spasi di ujung. */
function _gateUser_(value) {
  return String(value === undefined || value === null ? "" : value).trim().toLowerCase();
}

/** PIN di sheet kadang tersimpan sebagai teks ber-apostrof ('1234) atau angka. */
function _gatePin_(value) {
  return String(value === undefined || value === null ? "" : value)
    .trim()
    .replace(/^'+/, "")
    .trim();
}

function _gateSafeEquals_(a, b) {
  a = String(a);
  b = String(b);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Baca daftar user langsung dari sheet (server-side), dengan cache singkat. */
function _gateUsers_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("gate_users_v1");
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      /* cache rusak, baca ulang */
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
  if (!sheet) sheet = ss.getSheetByName(GATE_USERS_SHEET);

  const users = [];
  if (sheet) {
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const values = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
      for (let i = 0; i < values.length; i++) {
        const row = values[i] || [];
        const username = _gateUser_(row[0]);
        if (!username || username === "username" || username === "satian") continue;
        users.push({
          username: username,
          pin: _gatePin_(row[2]),
          role: String(row[4] || "staff").trim().toLowerCase() || "staff",
        });
      }
    }
  }

  if (users.length > 0) {
    try {
      cache.put("gate_users_v1", JSON.stringify(users), GATE_USERS_TTL);
    } catch (e) {}
  }
  return users;
}

/** Ambil kredensial dari POST body atau GET query. */
function _gateCreds_(e) {
  let username = "";
  let pin = "";

  if (e) {
    if (e.parameter) {
      username = e.parameter.authUser || e.parameter.authuser || "";
      pin = e.parameter.authPin || e.parameter.authpin || "";
    }
    if ((!username || !pin) && e.postData && e.postData.contents) {
      try {
        const body = JSON.parse(e.postData.contents);
        if (body && typeof body === "object") {
          username = body.authUser || username || "";
          pin = body.authPin || pin || "";
        }
      } catch (err) {
        /* body bukan JSON */
      }
    }
  }

  return { username: _gateUser_(username), pin: _gatePin_(pin) };
}

function _gateIsPrivileged_(role) {
  return role === "admin" || role === "superadmin" || role === "owner";
}

/** Verifikasi kredensial. Kembalikan {ok, user} atau {ok:false, response}. */
function _gateAuthenticate_(e) {
  const creds = _gateCreds_(e);
  if (!creds.username || !creds.pin) {
    return {
      ok: false,
      response: _gateDeny_(
        "UNAUTHORIZED",
        "Akses ditolak: login ulang di aplikasi (nama + PIN) lalu coba lagi."
      ),
    };
  }

  const cache = CacheService.getScriptCache();
  const lockKey = "gate_fail_" + creds.username;
  const fails = parseInt(cache.get(lockKey) || "0", 10) || 0;
  if (fails >= GATE_MAX_FAILS) {
    return {
      ok: false,
      response: _gateDeny_(
        "LOCKED",
        "Akun " + creds.username + " terkunci sementara karena terlalu banyak PIN salah. Coba lagi 10 menit."
      ),
    };
  }

  let matched = null;

  // 1. Akun biasa: cocokkan dengan tab DATA_PENGGUNA
  const users = _gateUsers_();
  for (let i = 0; i < users.length; i++) {
    if (users[i].username === creds.username) {
      if (_gateSafeEquals_(users[i].pin, creds.pin)) matched = users[i];
      break;
    }
  }

  // 2. Akun owner (opsional, dari Script Properties)
  if (!matched) {
    try {
      const props = PropertiesService.getScriptProperties();
      const ownerUser = _gateUser_(props.getProperty("OWNER_USERNAME"));
      const ownerPin = _gatePin_(props.getProperty("OWNER_PIN"));
      if (ownerUser && ownerPin && ownerUser === creds.username && _gateSafeEquals_(ownerPin, creds.pin)) {
        matched = { username: ownerUser, role: "owner" };
      }
    } catch (e) {
      /* properti tidak terbaca */
    }
  }

  if (!matched) {
    try {
      cache.put(lockKey, String(fails + 1), GATE_LOCK_SECONDS);
    } catch (e) {}
    return {
      ok: false,
      response: _gateDeny_(
        "UNAUTHORIZED",
        "Nama atau PIN tidak cocok dengan data karyawan di spreadsheet."
      ),
    };
  }

  try {
    cache.remove(lockKey);
  } catch (e) {}

  return { ok: true, user: matched };
}

/** Aturan hak akses per aksi tulis. */
function _gateAuthorize_(user, payload) {
  const action = String((payload && payload.action) || "");
  const target = _gateUser_((payload && payload.username) || "");

  if (action === "deleteUser" || action === "saveUser") {
    if (!_gateIsPrivileged_(user.role)) {
      return _gateDeny_("FORBIDDEN", "Aksi ini hanya untuk Admin / Super Admin.");
    }
  }

  if (action === "updateUserPin") {
    const isSelf = !target || target === user.username;
    if (!isSelf && !_gateIsPrivileged_(user.role)) {
      return _gateDeny_("FORBIDDEN", "Hanya Admin / Super Admin yang boleh mengubah PIN karyawan lain.");
    }
  }

  return null;
}

function doGet(e) {
  const auth = _gateAuthenticate_(e);
  if (!auth.ok) return auth.response;
  return _realDoGet(e);
}

function doPost(e) {
  const auth = _gateAuthenticate_(e);
  if (!auth.ok) return auth.response;

  let payload = null;
  try {
    payload = e && e.postData ? JSON.parse(e.postData.contents) : null;
  } catch (err) {
    return _gateDeny_("UNAUTHORIZED", "Format permintaan tidak valid.");
  }

  const denied = _gateAuthorize_(auth.user, payload);
  if (denied) return denied;

  return _realDoPost(e);
}
