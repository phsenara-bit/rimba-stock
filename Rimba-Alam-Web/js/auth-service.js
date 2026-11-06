/**
 * ==========================================================================
 * AUTH SERVICE — Rimba Alam Stock Management
 * ==========================================================================
 * Sistem Autentikasi 3 Tingkat Role dengan Keamanan PIN:
 * 1. Super Admin (Satian): Bisa semua + Kelola User + Pengaturan PIN semua staf
 * 2. Admin (Ragil, Angel): Bisa input stok + Tambah barang baru + Edit harga/stok
 * 3. Staff (Rey): Bisa lihat stok, mutasi, riwayat, alert KECUALI tambah/edit stok
 *
 * Mendukung PIN mandiri untuk masing-masing karyawan & fitur ganti PIN.
 * ==========================================================================
 */

const AuthService = (() => {
  const SESSION_KEY = "rimba_alam_session";
  const USERS_STORAGE_KEY = "rimba_alam_users_db_v3";
  let _inMemorySession = null;
  const _failedAttempts = {};
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_MS = 30000; // 30 detik lockout

  // Profil awal karyawan resmi Rimba Alam (Default PIN: 1234)
  const DEFAULT_USERS = {
    satian: {
      username: "satian",
      name: "Satian",
      role: "superadmin",
      division: "SUPERADMIN",
      pin: "1234",
      avatar: "👑",
      createdAt: "2026-01-01"
    },
    admin: {
      username: "admin",
      name: "Admin Rimba Alam",
      role: "superadmin",
      division: "SUPERADMIN",
      pin: "1234",
      avatar: "👑",
      createdAt: "2026-01-01"
    },
    ragil: {
      username: "ragil",
      name: "Ragil",
      role: "admin",
      division: "ADMIN",
      pin: "1234",
      avatar: "👨‍💼",
      createdAt: "2026-01-01"
    },
    angel: {
      username: "angel",
      name: "Angel",
      role: "admin",
      division: "ADMIN",
      pin: "1234",
      avatar: "👩‍💼",
      createdAt: "2026-01-01"
    },
    chef: {
      username: "chef",
      name: "Chef Rina (Kitchen)",
      role: "staff",
      division: "KITCHEN",
      pin: "1234",
      avatar: "🍳",
      createdAt: "2026-01-01"
    },
    rey: {
      username: "rey",
      name: "Rey (Kitchen)",
      role: "staff",
      division: "KITCHEN",
      pin: "1234",
      avatar: "🍳",
      createdAt: "2026-01-01"
    },
    barista: {
      username: "barista",
      name: "Barista Doni (Bar)",
      role: "staff",
      division: "BAR",
      pin: "1234",
      avatar: "☕",
      createdAt: "2026-01-01"
    },
    pastry: {
      username: "pastry",
      name: "Staf Pastry",
      role: "staff",
      division: "PASTRY",
      pin: "1234",
      avatar: "🍰",
      createdAt: "2026-01-01"
    },
    gudang: {
      username: "gudang",
      name: "Pak Budi (Lain-Lain)",
      role: "staff",
      division: "LAINNYA",
      pin: "1234",
      avatar: "📦",
      createdAt: "2026-01-01"
    }
  };

  let _inMemoryUsers = { ...DEFAULT_USERS };

  /** Muat daftar user dari localStorage atau fallback in-memory */
  function _loadUsers() {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const raw = window.localStorage.getItem(USERS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          // Pastikan akun superadmin utama satian selalu ada
          if (!parsed.satian) {
            parsed.satian = { ...DEFAULT_USERS.satian };
          }
          _inMemoryUsers = parsed;
          return _inMemoryUsers;
        } else {
          // Inisialisasi awal pertama kali
          _inMemoryUsers = JSON.parse(JSON.stringify(DEFAULT_USERS));
          _saveUsers(_inMemoryUsers);
          return _inMemoryUsers;
        }
      }
    } catch (e) {
      console.warn("[AuthService] Gagal membaca localStorage:", e);
    }
    return _inMemoryUsers;
  }

  /** Simpan daftar user ke localStorage & in-memory */
  function _saveUsers(users) {
    _inMemoryUsers = { ...users };
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
      }
    } catch (e) {
      console.warn("[AuthService] Gagal menulis localStorage:", e);
    }
  }

  /** Ambil semua daftar user */
  function getAllUsers() {
    const usersObj = _loadUsers();
    return Object.values(usersObj);
  }

  /** Simpan sesi aktif */
  function _saveSession(session) {
    _inMemorySession = session;
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      }
    } catch (e) {
      console.warn("[AuthService] Gagal menulis sessionStorage:", e);
    }
  }

  /** Ambil sesi aktif */
  function _getSession() {
    if (_inMemorySession && _inMemorySession.name && _inMemorySession.role) {
      return _inMemorySession;
    }
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        const raw = window.sessionStorage.getItem(SESSION_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.name && parsed.role) {
            _inMemorySession = parsed;
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn("[AuthService] Gagal membaca sessionStorage:", e);
    }
    return null;
  }

  /** Hapus sesi aktif */
  function _clearSession() {
    _inMemorySession = null;
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.removeItem(SESSION_KEY);
      }
    } catch (e) {}
  }

  /** Format nama tampilan: huruf kapital di depan */
  function _capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Login dengan Nama Karyawan & PIN
   * @param {string} rawUsername - Nama karyawan (bebas huruf besar/kecil)
   * @param {string} inputPin - PIN yang dimasukkan
   */
  function login(rawUsername, inputPin) {
    if (!rawUsername || !rawUsername.trim()) {
      return { success: false, message: "Silakan masukkan nama karyawan." };
    }

    if (!inputPin || !inputPin.trim()) {
      return { success: false, message: "Silakan masukkan PIN Anda." };
    }

    const cleanInput = rawUsername.trim().toLowerCase();
    const noSpace = cleanInput.replace(/\s+/g, "");
    const cleanPin = inputPin.trim();

    const users = _loadUsers();

    // 1. Cek pencocokan username langsung
    let userKey = Object.keys(users).find(k => k === cleanInput || k === noSpace);

    // 2. Cek pencocokan fleksibel ("pak ragil" -> "ragil", "mas rey" -> "rey", "chef" -> "chef")
    if (!userKey) {
      if (cleanInput.includes("satian")) userKey = "satian";
      else if (cleanInput.includes("admin")) userKey = "admin";
      else if (cleanInput.includes("ragil")) userKey = "ragil";
      else if (cleanInput.includes("angel")) userKey = "angel";
      else if (cleanInput.includes("rey") || cleanInput.includes("ray")) userKey = "rey";
      else if (cleanInput.includes("chef") || cleanInput.includes("rina")) userKey = "chef";
      else if (cleanInput.includes("barista") || cleanInput.includes("doni")) userKey = "barista";
      else if (cleanInput.includes("gudang") || cleanInput.includes("budi")) userKey = "gudang";
    }

    // 3. Cek pencocokan nama lengkap
    if (!userKey) {
      userKey = Object.keys(users).find(k => {
        const u = users[k];
        return u.name.toLowerCase() === cleanInput || u.username.toLowerCase() === cleanInput;
      });
    }

    if (!userKey || !users[userKey]) {
      return {
        success: false,
        message: `Karyawan "${rawUsername}" tidak terdaftar. Hubungi Super Admin.`
      };
    }

    const matchedUser = users[userKey];

    // Cek perlindungan brute-force / lockout
    if (_failedAttempts[userKey]) {
      const rec = _failedAttempts[userKey];
      if (rec.count >= MAX_ATTEMPTS) {
        const elapsed = Date.now() - rec.lastAttempt;
        if (elapsed < LOCKOUT_MS) {
          const remainingSec = Math.ceil((LOCKOUT_MS - elapsed) / 1000);
          return {
            success: false,
            message: `Terlalu banyak percobaan PIN salah. Akun dikunci sementara (${remainingSec} detik).`
          };
        } else {
          delete _failedAttempts[userKey];
        }
      }
    }

    // Verifikasi PIN
    const correctPin = matchedUser.pin || "1234";
    if (cleanPin !== correctPin) {
      if (!_failedAttempts[userKey]) _failedAttempts[userKey] = { count: 0, lastAttempt: Date.now() };
      _failedAttempts[userKey].count++;
      _failedAttempts[userKey].lastAttempt = Date.now();
      const sisa = MAX_ATTEMPTS - _failedAttempts[userKey].count;
      return {
        success: false,
        message: sisa > 0
          ? `PIN salah untuk ${matchedUser.name}! (Sisa percobaan: ${sisa})`
          : `PIN salah 5 kali! Akun dikunci sementara 30 detik demi keamanan.`
      };
    }

    // Berhasil login -> reset counter percobaan gagal
    delete _failedAttempts[userKey];

    // Format nama depan kapital
    const displayName = matchedUser.name ? _capitalize(matchedUser.name) : _capitalize(userKey);

    const session = {
      username: matchedUser.username,
      name: displayName,
      role: matchedUser.role,
      division: matchedUser.division || (matchedUser.role === "admin" ? "ADMIN" : "KITCHEN"),
      avatar: matchedUser.avatar || (matchedUser.role === "superadmin" ? "👑" : matchedUser.role === "admin" ? "👨‍💼" : "🧑‍🍳"),
      loginAt: new Date().toISOString()
    };

    _saveSession(session);

    return {
      success: true,
      message: `Selamat datang, ${session.name}!`,
      user: session
    };
  }

  /** Logout */
  function logout() {
    _clearSession();
  }

  /** Cek status login */
  function isLoggedIn() {
    return !!_getSession();
  }

  /** Ambil user aktif */
  function getCurrentUser() {
    return _getSession();
  }

  /** Cek Roles */
  function isSuperAdmin() {
    const u = _getSession();
    return !!(u && u.role === "superadmin");
  }

  function isAdmin() {
    const u = _getSession();
    return !!(u && (u.role === "admin" || u.role === "superadmin"));
  }

  function isStaff() {
    const u = _getSession();
    return !!(u && u.role === "staff");
  }

  /**
   * Hanya Admin (role: 'admin') yang berhak melihat nilai uang (Rupiah).
   * Super Admin dan Staff TIDAK melihat tampilan uang sesuai instruksi.
   */
  function canViewMoney() {
    const u = _getSession();
    return !!(u && u.role === "admin");
  }

  function getUserDivision() {
    const u = _getSession();
    return u ? (u.division || (u.role === "admin" ? "ADMIN" : "KITCHEN")) : "KITCHEN";
  }

  /**
   * Cek apakah user yang login berhak menginput barang dengan divisi tertentu:
   * 1. Super Admin (Satian) -> TIDAK BISA input stok sama sekali.
   * 2. Admin (Ragil, Angel) -> BISA input SEMUA kategori (Kitchen, Barista, Pastry, Lain-Lain).
   * 3. Barista -> HANYA bisa input 'BAR' dan 'LAINNYA'.
   * 4. Kitchen -> HANYA bisa input 'KITCHEN' dan 'LAINNYA'.
   * 5. Pastry  -> HANYA bisa input 'PASTRY' dan 'LAINNYA'.
   */
  function canInputItemDivision(itemDiv) {
    const u = _getSession();
    if (!u) return false;
    if (u.role === "superadmin" || (u.username && u.username.toLowerCase() === "satian")) {
      return false;
    }
    if (u.role === "admin" || u.division === "ADMIN" || u.division === "ALL") {
      return true;
    }
    const cleanItemDiv = (itemDiv || "").toUpperCase();
    if (cleanItemDiv === "LAINNYA") {
      return true; // Kategori Lain-Lain terbuka untuk semua staf!
    }
    const userDiv = (u.division || "").toUpperCase();
    if ((userDiv === "BAR" || userDiv === "BARISTA") && cleanItemDiv === "BAR") return true;
    return userDiv === cleanItemDiv;
  }

  function getAllowedDivisions() {
    const u = _getSession();
    if (!u || u.role === "superadmin" || u.username === "satian") return [];
    if (u.role === "admin" || u.division === "ADMIN" || u.division === "ALL") {
      return ["KITCHEN", "BAR", "PASTRY", "LAINNYA"];
    }
    const userDiv = (u.division || "KITCHEN").toUpperCase();
    if (userDiv === "BAR" || userDiv === "BARISTA") return ["BAR", "LAINNYA"];
    if (userDiv === "PASTRY") return ["PASTRY", "LAINNYA"];
    return ["KITCHEN", "LAINNYA"];
  }

  /**
   * Izin input stok:
   * Staf dan Admin operasional BISA input stok.
   * Super Admin (satian) TIDAK BISA input stok karena fokus pada pengelola sistem.
   */
  function canInputStock() {
    const u = _getSession();
    if (!u) return false;
    if (u.role === "superadmin" || (u.username && u.username.toLowerCase() === "satian")) {
      return false;
    }
    return true;
  }

  /**
   * Karyawan mengubah PIN sendiri
   * @param {string} oldPin
   * @param {string} newPin
   */
  function changeMyPin(oldPin, newPin) {
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

    const users = _loadUsers();
    const user = users[session.username];
    if (!user) {
      return { success: false, message: "User tidak ditemukan di sistem." };
    }

    const currentPin = user.pin || "1234";
    if (oldPin.trim() !== currentPin) {
      return { success: false, message: "PIN lama yang Anda masukkan salah!" };
    }

    user.pin = newPin.trim();
    _saveUsers(users);

    return {
      success: true,
      message: "PIN Anda berhasil diperbarui! Gunakan PIN baru ini untuk login berikutnya."
    };
  }

  /**
   * Super Admin Only: Ubah/Reset PIN Karyawan Manapun
   * @param {string} targetUsername
   * @param {string} newPin
   */
  function setEmployeePin(targetUsername, newPin) {
    if (!isSuperAdmin()) {
      return { success: false, message: "Akses ditolak: Hanya Super Admin yang dapat mengatur PIN karyawan lain." };
    }

    if (!newPin || newPin.trim().length < 4) {
      return { success: false, message: "PIN minimal 4 angka/karakter." };
    }

    const users = _loadUsers();
    const user = users[targetUsername];
    if (!user) {
      return { success: false, message: "Karyawan tidak ditemukan." };
    }

    user.pin = newPin.trim();
    _saveUsers(users);

    return {
      success: true,
      message: `PIN untuk karyawan "${user.name}" berhasil diubah menjadi: ${newPin.trim()}`
    };
  }

  /**
   * Super Admin Only: Tambah Karyawan Baru
   * @param {string} name - Nama karyawan
   * @param {'ADMIN'|'BAR'|'KITCHEN'|'PASTRY'|'LAINNYA'} division - Kategori Divisi
   * @param {string} pin - PIN awal (default: 1234)
   */
  function addUser(name, division = "KITCHEN", pin = "1234") {
    if (!isSuperAdmin()) {
      return { success: false, message: "Akses ditolak: Hanya Super Admin yang dapat menambah user." };
    }

    if (!name || !name.trim()) {
      return { success: false, message: "Nama karyawan tidak boleh kosong." };
    }

    const trimmedName = name.trim();
    const username = trimmedName.toLowerCase().replace(/\s+/g, "");

    const users = _loadUsers();
    if (users[username]) {
      return { success: false, message: `Karyawan "${trimmedName}" sudah terdaftar.` };
    }

    const cleanDiv = (division || "KITCHEN").toUpperCase();
    const role = cleanDiv === "ADMIN" ? "admin" : "staff";
    let avatar = "🍳";
    let divLabel = "Kitchen";

    if (cleanDiv === "ADMIN") {
      avatar = "👨‍💼";
      divLabel = "Admin (Semua Kategori)";
    } else if (cleanDiv === "BAR") {
      avatar = "☕";
      divLabel = "Barista (Bar & Lain-Lain)";
    } else if (cleanDiv === "PASTRY") {
      avatar = "🍰";
      divLabel = "Pastry (Pastry & Lain-Lain)";
    } else if (cleanDiv === "LAINNYA") {
      avatar = "📦";
      divLabel = "Lain-Lain";
    }

    users[username] = {
      username: username,
      name: _capitalize(trimmedName),
      role: role,
      division: cleanDiv,
      pin: (pin && pin.trim()) ? pin.trim() : "1234",
      avatar: avatar,
      createdAt: new Date().toISOString().split("T")[0]
    };

    _saveUsers(users);
    return {
      success: true,
      message: `Karyawan "${_capitalize(trimmedName)}" berhasil didaftarkan (Kategori: ${divLabel}, PIN: ${users[username].pin}).`
    };
  }

  /**
   * Super Admin Only: Hapus Karyawan
   * @param {string} username
   */
  function deleteUser(username) {
    if (!isSuperAdmin()) {
      return { success: false, message: "Akses ditolak: Hanya Super Admin yang dapat menghapus user." };
    }

    if (username === "satian") {
      return { success: false, message: "Akun Super Admin utama tidak dapat dihapus." };
    }

    const users = _loadUsers();
    if (!users[username]) {
      return { success: false, message: "User tidak ditemukan." };
    }

    const deletedName = users[username].name;
    delete users[username];
    _saveUsers(users);

    return {
      success: true,
      message: `User "${deletedName}" berhasil dihapus.`
    };
  }

  /**
   * Super Admin Only: Ubah Kategori / Divisi Karyawan
   * @param {string} username
   * @param {'ADMIN'|'BAR'|'KITCHEN'|'PASTRY'|'LAINNYA'} newDivision
   */
  function updateUserDivision(username, newDivision) {
    if (!isSuperAdmin()) {
      return { success: false, message: "Akses ditolak: Hanya Super Admin yang dapat mengubah kategori user." };
    }

    if (username === "satian") {
      return { success: false, message: "Kategori Super Admin utama tidak dapat diubah." };
    }

    const users = _loadUsers();
    if (!users[username]) {
      return { success: false, message: "User tidak ditemukan." };
    }

    const cleanDiv = (newDivision || "KITCHEN").toUpperCase();
    const role = cleanDiv === "ADMIN" ? "admin" : "staff";
    let avatar = "🍳";
    let divLabel = "Kitchen";

    if (cleanDiv === "ADMIN") {
      avatar = "👨‍💼";
      divLabel = "Admin (Semua)";
    } else if (cleanDiv === "BAR") {
      avatar = "☕";
      divLabel = "Barista";
    } else if (cleanDiv === "PASTRY") {
      avatar = "🍰";
      divLabel = "Pastry";
    } else if (cleanDiv === "LAINNYA") {
      avatar = "📦";
      divLabel = "Lain-Lain";
    }

    users[username].division = cleanDiv;
    users[username].role = role;
    users[username].avatar = avatar;
    _saveUsers(users);

    return {
      success: true,
      message: `Kategori "${users[username].name}" berhasil diubah menjadi ${divLabel}.`
    };
  }

  /**
   * Super Admin Only: Edit Profil Karyawan (Nama, Reset PIN, dan Kategori)
   * @param {string} username
   * @param {{ name?: string, pin?: string, division?: string }} updates
   */
  function updateUserInfo(username, updates = {}) {
    if (!isSuperAdmin()) {
      return { success: false, message: "Akses ditolak: Hanya Super Admin yang dapat mengedit karyawan." };
    }

    const users = _loadUsers();
    if (!users[username]) {
      return { success: false, message: "User tidak ditemukan." };
    }

    const user = users[username];

    // Ubah nama
    if (updates.name && updates.name.trim()) {
      user.name = _capitalize(updates.name.trim());
    }

    // Reset PIN (jika diisi)
    if (updates.pin && updates.pin.trim()) {
      const cleanPin = updates.pin.trim();
      if (cleanPin.length < 4) {
        return { success: false, message: "PIN minimal 4 angka." };
      }
      user.pin = cleanPin;
    }

    // Ubah kategori divisi (selain satian)
    if (updates.division && username !== "satian") {
      const cleanDiv = updates.division.toUpperCase();
      user.division = cleanDiv;
      user.role = cleanDiv === "ADMIN" ? "admin" : "staff";
      if (cleanDiv === "ADMIN") user.avatar = "👨‍💼";
      else if (cleanDiv === "BAR") user.avatar = "☕";
      else if (cleanDiv === "PASTRY") user.avatar = "🍰";
      else if (cleanDiv === "LAINNYA") user.avatar = "📦";
      else user.avatar = "🍳";
    }

    _saveUsers(users);

    return {
      success: true,
      message: `Data karyawan "${user.name}" berhasil diperbarui.`,
      user: JSON.parse(JSON.stringify(user))
    };
  }

  function updateUserRole(username, newRole) {
    return updateUserDivision(username, newRole === "admin" ? "ADMIN" : "KITCHEN");
  }

  return {
    login,
    logout,
    isLoggedIn,
    getCurrentUser,
    getUserDivision,
    canInputItemDivision,
    getAllowedDivisions,
    isSuperAdmin,
    isAdmin,
    isStaff,
    canViewMoney,
    canInputStock,
    getAllUsers,
    addUser,
    deleteUser,
    updateUserInfo,
    updateUserRole,
    updateUserDivision,
    changeMyPin,
    setEmployeePin,
  };
})();

if (typeof window !== "undefined") {
  window.AuthService = AuthService;
}
