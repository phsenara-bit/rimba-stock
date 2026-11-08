#!/usr/bin/env python3
"""Patch v3: kredensial login (nama+PIN) otomatis ikut di setiap request ke GAS."""
import sys

P = "index.html"
src = open(P, encoding="utf-8").read()


def must(old, new, count=1, label=""):
    global src
    n = src.count(old)
    if n != count:
        sys.exit(f"ANCHOR FAIL [{label}]: expected {count}, found {n}")
    src = src.replace(old, new)


# 1. Konstanta penyimpanan kredensial perangkat (AuthService)
must(
    '  const SESSION_KEY = "rimba_alam_session";',
    '  const SESSION_KEY = "rimba_alam_session";\n'
    '  // Kredensial perangkat (nama + PIN) untuk autentikasi ke Apps Script.\n'
    '  // Disimpan di sessionStorage: hilang saat logout / browser ditutup.\n'
    '  const DEVICE_CRED_KEY = "rimba_alam_device_cred_v1";',
    label="const",
)

# 2. Helper simpan/hapus kredensial, tepat sebelum _saveSession
must(
    "  function _saveSession(session) {",
    """  /** Simpan kredensial perangkat (dipakai shim fetch untuk autentikasi ke GAS). */
  function _saveDeviceCred(username, pin) {
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        const u = String(username || "").trim();
        const p = String(pin || "").trim();
        if (!u || !p) return;
        window.sessionStorage.setItem(DEVICE_CRED_KEY, JSON.stringify({ u: u, p: p }));
      }
    } catch (e) {
      console.warn("[AuthService] Gagal menyimpan kredensial perangkat:", e);
    }
  }

  /** Hapus kredensial perangkat (dipanggil saat logout). */
  function _clearDeviceCred() {
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.removeItem(DEVICE_CRED_KEY);
      }
    } catch (e) {}
  }

  function _saveSession(session) {""",
    label="helpers",
)

# 3. Login satian -> simpan kredensial
must(
    """        _saveSession(session);
        return {
          success: true,
          message: "Selamat datang, Satian (Super Admin)!",""",
    """        _saveSession(session);
        _saveDeviceCred("satian", cleanPin);
        return {
          success: true,
          message: "Selamat datang, Satian (Super Admin)!",""",
    label="cred-satian",
)

# 4. Login biasa -> simpan kredensial
must(
    """    _saveSession(session);

    return {
      success: true,
      message: `Selamat datang, ${session.name}!`,""",
    """    _saveSession(session);
    _saveDeviceCred(session.username, cleanPin);

    return {
      success: true,
      message: `Selamat datang, ${session.name}!`,""",
    label="cred-login",
)

# 5. Logout -> hapus kredensial
must(
    """  function logout() {
    _clearSession();""",
    """  function logout() {
    _clearSession();
    _clearDeviceCred();""",
    label="logout",
)

# 6. changeMyPin -> perbarui kredensial perangkat
must(
    """    user.pin = newPin.trim();
    _saveUsers(users);

    _syncUserToSheet({
      action: "updateUserPin",
      username: session.username,
      pin: newPin.trim()
    });""",
    """    user.pin = newPin.trim();
    _saveUsers(users);
    _saveDeviceCred(session.username, newPin.trim());

    _syncUserToSheet({
      action: "updateUserPin",
      username: session.username,
      pin: newPin.trim()
    });""",
    label="changeMyPin",
)

# 7. setEmployeePin -> kalau yang diubah adalah diri sendiri, perbarui kredensial
must(
    """    user.pin = newPin.trim();
    _saveUsers(users);

    _syncUserToSheet({
      action: "updateUserPin",
      username: targetUsername,
      pin: newPin.trim()
    });""",
    """    user.pin = newPin.trim();
    _saveUsers(users);
    const _sess = _getSession();
    if (_sess && _sess.username === targetUsername) {
      _saveDeviceCred(targetUsername, newPin.trim());
    }

    _syncUserToSheet({
      action: "updateUserPin",
      username: targetUsername,
      pin: newPin.trim()
    });""",
    label="setEmployeePin",
)

# 8. Shim fetch: kirim kredensial perangkat ke Apps Script
must(
    """        if (url.indexOf("script.google.com") !== -1) {
          const token = getSyncToken();
          const method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();

          if (method === "POST") {
            init = init || {};
            if (typeof init.body === "string") {
              try {
                const obj = JSON.parse(init.body);
                obj.token = token;
                init = Object.assign({}, init, { body: JSON.stringify(obj) });
              } catch (e) {
                /* body bukan JSON, biarkan apa adanya */
              }
            }
          } else if (token && url.indexOf("token=") === -1) {
            const sep = url.indexOf("?") === -1 ? "?" : "&";
            input = url + sep + "token=" + encodeURIComponent(token);
          }
        }""",
    """        if (url.indexOf("script.google.com") !== -1) {
          const cred = readDeviceCred();
          const token = getSyncToken();
          const method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();

          if (method === "POST") {
            init = init || {};
            if (typeof init.body === "string") {
              try {
                const obj = JSON.parse(init.body);
                // authUser/authPin TIDAK menimpa username/pin milik payload
                // (payload "updateUserPin" memakai dua field itu untuk target lain).
                if (cred) {
                  obj.authUser = cred.u;
                  obj.authPin = cred.p;
                }
                if (token) obj.token = token;
                init = Object.assign({}, init, { body: JSON.stringify(obj) });
              } catch (e) {
                /* body bukan JSON, biarkan apa adanya */
              }
            }
          } else if (cred || token) {
            const sep = url.indexOf("?") === -1 ? "?" : "&";
            const extra = [];
            if (cred && url.indexOf("authUser=") === -1) {
              extra.push("authUser=" + encodeURIComponent(cred.u));
              extra.push("authPin=" + encodeURIComponent(cred.p));
            }
            if (token && url.indexOf("token=") === -1) extra.push("token=" + encodeURIComponent(token));
            if (extra.length) input = url + sep + extra.join("&");
          }
        }""",
    label="shim",
)

# 9. Helper pembaca kredensial di dalam shim (scope DataService)
must(
    """  (function installGasFetchShim() {
    if (typeof window === "undefined" || !window.fetch || window.__gasFetchShim) return;
    window.__gasFetchShim = true;
    const _origFetch = window.fetch.bind(window);""",
    """  function readDeviceCred() {
    try {
      if (typeof window === "undefined" || !window.sessionStorage) return null;
      const raw = window.sessionStorage.getItem("rimba_alam_device_cred_v1");
      if (!raw) return null;
      const c = JSON.parse(raw);
      if (!c || !c.u || !c.p) return null;
      return { u: String(c.u), p: String(c.p) };
    } catch (e) {
      return null;
    }
  }

  (function installGasFetchShim() {
    if (typeof window === "undefined" || !window.fetch || window.__gasFetchShim) return;
    window.__gasFetchShim = true;
    const _origFetch = window.fetch.bind(window);""",
    label="readDeviceCred",
)

open(P, "w", encoding="utf-8").write(src)
print("patched v3 ok")
