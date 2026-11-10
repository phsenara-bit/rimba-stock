#!/usr/bin/env python3
"""
Patch frontend ke v4: login & PIN lewat server, token sesi, tidak ada PIN di perangkat.

Semua penggantian memakai assert: kalau teks target tidak ketemu (misalnya karena
index.html user berubah), script berhenti dan tidak menulis apa pun.
Jalankan: python3 build/patch_frontend_v4.py [index.html]
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
TARGET = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "index.html"

s = TARGET.read_text(encoding="utf-8")
changes = []
SYSTEM_PROFILE_PIN_COUNT = 7   # 7 profil bawaan di DEFAULT_USERS


def sub(label, old, new, count=1):
    global s
    found = s.count(old)
    assert found == count, f"[{label}] target muncul {found}x, harus {count}x"
    s = s.replace(old, new)
    changes.append(label)


def resub(label, pattern, new, count=1):
    global s
    matches = re.findall(pattern, s, flags=re.S)
    assert len(matches) == count, f"[{label}] pola cocok {len(matches)}x, harus {count}x"
    s = re.sub(pattern, lambda m: new, s, flags=re.S)
    changes.append(label)


# ── 1. baca token sesi, bukan nama+PIN perangkat ─────────────────────────
sub(
    "readDeviceCred→readSessionToken",
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
  }""",
    """  /**
   * Token sesi untuk shim fetch. PIN tidak pernah disimpan di perangkat.
   * Token diterbitkan server saat login dan mati saat logout / kedaluwarsa.
   */
  function readSessionToken() {
    try {
      if (typeof window === "undefined" || !window.sessionStorage) return "";
      const raw = window.sessionStorage.getItem("rimba_alam_session");
      if (!raw) return "";
      const sess = JSON.parse(raw);
      return sess && sess.token ? String(sess.token) : "";
    } catch (e) {
      return "";
    }
  }""",
)

sub("shim: ambil token", "        const cred = readDeviceCred();", "        const token = readSessionToken();")
sub(
    "shim: POST pakai token",
    """                // authUser/authPin TIDAK menimpa username/pin milik payload
                // (payload "updateUserPin" memakai dua field itu untuk target lain).
                if (cred) {
                  obj.authUser = cred.u;
                  obj.authPin = cred.p;
                }""",
    """                // Token sesi, bukan PIN. Payload "username/pin" milik aksi
                // (mis. ganti PIN karyawan lain) tidak pernah ditimpa.
                if (token) {
                  obj.authToken = token;
                }""",
)
sub("shim: cabang GET", "          } else if (cred) {", "          } else if (token) {")
sub(
    "shim: query token",
    """            if (cred && url.indexOf("authUser=") === -1) {
              extra.push("authUser=" + encodeURIComponent(cred.u));
              extra.push("authPin=" + encodeURIComponent(cred.p));
            }""",
    """            if (url.indexOf("authToken=") === -1) {
              extra.push("authToken=" + encodeURIComponent(token));
            }""",
)

# ── 2. login: satu-satunya tempat PIN dikirim, dan hanya ke server ────────
resub(
    "login via server",
    r"  function login\(rawUsername, inputPin\) \{.*?\n  /\*\* Logout \*/\n  function logout\(\) \{\n    _clearSession\(\);\n    _clearDeviceCred\(\);\n  \}",
    """  async function login(rawUsername, inputPin) {
    const username = (rawUsername || "").trim();
    const pin = (inputPin || "").trim();

    if (!username) {
      return { success: false, message: "Silakan masukkan nama atau ID akun Anda." };
    }
    if (!pin) {
      return { success: false, message: "PIN wajib diisi." };
    }

    const url = _getGasUrl();
    if (!url) {
      return { success: false, message: "URL server belum diatur. Buka Pengaturan." };
    }

    let data;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "login", username: username, pin: pin })
      });
      data = await res.json();
    } catch (err) {
      return { success: false, message: "Gagal menghubungi server. Periksa koneksi lalu coba lagi." };
    }

    if (!data || !data.success || !data.token) {
      return { success: false, message: (data && data.message) || "Login ditolak server." };
    }

    const u = data.user || {};
    const divisions = Array.isArray(u.divisions) && u.divisions.length
      ? u.divisions
      : [u.division || "KITCHEN"];

    const session = {
      username: u.username,
      name: _capitalize(u.name || u.username || ""),
      role: u.role || "staff",
      division: u.division || divisions[0] || "KITCHEN",
      divisions: divisions,
      avatar: u.avatar || "",
      token: data.token,
      loginAt: new Date().toISOString()
    };

    _saveSession(session);
    _saveDeviceCred(session.username, null);   // PIN tidak disimpan; token sudah di sesi

    return {
      success: true,
      message: `Selamat datang, ${session.name}!`,
      user: session
    };
  }

  /** Logout */
  function logout() {
    const sess = _getSession();
    const url = _getGasUrl();
    if (sess && sess.token && url) {
      try {
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "logout", authToken: sess.token })
        }).catch(function () {});
      } catch (e) {}
    }
    _clearSession();
    _clearDeviceCred();
  }""",
)

# ── 3. kredensial perangkat: hanya token yang berarti ─────────────────────
sub(
    "simpan kredensial perangkat",
    """  function _saveDeviceCred(username, pin) {
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
  }""",
    """  function _saveDeviceCred(username) {
    // Sengaja tidak menyimpan apa pun: PIN tidak boleh menetap di perangkat.
    // Autentikasi memakai token sesi yang sudah ada di _saveSession().
  }""",
)

# ── 4. daftar pengguna dari sheet: tanpa PIN ─────────────────────────────
sub(
    "sync users tanpa PIN",
    """          pin: String(u.pin || "1234"),\n""",
    "",
)

# ── 5. PIN tidak pernah disimpan di localStorage ─────────────────────────
sub(
    "sanitasi _saveUsers",
    """  function _saveUsers(users) {
    const cleaned = { ...users };
    delete cleaned.satian;
    delete cleaned.admin;""",
    """  function _saveUsers(users) {
    const cleaned = {};
    Object.keys(users || {}).forEach(function (k) {
      const u = Object.assign({}, users[k]);
      delete u.pin;                 // PIN hanya hidup di server
      cleaned[k] = u;
    });
    delete cleaned.satian;
    delete cleaned.admin;""",
)

# ── 6. helper POST JSON ke server ────────────────────────────────────────
sub(
    "helper _postGasJson",
    """  /** Muat daftar user dari localStorage atau fallback in-memory */""",
    """  /** Kirim satu aksi ke server dan kembalikan JSON-nya (untuk aksi yang butuh jawaban). */
  async function _postGasJson(payload) {
    const url = _getGasUrl();
    if (!url) return { success: false, message: "URL server belum diatur." };
    const body = Object.assign({}, payload);
    const sess = _getSession();
    if (sess && sess.token && !body.authToken) body.authToken = sess.token;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(body)
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: "Gagal menghubungi server." };
    }
  }

  /** Muat daftar user dari localStorage atau fallback in-memory */""",
)

# ── 7. changeMyPin: verifikasi PIN lama di server ────────────────────────
resub(
    "changeMyPin via server",
    r"  function changeMyPin\(oldPin, newPin\) \{.*?\n  /\*\*\n   \* Super Admin & Admin: Ubah/Reset PIN Karyawan Manapun",
    """  async function changeMyPin(oldPin, newPin) {
    const session = _getSession();
    if (!session) {
      return { success: false, message: "Silakan login terlebih dahulu." };
    }
    if (!oldPin || !oldPin.trim()) {
      return { success: false, message: "PIN lama wajib diisi!" };
    }
    if (!newPin || newPin.trim().length < 4) {
      return { success: false, message: "PIN baru minimal 4 angka/karakter." };
    }

    const data = await _postGasJson({
      action: "updateUserPin",
      username: session.username,
      oldPin: oldPin.trim(),
      pin: newPin.trim()
    });

    if (data && data.success) {
      return { success: true, message: "PIN Anda berhasil diperbarui. Gunakan PIN baru untuk login berikutnya." };
    }
    return { success: false, message: (data && data.message) || "Pin gagal diperbarui." };
  }

  /**
   * Super Admin & Admin: Ubah/Reset PIN Karyawan Manapun""",
)

# ── 8. setEmployeePin: tanpa PIN lama, tetap diverifikasi server ─────────
resub(
    "setEmployeePin via server",
    r"  function setEmployeePin\(targetUsername, newPin\) \{.*?\n  /\*\*\n   \* Super Admin & Admin: Tambah Karyawan Baru",
    """  async function setEmployeePin(targetUsername, newPin) {
    if (!canManageUsers()) {
      return { success: false, message: "Akses ditolak: Hanya Admin / Super Admin yang dapat mengatur PIN karyawan lain." };
    }
    if (!newPin || newPin.trim().length < 4) {
      return { success: false, message: "PIN minimal 4 angka/karakter." };
    }

    const data = await _postGasJson({
      action: "updateUserPin",
      username: targetUsername,
      pin: newPin.trim()
    });

    if (data && data.success) {
      const users = _loadUsers();
      const nm = (users[targetUsername] && users[targetUsername].name) || targetUsername;
      return { success: true, message: `PIN untuk "${nm}" berhasil diubah.` };
    }
    return { success: false, message: (data && data.message) || "PIN gagal diubah." };
  }

  /**
   * Super Admin & Admin: Tambah Karyawan Baru""",
)

# ── 9. payload saveUser tidak lagi membawa PIN ───────────────────────────
for label, old in (
    ("payload saveUser #1", "      pin: users[username].pin,\n"),
    ("payload saveUser #2", "      pin: user.pin,\n"),
):
    sub(label, old, "")

# reset PIN lewat edit-user dipindah ke server
sub(
    "reset PIN di edit user",
    """    // Reset PIN (jika diisi)
    if (updates.pin && updates.pin.trim()) {
      const cleanPin = updates.pin.trim();
      if (cleanPin.length < 4) {
        return { success: false, message: "PIN minimal 4 angka." };
      }
      user.pin = cleanPin;
    }""",
    """    // Reset PIN (jika diisi) — dikirim ke server, tidak disimpan di perangkat
    let pinReset = "";
    if (updates.pin && updates.pin.trim()) {
      pinReset = updates.pin.trim();
      if (pinReset.length < 4) {
        return { success: false, message: "PIN minimal 4 angka." };
      }
    }""",
)

sub(
    "kirim reset PIN",
    """    _saveUsers(users);

    _syncUserToSheet({
      action: "saveUser",
      username: username,
      name: user.name,""",
    """    _saveUsers(users);

    if (pinReset) {
      _postGasJson({ action: "updateUserPin", username: username, pin: pinReset });
    }

    _syncUserToSheet({
      action: "saveUser",
      username: username,
      name: user.name,""",
)

# ── 10. PIN tidak ditampilkan di daftar karyawan ─────────────────────────
sub(
    "hapus tampilan PIN",
    """                        <span style="font-size:.7rem; color:var(--primary); font-weight:700;">PIN: ${esc(u.pin || '1234')}</span>\n""",
    "",
)

# ── 11. handleLogin menunggu jawaban server ─────────────────────────────
sub("handleLogin async", "  function handleLogin(e) {", "  async function handleLogin(e) {")
sub(
    "handleLogin await",
    "      const result = AuthService.login(username, pin);",
    "      const result = await AuthService.login(username, pin);",
)

# ── 12. tidak ada PIN owner yang ditanam di HTML ─────────────────────────
# Blok login satian yang memuat PIN (langkah 2) dan penjagaan PIN owner di
# changeMyPin/setEmployeePin (langkah 7 & 8) sudah ikut terhapus bersama
# fungsinya. Yang tersisa hanya catatan di header.
sub(
    "komentar PIN owner di header",
    """ *    - PIN khusus: 1212.""",
    """ *    - PIN dikelola di Script Properties server (tidak ada di file ini).""",
)

# ── 14. PIN tidak menetap di profil default & saat tambah karyawan ───────
resub(
    "hapus PIN dari DEFAULT_USERS",
    r'\n      pin: "1234",',
    "",
    count=SYSTEM_PROFILE_PIN_COUNT,
)

sub(
    "addUser: hapus pin dari objek user",
    """      divisions: divisions,
      pin: cleanPin,
      avatar: avatar,""",
    """      divisions: divisions,
      avatar: avatar,""",
)

sub(
    "addUser: PIN hanya ke server",
    """    _syncUserToSheet({
      action: "saveUser",
      username: username,
      name: users[username].name,
      pin: cleanPin,
      divisions: divisions,
      role: role,
      avatar: avatar,
      createdAt: users[username].createdAt
    });""",
    """    _syncUserToSheet({
      action: "saveUser",
      username: username,
      name: users[username].name,
      divisions: divisions,
      role: role,
      avatar: avatar,
      createdAt: users[username].createdAt
    });

    // PIN hanya dikirim ke server, tidak pernah disimpan di perangkat.
    _postGasJson({ action: "updateUserPin", username: username, pin: cleanPin });""",
)

sub(
    "addUser: pesan tanpa PIN",
    """      message: `Karyawan "${_capitalize(trimmedName)}" berhasil didaftarkan (Izin Akses: ${divisions.join(", ")}, PIN: ${cleanPin}).`""",
    """      message: `Karyawan "${_capitalize(trimmedName)}" berhasil didaftarkan (Izin Akses: ${divisions.join(", ")}).`""",
)

# ── 13. komentar penyimpanan cred lama ──────────────────────────────────
sub(
    "komentar kredensial",
    "  /** Simpan kredensial perangkat (dipakai shim fetch untuk autentikasi ke GAS). */",
    "  /** Penanda kompatibilitas: kredensial perangkat tidak lagi dipakai (token ada di sesi). */",
)

TARGET.write_text(s, encoding="utf-8")
print(f"OK  {TARGET}")
print(f"    {len(changes)} perubahan terpasang:")
for c in changes:
    print("     - " + c)
left = [ln for ln in s.splitlines() if "1212" in ln]
print(f"    sisa baris memuat '1212': {len(left)}")
for ln in left[:5]:
    print("      · " + ln.strip()[:120])