/**
 * ════════════════════════════════════════════════════════════════════════════
 * RIMBA ALAM STOCK API — v3.3 (PIN-VERIFIED)
 * ════════════════════════════════════════════════════════════════════════════
 * Satu file. Cara pakai:
 *   1. Buka spreadsheet -> Ekstensi -> Apps Script
 *   2. Klik isi Code.gs, Ctrl+A, hapus, lalu paste SELURUH file ini
 *   3. Simpan (Ctrl+S)
 *   4. Deploy -> Manage deployments -> ikon pensil -> Version: New version
 *      -> Deploy        (JANGAN "New deployment", URL-nya berubah)
 *
 * Perubahan dari v3.2:
 *   - doGet/doPost lama di-rename jadi _realDoGet/_realDoPost (isinya utuh)
 *   - ditambah gate PIN: setiap request wajib authUser + authPin yang cocok
 *     dengan tab DATA_PENGGUNA; PIN diverifikasi di server, bukan di browser
 *   - hapus user / ubah PIN orang lain: hanya Admin / Super Admin
 *   - 10x PIN salah: akun terkunci 10 menit
 *
 * OPSIONAL, hanya kalau masih memakai akun owner "satian" (akun ini tidak ada
 * di sheet): Project Settings -> Script Properties ->
 *      OWNER_USERNAME = satian
 *      OWNER_PIN      = <PIN baru, jangan 1212>
 * Kalau tidak diisi, akun satian tidak bisa sync (memang disengaja).
 * ════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════ BAGIAN 1: SECURITY GATE ═══════════════════════
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
  const _p = (e && e.parameter) || {};
  if (_p.action === "askAI") return handleAskAI_(e, auth.user, null);
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

  if (payload && payload.action === "askAI") return handleAskAI_(e, auth.user, payload);

  return _realDoPost(e);
}


// ═════════════════════ BAGIAN 2: KODE APLIKASI (v3.2) ═════════════════════
/**
 * ============================================================================
 * GOOGLE APPS SCRIPT (GAS) - RIMBA ALAM STOCK API (v3.2 - PRECISION MATRIX ENGINE)
 * ============================================================================
 * Fitur:
 * 1. DUKUNGAN ANGKA DESIMAL: Input 2.5, 8.2, 0.5 (koma maupun titik).
 * 2. DUAL-SYNC: Catat riwayat di 'MUTASI_APP' dan isi sel tanggal riil di tab bulanan.
 * 3. TITLE CASE OTOMATIS: Semua nama barang otomatis menjadi format Kapital Awal Kata
 *    (contoh: "jagung bakar" / "JAGUNG BAKAR" -> "Jagung Bakar").
 * 4. PENGURUTAN ALFABETIS & PENEMPATAN KATEGORI AKURAT:
 *    - KITCHEN: Mulai di bawah header tabel (baris 15 dst, TIDAK di atas header).
 *    - BAR (BARISTA): Masuk ke bagian Bar (mulai Amidis 330Ml dst) terurut A-Z.
 *    - PASTRY: Masuk ke bagian Pastry (mulai Blueband Margarine dst) terurut A-Z.
 *    - LAIN-LAIN: Masuk ke bagian paling bawah terurut A-Z dengan BORDER TABEL & FONT 12 LENGKAP.
 * 5. FONT DEFAULT 12 & FULL TABLE BORDER: Setiap baris baru yang disisipkan mewarisi
 *    border sel lengkap dan ukuran font 12 sesuai format spreadsheet.
 * 6. FITUR HAPUS ITEM (SUPER ADMIN): Otomatis menghapus baris barang dari tab bulanan.
 * 7. OTOMATIS BIKIN SHEET BULAN BARU:
 *    - Membaca kalender riil (28, 29, 30, atau 31 hari).
 *    - Otomatis menyalin 'SISA STOK AKHIR' bulan lalu ke Kolom B ('S, AKHIR') bulan baru.
 * 8. LockService Concurrency Guard: Anti-bentrok saat banyak staf input bersamaan.
 * ============================================================================
 */

const SHEET_LOG_NAME = "MUTASI_APP";
const SHEET_SPOIL_NAME = "REKAP_SPOIL";
const SHEET_USERS_NAME = "DATA_PENGGUNA";

/**
 * Mendapatkan atau membuat sheet DATA_PENGGUNA (Akun Karyawan Master)
 * Catatan: Akun 'satian' (Owner) BERSIFAT RAHASIA dan TIDAK PERNAH disimpan di sheet ini.
 */
function getOrCreateUsersSheet(ss) {
  let sheet = ss.getSheetByName(SHEET_USERS_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_USERS_NAME);
    const headers = [
      "USERNAME", "NAMA KARYAWAN", "PIN", "IZIN AKSES DIVISI",
      "ROLE", "AVATAR", "TANGGAL DAFTAR"
    ];
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.setRowHeight(1, 30);
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");

    // Akun default awal (Tanpa satian!)
    const initialUsers = [
      ["admin", "Admin Rimba Alam", "1234", "KITCHEN, BAR, PASTRY, LAINNYA", "superadmin", "👔", "2026-01-01"],
      ["ragil", "Ragil", "1234", "KITCHEN, BAR, PASTRY, LAINNYA", "admin", "👨‍💼", "2026-01-01"],
      ["angel", "Angel", "1234", "KITCHEN, BAR, PASTRY, LAINNYA", "admin", "👩‍💼", "2026-01-01"],
      ["chef", "Chef Rina", "1234", "KITCHEN, LAINNYA", "staff", "🍳", "2026-01-01"],
      ["rey", "Rey", "1234", "KITCHEN, LAINNYA", "staff", "🍳", "2026-01-01"],
      ["barista", "Doni", "1234", "BAR, LAINNYA", "staff", "☕", "2026-01-01"],
      ["pastry", "Dewi Pastry", "1234", "PASTRY, LAINNYA", "staff", "🍰", "2026-01-01"]
    ];
    sheet.getRange(2, 1, initialUsers.length, headers.length).setValues(initialUsers)
      .setFontSize(11)
      .setFontFamily("Arial")
      .setHorizontalAlignment("left")
      .setBorder(true, true, true, true, true, true, "#cbd5e1", SpreadsheetApp.BorderStyle.SOLID);
    sheet.autoResizeColumns(1, headers.length);
  }
  return sheet;
}

/**
 * Mendapatkan atau membuat sheet REKAP_SPOIL otomatis
 */
function getOrCreateSpoilSheet(ss) {
  let sheet = ss.getSheetByName(SHEET_SPOIL_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_SPOIL_NAME);
    const headers = [
      "ID TRANSAKSI", "TIMESTAMP", "TANGGAL", "DEVISI",
      "NAMA BARANG", "SATUAN", "JUMLAH SPOIL", "ALASAN SPOIL",
      "HARGA SATUAN (RP)", "TOTAL KERUGIAN (RP)", "DICATAT OLEH"
    ];
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#e65100").setFontColor("#ffffff").setFontWeight("bold");
    sheet.autoResizeColumns(1, headers.length);
  }
  return sheet;
}

/**
 * Format string menjadi Title Case (Huruf Kapital di awal setiap kata)
 * Contoh: "jagung bakar" -> "Jagung Bakar", "JAGUNG BAKAR" -> "Jagung Bakar"
 */
function toTitleCase(str) {
  if (!str) return "";
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/(?:^|[\s\(\)\[\]\/\-_,.:;])([a-z])/g, function(match, char) {
      return match.toUpperCase();
    });
}

function _realDoPost(e) {
  const lock = LockService.getScriptLock();
  const success = lock.tryLock(10000);
  if (!success) {
    return createJsonResponse({
      success: false,
      message: "Server sibuk memproses antrean staf lain, coba sebentar lagi."
    }, 429);
  }

  try {
    const rawData = e.postData ? e.postData.contents : null;
    if (!rawData) {
      return createJsonResponse({ success: false, message: "No payload received" }, 400);
    }

    const payload = JSON.parse(rawData);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // ── AKSI KHUSUS PENGELOLAAN USER (TAB 'DATA_PENGGUNA') ──
    if (payload.action === "saveUser") {
      return handleSaveUser(payload, ss);
    }
    if (payload.action === "deleteUser") {
      return handleDeleteUserFromSheet(payload, ss);
    }
    if (payload.action === "updateUserPin") {
      return handleUpdateUserPinInSheet(payload, ss);
    }

    // ── 1. CATAT KE TAB LOG MUTASI ('MUTASI_APP') ──
    let logSheet = ss.getSheetByName(SHEET_LOG_NAME);
    if (!logSheet) {
      logSheet = ss.insertSheet(SHEET_LOG_NAME);
      logSheet.appendRow([
        "ID Transaksi",
        "Waktu Input",
        "Divisi",
        "Nama Staf",
        "ID Barang",
        "Nama Barang",
        "Satuan",
        "Tipe (IN/OUT)",
        "Qty",
        "Catatan",
        "Harga Satuan",
        "Total Nilai (Rp)"
      ]);
      logSheet.getRange(1, 1, 1, 12).setFontWeight("bold").setBackground("#2e7d32").setFontColor("#ffffff");
      logSheet.setFrozenRows(1);
    }

    // ── DEFINISI VARIABEL UMUM (WAKTU & ID) ──
    const timestamp = payload.timestamp || Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
    const txnId = payload.id || ("TXN-" + new Date().getTime());

    // ── AKSI KHUSUS 1: UPDATE INFO BARANG (NAMA & HARGA) ──
    if (payload.action === "updateItem") {
      const oldName = toTitleCase(String(payload.oldName || "").trim());
      const newName = toTitleCase(String(payload.newName || payload.name || oldName).trim());
      const oldPrice = Number(payload.oldPrice) || 0;
      const newPrice = Number(payload.newPrice !== undefined ? payload.newPrice : payload.price) || 0;
      const division = (payload.division || "-").toUpperCase();
      const staffName = payload.staffName || payload.adminName || "Admin";

      // Catat riwayat apa yang diedit (apa jadi apa secara transparan)
      const auditChanges = [];
      if (newName && oldName && newName.toLowerCase() !== oldName.toLowerCase()) {
        auditChanges.push(`Nama: "${oldName}" -> "${newName}"`);
      }
      if (payload.newPrice !== undefined && newPrice !== oldPrice && oldPrice > 0) {
        auditChanges.push(`Harga: Rp ${oldPrice.toLocaleString("id-ID")} -> Rp ${newPrice.toLocaleString("id-ID")}`);
      } else if (newPrice > 0) {
        auditChanges.push(`Harga jadi: Rp ${newPrice.toLocaleString("id-ID")}`);
      }
      const auditNotes = auditChanges.length > 0 ? auditChanges.join(" • ") : `Edit: "${newName}" (Rp ${newPrice.toLocaleString("id-ID")})`;

      // 1. Catat ke MUTASI_APP sebagai riwayat audit
      logSheet.appendRow([
        "EDIT-ITEM-" + new Date().getTime(),
        timestamp,
        division,
        staffName,
        payload.itemId || "-",
        newName,
        "-",
        "UBAH_DATA",
        0,
        auditNotes,
        newPrice,
        0
      ]);

      // 2. Cari dan perbarui di sheet bulanan (Kolom A = Nama Barang, Kolom D = Harga Satuan)
      const sheets = ss.getSheets();
      let updatedCount = 0;
      for (let s of sheets) {
        if (s.getName() === SHEET_LOG_NAME) continue;
        const lastRow = s.getLastRow();
        if (lastRow < 4) continue;
        const names = s.getRange(4, 1, lastRow - 3, 1).getValues();
        for (let r = 0; r < names.length; r++) {
          const rowName = String(names[r][0] || "").trim().toLowerCase();
          if (rowName === oldName.toLowerCase() || rowName === newName.toLowerCase()) {
            const actualRow = r + 4;
            if (newName && newName !== oldName) {
              s.getRange(actualRow, 1).setValue(newName).setFontSize(12).setFontFamily("Arial").setHorizontalAlignment("left");
            }
            if (payload.newPrice !== undefined && newPrice >= 0) {
              const cellPrice = s.getRange(actualRow, 4);
              const tmplFmt = (actualRow > 4 ? s.getRange(actualRow - 1, 4).getNumberFormat() : cellPrice.getNumberFormat()) || '"Rp"#,##0';
              const finalPriceFmt = (tmplFmt && tmplFmt.includes("Rp")) ? tmplFmt : '"Rp"#,##0';
              cellPrice
                .setValue(newPrice)
                .setFontSize(11)
                .setFontFamily("Arial")
                .setNumberFormat(finalPriceFmt)
                .setHorizontalAlignment("left"); // Rata Kiri

              // Pastikan kolom RP/COST pada baris ini tetap Font 11, berformat Rp, dan Rata Kiri
              const sLastCol = s.getLastColumn();
              if (sLastCol >= 67) {
                for (let c = 67; c <= sLastCol; c++) {
                  const headerText = String(s.getRange(4, c).getValue() || "").toLowerCase();
                  if (headerText.includes("cost") || headerText.includes("rp") || c === 70) {
                    s.getRange(actualRow, c)
                      .setFontSize(11)
                      .setFontFamily("Arial")
                      .setNumberFormat('"Rp"#,##0')
                      .setHorizontalAlignment("left"); // Rata Kiri
                  }
                }
              }
            }
            updatedCount++;
            break;
          }
        }
      }

      return createJsonResponse({
        success: true,
        message: `Koreksi data "${newName}" berhasil diperbarui di spreadsheet!`
      });
    }

    // ── AKSI KHUSUS 2: TAMBAH BARANG BARU SESUAI ALFABET & KATEGORI ──
    if (payload.action === "addItem") {
      const itemName = toTitleCase(String(payload.name || "").trim());
      const division = (payload.division || "KITCHEN").toUpperCase();
      const unit = (payload.unit || "PCS").toUpperCase();
      const price = Number(payload.price) || 0;
      const stock = parseFloat(String(payload.stock || "0").replace(/,/g, ".")) || 0;
      const staffName = payload.staffName || payload.adminName || "Admin";

      // 1. Catat ke MUTASI_APP
      logSheet.appendRow([
        "ADD-ITEM-" + new Date().getTime(),
        timestamp,
        division,
        staffName,
        payload.id || ("NEW-" + new Date().getTime()),
        itemName,
        unit,
        "TAMBAH_BARANG",
        stock,
        `Tambah barang baru (${division}) - Stok Awal: ${stock} ${unit}`,
        price,
        Math.round(stock * price)
      ]);

      // 2. Sisipkan ke sheet bulanan aktif sesuai alfabet dan divisi
      const now = new Date();
      const targetSheet = getOrCreateMonthlySheet(ss, now.getFullYear(), now.getMonth() + 1);
      let insertedRow = -1;
      if (targetSheet) {
        insertedRow = insertItemAlphabetically(targetSheet, {
          name: itemName,
          division: division,
          unit: unit,
          price: price,
          stock: stock
        });
      }

      // 3. Sinkronkan juga ke seluruh sheet bulanan lain yang sudah terlanjur dibuat (misal sheet masa depan)
      const allSheets = ss.getSheets();
      for (let s of allSheets) {
        const sName = s.getName();
        if (sName === SHEET_LOG_NAME || sName === SHEET_SPOIL_NAME) continue;
        if (targetSheet && s.getName() === targetSheet.getName()) continue;
        if (s.getLastRow() < 14) continue;
        // Cek apakah item sudah ada di sheet s
        const sLastRow = s.getLastRow();
        const sNames = s.getRange(1, 1, sLastRow, 1).getValues();
        let exists = false;
        const cleanName = itemName.toLowerCase();
        for (let r = 0; r < sNames.length; r++) {
          if (String(sNames[r][0] || "").trim().toLowerCase() === cleanName) {
            exists = true;
            break;
          }
        }
        if (!exists) {
          // Tab bulan LAIN dapat baris katalog baru dengan stok awal 0.
          // Kalau stok awal ikut disalin, nilai aset bulan yang sudah lewat
          // mendadak naik padahal barangnya baru didaftarkan bulan ini.
          insertItemAlphabetically(s, {
            name: itemName,
            division: division,
            unit: unit,
            price: price,
            stock: 0
          });
          console.log(`Menyinkronkan item baru "${itemName}" ke tab yang sudah ada: ${sName} (stok awal 0)`);
        }
      }

      return createJsonResponse({
        success: true,
        insertedRow: insertedRow,
        message: `Barang baru "${itemName}" (${division}) berhasil ditambahkan ke spreadsheet pada baris ${insertedRow} sesuai alfabet!`
      });
    }

    // ── AKSI KHUSUS 3: HAPUS BARANG DARI KATALOG & SPREADSHEET (ADMIN) ──
    if (payload.action === "deleteItem") {
      const itemName = toTitleCase(String(payload.itemName || payload.name || "").trim());
      const division = (payload.division || "KITCHEN").toUpperCase();
      const adminName = payload.adminName || payload.staffName || "Admin";

      // 1. Catat ke MUTASI_APP
      logSheet.appendRow([
        "DEL-ITEM-" + new Date().getTime(),
        timestamp,
        division,
        adminName,
        payload.itemId || "-",
        itemName,
        "-",
        "HAPUS_BARANG",
        0,
        `Barang "${itemName}" (${division}) dihapus dari katalog oleh ${adminName}`,
        0,
        0
      ]);

      // 2. Hapus baris dari sheet bulanan aktif
      const now = new Date();
      const targetSheet = getOrCreateMonthlySheet(ss, now.getFullYear(), now.getMonth() + 1);
      let deletedRow = -1;
      if (targetSheet) {
        deletedRow = deleteItemFromSheet(targetSheet, itemName);
      }

      // 3. Hapus juga dari sheet bulanan lainnya jika ada
      const allSheets = ss.getSheets();
      for (let s of allSheets) {
        const sName = s.getName();
        if (sName === SHEET_LOG_NAME || sName === SHEET_SPOIL_NAME) continue;
        if (targetSheet && s.getName() === targetSheet.getName()) continue;
        if (s.getLastRow() < 14) continue;
        deleteItemFromSheet(s, itemName);
      }

      return createJsonResponse({
        success: true,
        deletedRow: deletedRow,
        message: deletedRow !== -1
          ? `Barang "${itemName}" berhasil dihapus dari baris ${deletedRow} spreadsheet!`
          : `Barang "${itemName}" berhasil dicatat penghapusannya.`
      });
    }

    // ── 3. MUTASI TRANSAKSI BIASA (IN / OUT / EDIT) ──
    const division = payload.division || "-";
    const staffName = payload.staffName || "-";
    const itemId = payload.itemId || "-";
    const itemName = toTitleCase(payload.itemName || "-");
    const unit = payload.unit || "-";
    const type = payload.type || "OUT";
    
    // Parse angka desimal (bisa koma '8,2' atau titik '8.2')
    const rawQtyStr = String(payload.qty || "0").replace(/,/g, ".");
    const qty = parseFloat(rawQtyStr) || 0;
    
    const notes = payload.notes || "";
    const price = Number(payload.price) || 0;
    const totalRp = Math.round(qty * price);

    const isEdit = payload.action === "editMutation";
    const oldQty = parseFloat(String(payload.oldQty || "0").replace(/,/g, ".")) || 0;
    const newQty = parseFloat(String(payload.newQty !== undefined ? payload.newQty : (isEdit ? (oldQty + qty) : qty)).replace(/,/g, ".")) || 0;
    const deltaQty = payload.deltaQty !== undefined
      ? parseFloat(String(payload.deltaQty).replace(/,/g, "."))
      : (newQty - oldQty);

    if (isEdit) {
      // 1. Coba cari baris transaksi asli di MUTASI_APP untuk diperbarui
      let updatedExisting = false;
      const data = logSheet.getDataRange().getValues();
      for (let r = 1; r < data.length; r++) {
        if (String(data[r][0]) === String(txnId)) {
          logSheet.getRange(r + 1, 9).setValue(newQty);
          logSheet.getRange(r + 1, 10).setValue(notes);
          logSheet.getRange(r + 1, 12).setValue(Math.round(newQty * price));
          updatedExisting = true;
          break;
        }
      }

      // 2. Jika tidak ditemukan, catat baris penyesuaian dengan nilai delta
      if (!updatedExisting) {
        logSheet.appendRow([
          txnId + "-EDIT",
          timestamp,
          division,
          staffName,
          itemId,
          itemName,
          unit,
          type,
          deltaQty,
          notes,
          price,
          Math.round(deltaQty * price)
        ]);
      }
    } else {
      logSheet.appendRow([
        txnId,
        timestamp,
        division,
        staffName,
        itemId,
        itemName,
        unit,
        type,
        qty,
        notes,
        price,
        totalRp
      ]);
    }

    // ── PENCATATAN KHUSUS TAB REKAP_SPOIL JIKA TIPE TRANSAKSI SPOIL ──
    if (type === "SPOIL") {
      try {
        const spoilSheet = getOrCreateSpoilSheet(ss);
        const spoilReason = payload.spoilReason || payload.reason || notes || "Rusak / Basi";
        spoilSheet.appendRow([
          txnId,
          timestamp,
          payload.date || timestamp.split(" ")[0],
          division,
          itemName,
          unit,
          qty,
          spoilReason,
          price,
          totalRp,
          staffName
        ]);
      } catch (errSpoil) {
        console.warn("Gagal mencatat ke REKAP_SPOIL: " + errSpoil.toString());
      }
    }

    // ── UPDATE LANGSUNG SEL DI TAB BULANAN ──
    updateMonthlyMatrixCell(ss, {
      date: payload.date || timestamp.split(" ")[0],
      itemName: itemName,
      type: type,
      qty: newQty,
      isEdit: isEdit,
      oldQty: oldQty
    });

    return createJsonResponse({
      success: true,
      txnId: txnId,
      message: isEdit
        ? `Koreksi ${itemName} (${type} dari ${oldQty} ke ${newQty} ${unit}, selisih: ${deltaQty}) berhasil dicatat!`
        : `Transaksi ${itemName} (${type} ${qty} ${unit}) berhasil dicatat!`
    });

  } catch (err) {
    return createJsonResponse({
      success: false,
      message: err.toString()
    }, 500);

  } finally {
    lock.releaseLock();
  }
}

function _realDoGet(e) {
  const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "";

  if (action === "inspectSheets" || action === "debugSheets") {
    return handleInspectAllSheets(e);
  }

  if (action === "readUsers" || action === "getUsers") {
    return handleReadUsers(e);
  }

  if (action === "readSheetData" || action === "syncMonthlyData" || action === "getItems") {
    return handleReadMonthlySheetData(e);
  }

  return createJsonResponse({
    status: "online",
    message: "Rimba Alam Stock Web App is ready to receive transactions."
  });
}

/**
 * Debug: Inspeksi seluruh tab sheet, mencari nilai-nilai manual dan struktur baris/kolom
 */
function handleInspectAllSheets(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();
    const list = [];

    for (let s of sheets) {
      const sName = s.getName();
      if (sName === SHEET_LOG_NAME) continue;

      const lastRow = s.getLastRow();
      const lastCol = s.getLastColumn();
      if (lastRow < 5) continue;

      // Baca 15 baris pertama kolom A-D
      const topRows = s.getRange(1, 1, Math.min(15, lastRow), Math.min(5, lastCol)).getValues();

      // Cek apakah ada rumus total di kolom-kolom akhir
      const sampleCols = Math.min(lastCol, 75);
      const row4 = s.getRange(4, 1, 1, sampleCols).getValues()[0];
      const row6 = s.getRange(6, 1, 1, sampleCols).getValues()[0];

      // Cari baris terakhir atau summary row
      const bottomRows = s.getRange(Math.max(1, lastRow - 5), 1, Math.min(6, lastRow), Math.min(10, lastCol)).getValues();

      list.push({
        name: sName,
        lastRow: lastRow,
        lastCol: lastCol,
        topRows: topRows.slice(0, 10),
        row4Sample: row4.slice(0, 10),
        row6Sample: row6.slice(0, 10),
        bottomRows: bottomRows
      });
    }

    return createJsonResponse({
      success: true,
      sheetsCount: sheets.length,
      sheets: list
    });
  } catch (err) {
    return createJsonResponse({
      success: false,
      message: err.toString()
    });
  }
}

/**
 * Membaca data barang dan mutasi nyata dari tanggal 1 s/d hari ini dari sheet bulanan
 */
function handleReadMonthlySheetData(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const now = new Date();
    const tz = "Asia/Jakarta";
    let curYear = parseInt(Utilities.formatDate(now, tz, "yyyy"), 10);
    let curMonth = parseInt(Utilities.formatDate(now, tz, "MM"), 10);
    let curDay = parseInt(Utilities.formatDate(now, tz, "dd"), 10);

    // Dukungan parameter URL fleksibel: ?month=10 atau ?sheet=Okt 2026 atau ?sheetName=...
    if (e && e.parameter) {
      if (e.parameter.month) curMonth = parseInt(e.parameter.month, 10);
      if (e.parameter.year) curYear = parseInt(e.parameter.year, 10);
    }

    const reqSheetName = (e && e.parameter && (e.parameter.sheet || e.parameter.sheetName)) ? (e.parameter.sheet || e.parameter.sheetName).trim() : "";
    let targetSheet = null;
    if (reqSheetName) {
      targetSheet = ss.getSheetByName(reqSheetName);
      if (!targetSheet) {
        for (let s of ss.getSheets()) {
          if (s.getName().toLowerCase().includes(reqSheetName.toLowerCase())) {
            targetSheet = s;
            break;
          }
        }
      }
    }
    if (!targetSheet) {
      targetSheet = getOrCreateMonthlySheet(ss, curYear, curMonth);
    }

    if (!targetSheet) {
      return createJsonResponse({
        success: false,
        message: "Tab spreadsheet bulanan tidak ditemukan."
      });
    }

    const lastRow = targetSheet.getLastRow();
    const lastCol = targetSheet.getLastColumn();
    const bounds = findCategoryBoundaries(targetSheet);

    const startRow = bounds.kitchenStartRow; // Baris 5 (setelah baris header 1-4)
    if (lastRow < startRow) {
      return createJsonResponse({
        success: false,
        message: "Belum ada baris data barang di sheet " + targetSheet.getName()
      });
    }

    const numRows = lastRow - startRow + 1;
    // Baca seluruh kolom data (minimal 72 kolom mencakup hari 1-31 dan kolom summary)
    const maxReadCol = Math.min(lastCol, Math.max(72, 2 * 31 + 10));
    const allData = targetSheet.getRange(startRow, 1, numRows, maxReadCol).getValues();

    // Deteksi dinamis posisi kolom summary dari baris 4 (Fleksibel untuk bulan 28, 29, 30, atau 31 hari)
    const headerRow4 = targetSheet.getRange(4, 1, 1, maxReadCol).getValues()[0] || [];
    let summaryColIn = -1;
    let summaryColOut = -1;
    let summaryColStock = -1;
    for (let c = 4; c < headerRow4.length; c++) {
      const h = String(headerRow4[c] || "").toUpperCase().replace(/\s+/g, " ").trim();
      if ((h.includes("JUMLAH IN") || h === "IN") && summaryColIn === -1 && c >= 4) {
        summaryColIn = c;
      } else if ((h.includes("JUMLAH OUT") || h === "OUT") && summaryColOut === -1 && c >= 4) {
        summaryColOut = c;
      } else if ((h.includes("STOK AKHIR") || h.includes("SISA STOK")) && summaryColStock === -1 && c >= 4) {
        summaryColStock = c;
      }
    }

    const daysInTargetMonth = new Date(curYear, curMonth, 0).getDate();
    if (summaryColIn === -1) {
      summaryColIn = 4 + (2 * daysInTargetMonth); // 0-based index
    }
    if (summaryColOut === -1) {
      summaryColOut = summaryColIn + 1;
    }
    if (summaryColStock === -1) {
      summaryColStock = summaryColIn + 2;
    }

    // Jumlah hari harian sebelum kolom summary (30 untuk Nov, 31 untuk Mei/Des, 28/29 untuk Feb)
    const daysToScan = Math.min(daysInTargetMonth, Math.max(1, Math.floor((summaryColIn - 4) / 2)));

    const items = [];
    let totalNilaiStokAset = 0;
    let totalRupiahMasuk = 0;
    let totalRupiahKeluar = 0;
    let totalInQty = 0;
    let totalOutQty = 0;

    for (let i = 0; i < numRows; i++) {
      const row = allData[i];
      const actualRow = startRow + i;
      const rawName = String(row[0] || "").trim();

      // Lewati baris kosong atau baris judul pemisah tabel
      if (!rawName || rawName.toLowerCase().startsWith("devisi") || rawName.toLowerCase().startsWith("divisi") || rawName.toLowerCase() === "item") {
        continue;
      }

      // Abaikan baris TOTAL rekap di bawah tabel
      if (rawName.toLowerCase().startsWith("total") || rawName.toLowerCase().startsWith("grand") || rawName.toLowerCase().startsWith("rekap")) {
        continue;
      }

      let division = "KITCHEN";
      if (actualRow >= bounds.lainnyaStartRow) {
        division = "LAINNYA";
      } else if (actualRow >= bounds.pastryStartRow) {
        division = "PASTRY";
      } else if (actualRow >= bounds.barStartRow) {
        division = "BAR";
      }

      const stokAwal = parseFloat(String(row[1] || "0").replace(/,/g, ".")) || 0;
      const unit = String(row[2] || "PCS").trim().toUpperCase();
      const price = parseFloat(String(row[3] || "0").replace(/,/g, ".")) || 0;

      // Hitung mutasi dari tanggal 1 s/d daysToScan secara nyata & real (TIDAK tembus ke kolom summary)
      let dailyIn = 0;
      let dailyOut = 0;
      const dailyHistory = {};
      for (let d = 1; d <= daysToScan; d++) {
        const colInIdx = (2 * d + 3) - 1; // 0-based array index (Col 5 = idx 4, dst)
        const colOutIdx = (2 * d + 4) - 1; // Col 6 = idx 5, dst
        let vIn = 0;
        let vOut = 0;
        if (colInIdx < row.length && colInIdx < summaryColIn) {
          vIn = parseFloat(String(row[colInIdx] || "0").replace(/,/g, ".")) || 0;
          dailyIn += vIn;
        }
        if (colOutIdx < row.length && colOutIdx < summaryColIn) {
          vOut = parseFloat(String(row[colOutIdx] || "0").replace(/,/g, ".")) || 0;
          dailyOut += vOut;
        }
        if (vIn > 0 || vOut > 0) {
          dailyHistory[d] = { in: vIn, out: vOut };
        }
      }

      // Ambil nilai dari kolom summary di spreadsheet
      let summaryIn = 0;
      let summaryOut = 0;
      if (summaryColIn < row.length) {
        summaryIn = parseFloat(String(row[summaryColIn] || "0").replace(/,/g, ".")) || 0;
      }
      if (summaryColOut < row.length) {
        summaryOut = parseFloat(String(row[summaryColOut] || "0").replace(/,/g, ".")) || 0;
      }

      // Gunakan nilai kolom summary langsung jika tersedia (mendukung nilai minus sesuai rumus SUM sheet)
      const itemIn = (summaryColIn < row.length && row[summaryColIn] !== "" && !isNaN(parseFloat(String(row[summaryColIn]).replace(/,/g, "."))))
        ? parseFloat(String(row[summaryColIn]).replace(/,/g, "."))
        : (Math.round(dailyIn * 1000) / 1000);

      const itemOut = (summaryColOut < row.length && row[summaryColOut] !== "" && !isNaN(parseFloat(String(row[summaryColOut]).replace(/,/g, "."))))
        ? parseFloat(String(row[summaryColOut]).replace(/,/g, "."))
        : (Math.round(dailyOut * 1000) / 1000);

      // Ambil nilai stok akhir riil dari kolom STOK AKHIR spreadsheet, atau fallback kalkulasi (stokAwal + In - Out)
      // Mendukung stok minus jika pemakaian melebihi stok tersedia (sinkron dengan sheet)
      let currentStock = (summaryColStock < row.length && row[summaryColStock] !== "" && !isNaN(parseFloat(String(row[summaryColStock]).replace(/,/g, "."))))
        ? parseFloat(String(row[summaryColStock]).replace(/,/g, "."))
        : Math.round((stokAwal + itemIn - itemOut) * 1000) / 1000;

      const itemNilaiAset = Math.round(currentStock * price);
      const itemRupiahIn = Math.round(itemIn * price);
      const itemRupiahOut = Math.round(itemOut * price);

      totalNilaiStokAset += itemNilaiAset;
      totalRupiahMasuk += itemRupiahIn;
      totalRupiahKeluar += itemRupiahOut;
      totalInQty += itemIn;
      totalOutQty += itemOut;

      items.push({
        id: actualRow,
        name: toTitleCase(rawName),
        division: division,
        unit: unit,
        price: price,
        stock: currentStock,
        stokAwal: stokAwal,
        inQtyMonth: itemIn,
        outQtyMonth: itemOut,
        dailyHistory: dailyHistory,
        minStock: 2
      });
    }

    return createJsonResponse({
      success: true,
      sheetName: targetSheet.getName(),
      year: curYear,
      month: curMonth,
      dayToDate: curDay,
      stats: {
        totalItems: items.length,
        totalNilaiStokAset: totalNilaiStokAset,
        totalRupiahMasuk: totalRupiahMasuk,
        totalRupiahKeluar: totalRupiahKeluar,
        totalInQty: Math.round(totalInQty * 1000) / 1000,
        totalOutQty: Math.round(totalOutQty * 1000) / 1000
      },
      items: items
    });
  } catch (err) {
    return createJsonResponse({
      success: false,
      message: "Gagal membaca data spreadsheet: " + err.toString()
    }, 500);
  }
}

function createJsonResponse(data, statusCode) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Update nilai sel di tab bulanan pada kolom tanggal transaksi.
 */
function updateMonthlyMatrixCell(ss, data) {
  try {
    const parts = data.date.split("-");
    const year = parseInt(parts[0], 10);
    const monthNum = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    if (isNaN(day) || day < 1 || day > 31) return;

    const targetSheet = getOrCreateMonthlySheet(ss, year, monthNum);
    if (!targetSheet) {
      console.warn("Sheet bulanan tidak ditemukan/gagal dibuat untuk: " + data.date);
      return;
    }

    const lastRow = targetSheet.getLastRow();
    if (lastRow < 4) return;

    const rangeNames = targetSheet.getRange(4, 1, lastRow - 3, 1).getValues();
    const cleanSearchName = data.itemName.trim().toLowerCase();
    let rowIndex = -1;

    for (let r = 0; r < rangeNames.length; r++) {
      const rowItemName = String(rangeNames[r][0] || "").trim().toLowerCase();
      if (rowItemName === cleanSearchName) {
        rowIndex = r + 4;
        break;
      }
    }

    if (rowIndex === -1) {
      for (let r = 0; r < rangeNames.length; r++) {
        const rowItemName = String(rangeNames[r][0] || "").trim().toLowerCase();
        if (rowItemName && (rowItemName.includes(cleanSearchName) || cleanSearchName.includes(rowItemName))) {
          rowIndex = r + 4;
          break;
        }
      }
    }

    if (rowIndex === -1) {
      console.warn("Barang tidak terdaftar di sheet: " + data.itemName);
      return;
    }

    const isOut = (data.type === "OUT" || data.type === "SPOIL");
    const colIndex = isOut ? (2 * day + 4) : (2 * day + 3);

    const cell = targetSheet.getRange(rowIndex, colIndex);
    const rawVal = String(cell.getValue() || "0").replace(/,/g, ".");
    const existingVal = parseFloat(rawVal) || 0;
    const addQty = parseFloat(String(data.qty).replace(/,/g, ".")) || 0;
    
    let newVal;
    if (data.isEdit) {
      const oldQty = parseFloat(String(data.oldQty || "0").replace(/,/g, ".")) || 0;
      newVal = Math.max(0, Math.round((existingVal - oldQty + addQty) * 1000) / 1000);
      console.log(`Edited ${data.itemName} baris ${rowIndex}, kolom ${colIndex}: ${existingVal} - ${oldQty} + ${addQty} = ${newVal}`);
    } else {
      newVal = Math.round((existingVal + addQty) * 1000) / 1000;
      console.log(`Updated ${data.itemName} baris ${rowIndex}, kolom ${colIndex}: ${existingVal} + ${addQty} = ${newVal}`);
    }

    cell.setValue(newVal).setHorizontalAlignment("left");
  } catch (e) {
    console.warn("Error updateMonthlyMatrixCell: " + e.toString());
  }
}

/**
 * Mencari tab bulanan. Menghubungkan langsung ke tab bulan ini atau tab aktif user.
 */
/**
 * Alias nama bulan (Indonesia + Inggris) supaya tab "Jun 2026", "June 2026",
 * "Juni 2026" sama-sama dikenali. Sebelumnya Juni/Juli/Agustus gagal cocok
 * karena sistem cuma mencari "june"/"july"/"august".
 */
const MONTH_ALIASES = [
  ["jan", "january", "januari"],
  ["feb", "february", "februari", "pebruari"],
  ["mar", "march", "maret"],
  ["apr", "april"],
  ["mei", "may"],
  ["jun", "june", "juni"],
  ["jul", "july", "juli"],
  ["aug", "agu", "ags", "agt", "agus", "august", "agustus"],
  ["sep", "sept", "september"],
  ["okt", "oct", "october", "oktober"],
  ["nov", "november", "nopember"],
  ["des", "dec", "december", "desember"]
];

/** Nama bulan untuk tab baru, gaya yang sama dengan tab yang sudah ada ("Nov 2026"). */
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
                     "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function _sheetTokens_(name) {
  return String(name || "").toLowerCase().split(/[^a-z0-9]+/).filter(function (t) { return !!t; });
}

/** 1-12 kalau nama tab memuat nama bulan, 0 kalau tidak. Dicocokkan per kata utuh. */
function _sheetMonthNum_(name) {
  const toks = _sheetTokens_(name);
  for (let i = 0; i < toks.length; i++) {
    for (let m = 0; m < 12; m++) {
      if (MONTH_ALIASES[m].indexOf(toks[i]) !== -1) return m + 1;
    }
  }
  return 0;
}

/** Tahun 4 digit di nama tab, 0 kalau tidak ada. */
function _sheetYear_(name) {
  const m = String(name || "").match(/(?:19|20)\d{2}/);
  return m ? parseInt(m[0], 10) : 0;
}

/**
 * Cari tab bulanan untuk (tahun, bulan) tertentu.
 * - Harus cocok bulan DAN tahun. Tab "Nov 2027" tidak akan dipakai untuk Nov 2026.
 * - Tab tanpa tahun (misal cuma "Nov") tetap diterima sebagai cadangan.
 * - Tab log / spoil / data pengguna selalu dilewati.
 */
function _findMonthlySheet_(ss, year, monthNum) {
  const sheets = ss.getSheets();
  let tanpaTahun = null;
  for (let i = 0; i < sheets.length; i++) {
    const s = sheets[i];
    const sName = s.getName();
    if (sName === SHEET_LOG_NAME || sName === SHEET_SPOIL_NAME || sName === SHEET_USERS_NAME) continue;
    if (_sheetMonthNum_(sName) !== monthNum) continue;
    const y = _sheetYear_(sName);
    if (y === year) return s;
    if (y === 0 && !tanpaTahun) tanpaTahun = s;
  }
  return tanpaTahun;
}

function getOrCreateMonthlySheet(ss, year, monthNum) {
  const monthNames = MONTH_SHORT;
  const fullMonthNames = [
    "januari", "februari", "maret", "april", "mei", "juni",
    "juli", "agustus", "september", "oktober", "november", "desember"
  ];

  const sheets = ss.getSheets();

  // 1. Cek tab bulan ini (misal "Nov", "November", "Nov 2026")
  const existing = _findMonthlySheet_(ss, year, monthNum);
  if (existing) return existing;

  // 2. AUTO-ROLLOVER BULAN BARU OTOMATIS:
  // Jika tab bulan baru belum ada, sistem mengkloning tab BULAN SEBELUMNYA yang kronologis!
  let prevMonthNum = monthNum - 1;
  let prevYear = year;
  if (prevMonthNum < 1) {
    prevMonthNum = 12;
    prevYear = year - 1;
  }
  // 2a. Cari tab bulan tepat sebelumnya (contoh: cari "Nov" / "November" jika sedang membuat "Des 2026")
  let prevSheet = _findMonthlySheet_(ss, prevYear, prevMonthNum);

  // 2b. Jika tidak ditemukan, cari tab bulanan terakhir (scanning dari kanan ke kiri sheet terbaru, BUKAN May!)
  if (!prevSheet) {
    for (let i = sheets.length - 1; i >= 0; i--) {
      const s = sheets[i];
      const sName = s.getName();
      if (sName !== SHEET_LOG_NAME && sName !== SHEET_SPOIL_NAME && sName !== SHEET_USERS_NAME && s.getLastRow() >= 14) {
        prevSheet = s;
        break;
      }
    }
  }

  if (prevSheet && year && monthNum) {
    try {
      const newSheetName = `${monthNames[monthNum - 1]} ${year}`;
      console.log(`[Auto-Rollover] Membuat tab bulan baru otomatis: "${newSheetName}" dari tab sumber "${prevSheet.getName()}"`);

      const newSheet = prevSheet.copyTo(ss);
      newSheet.setName(newSheetName);

      // 2c. Perbarui Judul Header Lembar (Ganti "MAY 2026" / nama bulan lama menjadi bulan baru)
      try {
        newSheet.getRange(1, 1).setValue("DAILY STOK IN-OUT RIMBA ALAM");
        newSheet.getRange(2, 1).setValue(`PERIODE : ${fullMonthNames[monthNum - 1].toUpperCase()} ${year}`);
      } catch (eTitle) {
        console.warn("Gagal update title header:", eTitle);
      }

      // Bersihkan seluruh Row 3 jika sebelumnya sempat terisi teks tanggal merah / tulisan mengambang
      try {
        newSheet.getRange(3, 1, 1, Math.max(70, newSheet.getLastColumn())).clearContent();
      } catch (eClrR3) {}

      // 2d. Perbarui Label Kolom B baris 4: "S, AKHIR\n(Nov)"
      try {
        const prevMonthLabel = monthNames[prevMonthNum - 1];
        newSheet.getRange(4, 2).setValue(`S, AKHIR\n(${prevMonthLabel})`);
      } catch (eColB) {}

      // 2e. Sesuaikan jumlah kolom tanggal (misal 30 hari ke 31 hari atau sebaliknya)
      const prevDays = new Date(prevYear, prevMonthNum, 0).getDate();
      const newDays = new Date(year, monthNum, 0).getDate();
      try {
        if (prevDays < newDays) {
          const diffCols = (newDays - prevDays) * 2;
          const insertAfterCol = 4 + 2 * prevDays;
          newSheet.insertColumnsAfter(insertAfterCol, diffCols);
        } else if (prevDays > newDays) {
          const diffCols = (prevDays - newDays) * 2;
          const deleteStartCol = 5 + 2 * newDays;
          newSheet.deleteColumns(deleteStartCol, diffCols);
        }
      } catch (eColsAdj) {
        console.warn("Penyesuaian kolom bulan rollover:", eColsAdj);
      }

      // 2f. Perbarui Label Tanggal Harian di Baris 4 (1-Des, 2-Des, dst) & In / Out di Baris 5 dengan border & format utuh
      try {
        const curMonthLabel = monthNames[monthNum - 1];
        for (let d = 1; d <= newDays; d++) {
          const colIn = 2 * d + 3;  // Kolom 5, 7, 9, ...
          const colOut = 2 * d + 4; // Kolom 6, 8, 10, ...
          
          // Merge 2 kolom untuk tanggal di Baris 4
          const rangeTgl = newSheet.getRange(4, colIn, 1, 2);
          try { rangeTgl.merge(); } catch (eM) {}
          rangeTgl.setValue(`${d}-${curMonthLabel}`)
            .setHorizontalAlignment("center")
            .setVerticalAlignment("middle")
            .setFontSize(10)
            .setFontWeight("bold")
            .setBackground("#ffefa6")
            .setBorder(true, true, true, true, true, true, "#000000", SpreadsheetApp.BorderStyle.SOLID);

          // Baris 5: In (Hitam) & Out (Merah)
          newSheet.getRange(5, colIn)
            .setValue("In")
            .setFontColor("#000000")
            .setFontWeight("bold")
            .setFontSize(10)
            .setHorizontalAlignment("center")
            .setBackground("#ffefa6")
            .setBorder(true, true, true, true, true, true, "#000000", SpreadsheetApp.BorderStyle.SOLID);

          newSheet.getRange(5, colOut)
            .setValue("Out")
            .setFontColor("#ff0000")
            .setFontWeight("bold")
            .setFontSize(10)
            .setHorizontalAlignment("center")
            .setBackground("#ffefa6")
            .setBorder(true, true, true, true, true, true, "#000000", SpreadsheetApp.BorderStyle.SOLID);
        }
      } catch (eDates) {
        console.warn("Gagal update header tanggal/in-out:", eDates);
      }

      const lastRow = prevSheet.getLastRow();
      const lastCol = Math.max(newSheet.getLastColumn(), 68);
      const startDataRow = 6; // Baris data barang riil dimulai dari baris 6 (Baris 4 = Tanggal, Baris 5 = In/Out)
      const numRows = lastRow - startDataRow + 1;

      if (numRows > 0) {
        // Cari kolom STOK AKHIR di prevSheet
        const prevR4 = prevSheet.getRange(4, 1, 1, prevSheet.getLastColumn()).getValues()[0] || [];
        let prevStockCol = -1;
        for (let c = 4; c < prevR4.length; c++) {
          const h = String(prevR4[c] || "").toUpperCase().replace(/\s+/g, " ").trim();
          if (h.includes("STOK AKHIR") || h.includes("SISA STOK")) {
            prevStockCol = c;
            break;
          }
        }
        if (prevStockCol === -1) {
          prevStockCol = 4 + 2 * prevDays + 2;
        }

        const prevData = prevSheet.getRange(startDataRow, 1, numRows, prevSheet.getLastColumn()).getValues();
        for (let r = 0; r < numRows; r++) {
          const row = prevData[r];
          const name = String(row[0] || "").trim();
          if (!name || name.toLowerCase().startsWith("devisi") || name.toLowerCase().startsWith("divisi") || name.toLowerCase() === "item" || name.toLowerCase().startsWith("total")) {
            continue;
          }

          // Ambil sisa stok akhir bulan lalu dari kolom STOK AKHIR riil
          let sisaStok = 0;
          if (prevStockCol < row.length && row[prevStockCol] !== "" && !isNaN(parseFloat(String(row[prevStockCol]).replace(/,/g, ".")))) {
            sisaStok = parseFloat(String(row[prevStockCol]).replace(/,/g, "."));
          } else {
            const stokAwal = parseFloat(String(row[1] || "0").replace(/,/g, ".")) || 0;
            let totalIn = 0;
            let totalOut = 0;
            for (let d = 1; d <= prevDays; d++) {
              const inIdx = (2 * d + 3) - 1;
              const outIdx = (2 * d + 4) - 1;
              if (inIdx < row.length) totalIn += parseFloat(String(row[inIdx] || "0").replace(/,/g, ".")) || 0;
              if (outIdx < row.length) totalOut += parseFloat(String(row[outIdx] || "0").replace(/,/g, ".")) || 0;
            }
            sisaStok = Math.max(0, Math.round((stokAwal + totalIn - totalOut) * 1000) / 1000);
          }
          sisaStok = Math.max(0, sisaStok);

          // Pindahkan sisa stok bulan lalu menjadi Stok Awal (Kolom 2 / B) di bulan baru
          newSheet.getRange(startDataRow + r, 2).setValue(sisaStok).setFontSize(12).setHorizontalAlignment("left");
        }

        // Kosongkan seluruh kolom mutasi harian tgl 1 s/d newDays (Kolom 5 s/d 4 + 2*newDays) di tab baru
        // DIMULAI DARI BARIS 6 (bukan baris 5), sehingga header "In" dan "Out" di baris 5 TETAP UTUH!
        const colsToClear = 2 * newDays;
        const mutasiRange = newSheet.getRange(startDataRow, 5, numRows, colsToClear);
        mutasiRange.clearContent();
        mutasiRange.setBorder(true, true, true, true, true, true, "#000000", SpreadsheetApp.BorderStyle.SOLID);
      }

      console.log(`[Auto-Rollover] Berhasil membuat tab "${newSheetName}" dari "${prevSheet.getName()}" dengan sisa stok dan katalog lengkap!`);
      return newSheet;
    } catch (errRollover) {
      console.warn("Gagal auto-rollover sheet baru: " + errRollover.toString());
    }
  }

  // 3. Fallback jika tab aktif bukan log/spoil
  const activeS = ss.getActiveSheet();
  if (activeS && activeS.getName() !== SHEET_LOG_NAME && activeS.getName() !== SHEET_SPOIL_NAME && activeS.getLastRow() >= 14) {
    return activeS;
  }

  // 4. Fallback sheet pertama
  for (let s of sheets) {
    if (s.getName() !== SHEET_LOG_NAME && s.getName() !== SHEET_SPOIL_NAME && s.getLastRow() >= 14) {
      return s;
    }
  }

  return sheets[0];
}

/**
 * Deteksi batas baris kategori secara akurat dalam sheet:
 * - KITCHEN: Dimulai setelah baris header (baris 15 dst, bukan baris 4)
 * - BAR: Dimulai dari "Amidis 330Ml" atau banner DEVISI BAR (tanpa bentrok dengan ketumbar/bakar)
 * - PASTRY: Dimulai dari "Blueband Margarine" (HARUS setelah Bar)
 * - LAIN-LAIN: Dimulai dari "Es Kacang Merah" (HARUS setelah Pastry)
 */
function findCategoryBoundaries(sheet) {
  const lastRow = sheet.getLastRow();
  const names = sheet.getRange(1, 1, lastRow, 1).getValues();

  // 1. Baris awal barang Kitchen: baris 5 (tepat setelah 4 baris header)
  let kitchenStartRow = 5;
  for (let r = 0; r < Math.min(lastRow, 15); r++) {
    const val = String(names[r][0] || "").trim().toLowerCase();
    if (val === "item" || val === "nama barang" || val === "nama item") {
      kitchenStartRow = r + 2;
      break;
    }
  }

  // 2. Baris awal Bar (Barista) - HINDARI substring "bar" agar tidak cocok dengan "ketumbar" atau "bakar"!
  let barStartRow = -1;
  for (let r = kitchenStartRow - 1; r < lastRow; r++) {
    const val = String(names[r][0] || "").trim().toLowerCase();
    const isBarMarker = (
      val.includes("amidis 330") ||
      val === "amidis" ||
      val === "devisi bar" ||
      val === "divisi bar" ||
      val === "barista" ||
      val === "bar" ||
      val.startsWith("bar ") ||
      val.includes("beans espresso")
    );
    if (isBarMarker) {
      barStartRow = r + 1;
      break;
    }
  }
  if (barStartRow === -1) {
    barStartRow = Math.round(kitchenStartRow + (lastRow - kitchenStartRow) * 0.6);
  }

  // 3. Baris awal Pastry (HARUS dicek setelah Bar!)
  let pastryStartRow = -1;
  const pastryKeywords = [
    "blueband margarine", "blue band margarine", "tatua mascarpone",
    "tepung cakra kembar", "gold label whipping", "dark compound",
    "cream of tartar", "icing sugar", "chocochip", "devisi pastry", "divisi pastry", "pastry"
  ];
  for (let r = barStartRow - 1; r < lastRow; r++) {
    const val = String(names[r][0] || "").trim().toLowerCase();
    if (pastryKeywords.some(function(k) { return val === k || val.startsWith(k + " ") || val.includes(k); })) {
      if (val.includes("devisi") || val.includes("divisi") || val === "pastry") {
        pastryStartRow = r + 2; // Lewati banner! Barang pertama mulai tepat di bawah banner
      } else {
        pastryStartRow = r + 1;
      }
      break;
    }
  }

  // 4. Baris awal Lain-Lain (HARUS dicek setelah Pastry / Bar!)
  let scanAfter = (pastryStartRow !== -1 ? pastryStartRow : barStartRow) - 1;
  let lainnyaStartRow = -1;
  const lainnyaKeywords = [
    "es kacang merah", "ice cream cup", "ice cream lilin",
    "kerupuk putih_bogasari", "jamur tiram putih", "devisi lainnya", "divisi lainnya", "lain-lain", "lainnya"
  ];
  for (let r = scanAfter; r < lastRow; r++) {
    const val = String(names[r][0] || "").trim().toLowerCase();
    if (lainnyaKeywords.some(function(k) { return val === k || val.includes(k); })) {
      lainnyaStartRow = r + 1;
      break;
    }
  }

  // Penyesuaian fallback jika marker belum ada
  if (pastryStartRow === -1 && lainnyaStartRow !== -1) {
    pastryStartRow = lainnyaStartRow;
  } else if (pastryStartRow === -1) {
    pastryStartRow = Math.round(barStartRow + (lastRow - barStartRow) * 0.7);
  }

  if (lainnyaStartRow === -1) {
    lainnyaStartRow = lastRow + 1;
  }

  return {
    kitchenStartRow: Math.max(5, kitchenStartRow),
    barStartRow: barStartRow,
    pastryStartRow: pastryStartRow,
    lainnyaStartRow: lainnyaStartRow,
    lastRow: lastRow
  };
}

/**
 * Sisipkan baris barang baru pada posisi alfabetis (A-Z) di dalam divisinya:
 * - Tidak pernah di atas header (Kitchen mulai baris 15 dst).
 * - Barista masuk ke Bar (A-Z).
 * - Pastry masuk ke Pastry (A-Z).
 * - Lain-Lain di bagian paling bawah dengan border tabel utuh & font 12.
 */
function insertItemAlphabetically(sheet, itemData) {
  try {
    const bounds = findCategoryBoundaries(sheet);
    const lastRow = bounds.lastRow;
    const targetDiv = (itemData.division || "KITCHEN").toUpperCase();
    const newName = toTitleCase(String(itemData.name || "").trim());

    let startRow = bounds.kitchenStartRow;
    let endRow = bounds.barStartRow - 1;

    if (targetDiv === "BAR") {
      startRow = bounds.barStartRow;
      endRow = bounds.pastryStartRow - 1;
    } else if (targetDiv === "PASTRY") {
      startRow = bounds.pastryStartRow;
      endRow = bounds.lainnyaStartRow - 1;
    } else if (targetDiv === "LAINNYA") {
      startRow = bounds.lainnyaStartRow;
      endRow = lastRow;
    }

    if (endRow < startRow) {
      endRow = startRow;
    }

    // Lewati baris banner divisi agar tidak pernah menyisipkan di atas banner
    while (startRow <= endRow && startRow <= lastRow) {
      const sName = String(sheet.getRange(startRow, 1).getValue() || "").trim().toLowerCase();
      if (sName.startsWith("devisi") || sName.startsWith("divisi") || sName === "pastry" || sName === "bar" || sName === "kitchen" || sName === "lainnya" || sName === "item") {
        startRow++;
      } else {
        break;
      }
    }

    // Cari posisi alfabetis (A-Z) di dalam rentang kategori
    let insertAtRow = endRow + 1;
    for (let r = startRow; r <= endRow && r <= lastRow; r++) {
      const existingName = String(sheet.getRange(r, 1).getValue() || "").trim();
      if (!existingName) continue;
      const lowerExist = existingName.toLowerCase();
      // Jangan pernah bandingkan atau menyisipkan di atas baris banner
      if (lowerExist.startsWith("devisi") || lowerExist.startsWith("divisi") || lowerExist === "pastry" || lowerExist === "bar" || lowerExist === "kitchen" || lowerExist === "lainnya" || lowerExist === "item") {
        continue;
      }
      if (newName.localeCompare(existingName, "id", { sensitivity: "base" }) < 0) {
        insertAtRow = r;
        break;
      }
    }

    // Sisipkan baris baru di sheet
    if (insertAtRow > lastRow) {
      sheet.insertRowAfter(lastRow);
      insertAtRow = lastRow + 1;
    } else {
      sheet.insertRowBefore(insertAtRow);
    }

    // Ambil baris tetangga untuk menduplikasi format angka dan font
    const templateRow = (insertAtRow > 1 && insertAtRow <= sheet.getLastRow()) 
      ? (insertAtRow > startRow ? insertAtRow - 1 : insertAtRow + 1)
      : Math.max(6, bounds.kitchenStartRow);

    const maxCols = Math.max(sheet.getLastColumn(), 68);
    const sourceRange = sheet.getRange(templateRow, 1, 1, maxCols);
    const targetRange = sheet.getRange(insertAtRow, 1, 1, maxCols);

    // Salin format dasar dari baris tetangga
    sourceRange.copyTo(targetRange, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);

    // Terapkan border solid HITAM standar tabel (atas, kiri, bawah, kanan, vertikal, horizontal)
    // agar baris baru tidak kopong / blank tanpa garis border
    targetRange.setBorder(true, true, true, true, true, true, "#000000", SpreadsheetApp.BorderStyle.SOLID);
    targetRange.setFontSize(12);
    targetRange.setFontFamily("Arial");
    targetRange.setBackground("#ffffff"); // Latar putih bersih (tidak ikut banner kuning)

    // Isi data kolom A s/d C (Nama, Stok Awal, Satuan) - RATA KIRI
    sheet.getRange(insertAtRow, 1).setValue(newName).setFontSize(12).setHorizontalAlignment("left");
    sheet.getRange(insertAtRow, 2).setValue(itemData.stock || 0).setFontSize(12).setHorizontalAlignment("left");
    sheet.getRange(insertAtRow, 3).setValue((itemData.unit || "PCS").toUpperCase()).setFontSize(12).setHorizontalAlignment("left");

    // Kolom 4 (HARGA): HARUS Font 11, format "Rp" #,##0, dan RATA KIRI!
    const tmplPriceFmt = sheet.getRange(templateRow, 4).getNumberFormat() || '"Rp"#,##0';
    const finalPriceFmt = (tmplPriceFmt && tmplPriceFmt.includes("Rp")) ? tmplPriceFmt : '"Rp"#,##0';
    sheet.getRange(insertAtRow, 4)
      .setValue(itemData.price || 0)
      .setFontSize(11)
      .setFontFamily("Arial")
      .setNumberFormat(finalPriceFmt)
      .setHorizontalAlignment("left"); // Rata Kiri

    // Bersihkan nilai mutasi tanggal (Kolom 5 s/d 66) dan kunci border solid hitam
    if (maxCols >= 5) {
      const clearCols = Math.min(62, maxCols - 4);
      const cellsMutasi = sheet.getRange(insertAtRow, 5, 1, clearCols);
      cellsMutasi.clearContent();
      cellsMutasi.setBorder(true, true, true, true, true, true, "#000000", SpreadsheetApp.BorderStyle.SOLID);
    }

    // Kolom 67 s/d maxCols (Kolom Summary & Kolom RP/COST):
    // Salin rumus dari templateRow dan set Kolom RP/COST ke Font 11 + format "Rp" + RATA KIRI
    if (maxCols >= 67) {
      for (let c = 67; c <= maxCols; c++) {
        const cellFormula = sheet.getRange(templateRow, c).getFormulaR1C1();
        const targetCell = sheet.getRange(insertAtRow, c);
        if (cellFormula) {
          targetCell.setFormulaR1C1(cellFormula);
        }
        const headerText = String(sheet.getRange(4, c).getValue() || "").toLowerCase();
        const tmplFmt = sheet.getRange(templateRow, c).getNumberFormat();
        if ((tmplFmt && tmplFmt.includes("Rp")) || headerText.includes("cost") || headerText.includes("rp") || c === 70) {
          targetCell
            .setFontSize(11)
            .setFontFamily("Arial")
            .setNumberFormat('"Rp"#,##0')
            .setHorizontalAlignment("left"); // Rata Kiri
        }
      }
    }

    console.log(`Berhasil menyisipkan "${newName}" (${targetDiv}) di baris ${insertAtRow} dengan font 11 untuk harga & RP/COST serta table border!`);
    return insertAtRow;
  } catch (err) {
    console.warn("Gagal menyisipkan baris alfabetis: " + err.toString());
    return -1;
  }
}

/**
 * Hapus baris barang dari sheet bulanan (Fitur Super Admin)
 */
function deleteItemFromSheet(sheet, itemName) {
  try {
    const lastRow = sheet.getLastRow();
    if (lastRow < 5) return -1;

    const names = sheet.getRange(1, 1, lastRow, 1).getValues();
    const cleanTarget = toTitleCase(String(itemName || "").trim()).toLowerCase();

    for (let r = 4; r < lastRow; r++) {
      const rowName = String(names[r][0] || "").trim().toLowerCase();
      if (rowName === cleanTarget) {
        const rowToDelete = r + 1;
        sheet.deleteRow(rowToDelete);
        console.log(`Berhasil menghapus baris ${rowToDelete}: "${itemName}"`);
        return rowToDelete;
      }
    }
    return -1;
  } catch (err) {
    console.warn("Gagal menghapus baris dari sheet: " + err.toString());
    return -1;
  }
}

/**
 * ============================================================================
 * HANDLER DATA PENGGUNA (TAB 'DATA_PENGGUNA')
 * Catatan Keamanan: Akun 'satian' TIDAK BOLEH dikembalikan, ditulis, atau
 * dimodifikasi dari/ke Google Sheets. Satian dikelola mandiri secara rahasia.
 * ============================================================================
 */

/**
 * Membaca seluruh data pengguna dari sheet DATA_PENGGUNA
 */
function handleReadUsers(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateUsersSheet(ss);
    const lastRow = sheet.getLastRow();
    const users = [];

    if (lastRow >= 2) {
      const values = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
      for (let i = 0; i < values.length; i++) {
        const row = values[i];
        const username = String(row[0] || "").trim().toLowerCase();
        if (!username || username === "satian") continue; // Abaikan baris kosong atau satian

        const name = String(row[1] || username).trim();
        const pin = String(row[2] || "1234").trim();
        const divisionsRaw = String(row[3] || "KITCHEN").trim();
        const divisions = divisionsRaw.split(",").map(d => d.trim().toUpperCase()).filter(Boolean);
        const role = username === "admin" ? "superadmin" : String(row[4] || "staff").trim().toLowerCase();
        const avatar = String(row[5] || (role === "superadmin" || role === "admin" ? "👨‍💼" : "🍳")).trim();
        const createdAt = row[6] ? Utilities.formatDate(new Date(row[6]), "Asia/Jakarta", "yyyy-MM-dd") : "2026-01-01";

        users.push({
          username: username,
          name: name,
          pin: pin,
          division: divisions[0] || "KITCHEN",
          divisions: divisions.length > 0 ? divisions : ["KITCHEN"],
          role: role,
          avatar: avatar,
          createdAt: createdAt
        });
      }
    }

    return createJsonResponse({
      success: true,
      count: users.length,
      users: users
    });
  } catch (err) {
    return createJsonResponse({
      success: false,
      message: "Gagal membaca data pengguna: " + err.toString()
    }, 500);
  }
}

/**
 * Menyimpan / memperbarui data pengguna ke sheet DATA_PENGGUNA
 */
function handleSaveUser(payload, ss) {
  try {
    const username = String(payload.username || "").trim().toLowerCase();
    if (!username || username === "satian") {
      return createJsonResponse({ success: false, message: "Username tidak valid atau dilindungi sistem." }, 400);
    }

    const sheet = getOrCreateUsersSheet(ss);
    const lastRow = sheet.getLastRow();
    const name = String(payload.name || username).trim();
    const pin = String(payload.pin || "1234").trim();
    let divisions = [];
    if (Array.isArray(payload.divisions)) {
      divisions = payload.divisions.map(d => String(d).trim().toUpperCase());
    } else if (payload.division) {
      divisions = String(payload.division).split(",").map(d => d.trim().toUpperCase());
    }
    if (divisions.length === 0) divisions = ["KITCHEN"];
    const divisionsStr = divisions.join(", ");
    const role = (payload.role || "staff").toLowerCase();
    const avatar = String(payload.avatar || (role === "admin" ? "👨‍💼" : "🍳")).trim();
    const createdAt = payload.createdAt || Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd");

    let foundRow = -1;
    if (lastRow >= 2) {
      const usernames = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let r = 0; r < usernames.length; r++) {
        if (String(usernames[r][0] || "").trim().toLowerCase() === username) {
          foundRow = r + 2;
          break;
        }
      }
    }

    if (foundRow > 0) {
      sheet.getRange(foundRow, 1, 1, 7).setValues([[
        username, name, "'" + pin, divisionsStr, role, avatar, createdAt
      ]]);
    } else {
      sheet.appendRow([
        username, name, "'" + pin, divisionsStr, role, avatar, createdAt
      ]);
      const newRow = sheet.getLastRow();
      sheet.getRange(newRow, 1, 1, 7)
        .setFontSize(11)
        .setFontFamily("Arial")
        .setHorizontalAlignment("left")
        .setBorder(true, true, true, true, true, true, "#cbd5e1", SpreadsheetApp.BorderStyle.SOLID);
    }

    return createJsonResponse({
      success: true,
      message: `Data pengguna "${name}" (${username}) berhasil disimpan ke spreadsheet.`
    });
  } catch (err) {
    return createJsonResponse({
      success: false,
      message: "Gagal menyimpan data pengguna ke sheet: " + err.toString()
    }, 500);
  }
}

/**
 * Menghapus pengguna dari sheet DATA_PENGGUNA
 */
function handleDeleteUserFromSheet(payload, ss) {
  try {
    const username = String(payload.username || "").trim().toLowerCase();
    if (!username || username === "satian") {
      return createJsonResponse({ success: false, message: "Aksi ditolak." }, 400);
    }

    const sheet = getOrCreateUsersSheet(ss);
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const usernames = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let r = 0; r < usernames.length; r++) {
        if (String(usernames[r][0] || "").trim().toLowerCase() === username) {
          sheet.deleteRow(r + 2);
          return createJsonResponse({
            success: true,
            message: `Pengguna "${username}" berhasil dihapus dari sheet.`
          });
        }
      }
    }

    return createJsonResponse({
      success: false,
      message: `Pengguna "${username}" tidak ditemukan di sheet.`
    }, 404);
  } catch (err) {
    return createJsonResponse({
      success: false,
      message: "Gagal menghapus pengguna dari sheet: " + err.toString()
    }, 500);
  }
}

/**
 * Memperbarui PIN pengguna di sheet DATA_PENGGUNA
 */
function handleUpdateUserPinInSheet(payload, ss) {
  try {
    const username = String(payload.username || "").trim().toLowerCase();
    const newPin = String(payload.pin || "").trim();
    if (!username || !newPin || username === "satian") {
      return createJsonResponse({ success: false, message: "Username atau PIN tidak valid." }, 400);
    }

    const sheet = getOrCreateUsersSheet(ss);
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const usernames = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let r = 0; r < usernames.length; r++) {
        if (String(usernames[r][0] || "").trim().toLowerCase() === username) {
          sheet.getRange(r + 2, 3).setValue("'" + newPin);
          return createJsonResponse({
            success: true,
            message: `PIN pengguna "${username}" berhasil diupdate di sheet.`
          });
        }
      }
    }

    return createJsonResponse({
      success: false,
      message: `Pengguna "${username}" tidak ditemukan di sheet.`
    }, 404);
  } catch (err) {
    return createJsonResponse({
      success: false,
      message: "Gagal mengupdate PIN pengguna di sheet: " + err.toString()
    }, 500);
  }
}


// ═════════════════════ BAGIAN 3: ASISTEN AI "TANYA STOK" ═════════════════════
// Semua fungsi berawalan _ai agar tidak bentrok dengan kode v3.2.
//
// Konfigurasi lewat Script Properties (Project Settings > Script Properties):
//   AI_PROVIDER     = gemini | openai   (default: gemini)
//   AI_KEY          = API key (WAJIB)
//   AI_MODEL        = nama model        (default: gemini-3.5-flash-lite / gpt-4o-mini)
//   AI_BASE_URL     = opsional, untuk provider openai-compatible (mis. https://api-plan.vikey.ai/v1)
//   AI_DAILY_LIMIT  = batas pertanyaan per karyawan per hari (default: 30)
//
// Prinsip: ANGKA DIHITUNG DI SINI, model hanya merangkai kalimat.

const AI_HISTORY_MAX_TURNS = 2;   // giliran riwayat yang ikut dikirim
const AI_CACHE_SECONDS = 600;     // jawaban sama dalam 10 menit tidak memanggil model
const AI_MAX_QUESTION = 300;

function _aiProp_(name, fallback) {
  try {
    const v = PropertiesService.getScriptProperties().getProperty(name);
    return v && String(v).trim() ? String(v).trim() : fallback;
  } catch (err) {
    return fallback;
  }
}

function _aiJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function _aiError_(code, message) {
  return _aiJson_({ success: false, code: code, message: message });
}

// ── Pintu masuk ────────────────────────────────────────────────────
function handleAskAI_(e, user, payload) {
  const params = (e && e.parameter) || {};
  const src = payload || {};
  const question = String(src.q || params.q || "").trim().slice(0, AI_MAX_QUESTION);
  if (!question) return _aiError_("EMPTY", "Pertanyaan kosong.");

  const username = (user && user.username) || "unknown";

  // Batas harian per karyawan
  const limit = parseInt(_aiProp_("AI_DAILY_LIMIT", "30"), 10) || 30;
  const today = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyyMMdd");
  const quotaKey = "ai_q_" + today + "_" + username;
  let used = 0;
  try {
    used = parseInt(PropertiesService.getScriptProperties().getProperty(quotaKey) || "0", 10) || 0;
  } catch (err) { used = 0; }
  if (used >= limit) {
    return _aiError_("QUOTA", "Batas " + limit + " pertanyaan per hari sudah tercapai. Coba lagi besok.");
  }

  // Cache: pertanyaan identik dalam 10 menit
  let cache = null;
  let cacheKey = "";
  try {
    cache = CacheService.getScriptCache();
    cacheKey = "ai_" + _aiHash_(username + "|" + question.toLowerCase() + "|" + today);
    const hit = cache.get(cacheKey);
    if (hit) {
      const parsed = JSON.parse(hit);
      parsed.cached = true;
      return _aiJson_(parsed);
    }
  } catch (err) { cache = null; }

  let out;
  try {
    const facts = _aiFacts_(question, src.topic);
    const prompt = _aiPrompt_(facts, question, src.history, src.topic);
    const answer = _aiCall_(prompt);
    out = {
      success: true,
      answer: answer,
      topic: facts.topic,
      meta: {
        sheet: facts.sheetName,
        day: facts.dayElapsed,
        items: facts.matchedItems,
        mode: facts.mode,
        used: used + 1,
        limit: limit
      }
    };
  } catch (err) {
    // Detail hanya ke log, jangan bocor ke klien
    console.error("[askAI] " + (err && err.stack ? err.stack : err));
    return _aiError_("FAILED", "Asisten sedang tidak bisa menjawab. Coba lagi sebentar lagi.");
  }

  try {
    if (cache && cacheKey) cache.put(cacheKey, JSON.stringify(out), AI_CACHE_SECONDS);
    PropertiesService.getScriptProperties().setProperty(quotaKey, String(used + 1));
  } catch (err) { /* kuota gagal dicatat: jangan gagalkan jawaban */ }

  return _aiJson_(out);
}

function _aiHash_(s) {
  // Simple deterministic hash (FNV-1a 32-bit) untuk kunci cache
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h.toString(36);
}

// ── Data mentah: pakai ulang pembaca sheet milik aplikasi ───────────
function _aiSheetData_() {
  const res = handleReadMonthlySheetData({ parameter: {} });
  const obj = JSON.parse(res.getContent());
  if (!obj || !obj.success) {
    throw new Error((obj && obj.message) || "Data spreadsheet tidak terbaca");
  }
  return obj;
}

// ── Penyusun fakta ─────────────────────────────────────────────────
const AI_STOPWORDS = {
  yang: 1, apa: 1, apakah: 1, berapa: 1, kapan: 1, kenapa: 1, mengapa: 1, bagaimana: 1,
  untuk: 1, dari: 1, dengan: 1, bulan: 1, ini: 1, itu: 1, ada: 1, tidak: 1, dan: 1,
  atau: 1, bisa: 1, kok: 1, jadi: 1, saja: 1, masih: 1, sudah: 1, akan: 1, kita: 1,
  stok: 1, stock: 1, sisa: 1, jumlah: 1, total: 1, sekarang: 1, hari: 1, per: 1
};

function _aiTokens_(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(function (t) { return t.length >= 3 && !AI_STOPWORDS[t]; });
}

function _aiFindItems_(data, question) {
  const toks = _aiTokens_(question);
  if (!toks.length) return [];

  const scored = [];
  for (let i = 0; i < data.items.length; i++) {
    const it = data.items[i];
    const name = String(it.name || "").toLowerCase();
    let score = 0;
    for (let t = 0; t < toks.length; t++) {
      if (name.indexOf(toks[t]) !== -1) score += toks[t].length >= 5 ? 2 : 1;
    }
    if (score > 0) scored.push({ item: it, score: score });
  }
  scored.sort(function (a, b) {
    if (b.score !== a.score) return b.score - a.score;
    return Math.abs(a.item.stock) - Math.abs(b.item.stock);
  });
  return scored.slice(0, 3).map(function (s) { return s.item; });
}

function _aiNum_(n) {
  const v = Math.round(Number(n || 0) * 1000) / 1000;
  return String(v).replace(".", ",");
}

function _aiRupiah_(n) {
  return "Rp" + String(Math.round(Number(n || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Diagnosa deterministik per barang
function _aiDiagnose_(item, dayElapsed) {
  const hist = item.dailyHistory || {};
  const days = Object.keys(hist).map(Number).sort(function (a, b) { return a - b; });

  let running = Number(item.stokAwal || 0);
  let firstNegative = null;
  const negativeTrail = [];
  const buyDays = [];
  const outValues = [];
  let outAfterLastBuy = 0;
  let lastBuyDay = null;

  for (let d = 1; d <= (dayElapsed || 31); d++) {
    const cell = hist[d];
    if (!cell) continue;
    const vin = Number(cell.in || 0);
    const vout = Number(cell.out || 0);
    if (vin > 0) { buyDays.push(d + "(" + _aiNum_(vin) + ")"); lastBuyDay = d; }
    if (vout > 0) outValues.push(vout);
    running = running + vin - vout;
    if (running < 0) {
      if (firstNegative === null) firstNegative = d;
      negativeTrail.push("tgl" + d + "=" + _aiNum_(running));
    }
  }
  if (lastBuyDay !== null) {
    for (let k = 0; k < days.length; k++) {
      if (days[k] > lastBuyDay) outAfterLastBuy += Number((hist[days[k]] || {}).out || 0);
    }
  }

  // Deteksi qty OUT yang jauh di atas kebiasaan (indikasi salah input)
  let outlier = "";
  if (outValues.length >= 3) {
    const sorted = outValues.slice().sort(function (a, b) { return a - b; });
    const median = sorted[Math.floor(sorted.length / 2)];
    const thr = median * 3;
    const sus = [];
    for (let d = 1; d <= (dayElapsed || 31); d++) {
      const cell = hist[d];
      if (cell && Number(cell.out || 0) > thr) sus.push("tgl" + d + " qty " + _aiNum_(cell.out));
    }
    if (sus.length) outlier = sus.join(", ") + " (rata-rata normal sekitar " + _aiNum_(median) + ")";
  }

  const avgOut = dayElapsed > 0 ? Number(item.outQtyMonth || 0) / dayElapsed : 0;
  const lines = [];
  lines.push("Stok awal: " + _aiNum_(item.stokAwal) + " " + item.unit);
  lines.push("Total IN bulan: " + _aiNum_(item.inQtyMonth) + " | Total OUT bulan: " + _aiNum_(item.outQtyMonth));
  lines.push("Stok akhir: " + _aiNum_(item.stock) + " " + item.unit);
  lines.push("Rata-rata OUT: " + _aiNum_(avgOut) + " " + item.unit + "/hari (sampai tanggal " + (dayElapsed || "-") + ")");
  lines.push("Tanggal ada pembelian (IN): " + (buyDays.length ? buyDays.join(", ") : "TIDAK ADA pembelian bulan ini"));
  if (firstNegative !== null) lines.push("Mulai minus pada: tanggal " + firstNegative + " (" + negativeTrail[0] + ")");
  if (lastBuyDay !== null) lines.push("OUT setelah pembelian terakhir (tgl " + lastBuyDay + "): " + _aiNum_(outAfterLastBuy) + " " + item.unit);
  if (outlier) lines.push("Qty OUT tidak wajar: " + outlier);
  if (item.stock < 0) lines.push("Status: MINUS " + _aiNum_(item.stock) + " " + item.unit + " (perlu koreksi/opname)");

  return { text: lines.join("\n"), firstNegative: firstNegative, buyDays: buyDays, avgOut: avgOut };
}

function _aiFacts_(question, hintTopic) {
  const data = _aiSheetData_();
  const dayElapsed = data.dayToDate || new Date().getDate();

  // Pertanyaan lanjutan sering tidak menyebut nama barang ("kapan mulai minus?").
  // Urutan: cari dari pertanyaan dulu; kalau kosong, pakai topik yang sedang dibahas.
  let matched = _aiFindItems_(data, question);
  if (!matched.length && hintTopic) matched = _aiFindItems_(data, String(hintTopic));

  const out = {
    sheetName: data.sheetName,
    dayElapsed: dayElapsed,
    mode: matched.length ? "item" : "ringkasan",
    topic: matched.length ? matched[0].name : "Ringkasan stok",
    matchedItems: matched.length,
    text: ""
  };

  if (matched.length) {
    const blocks = [];
    for (let i = 0; i < matched.length; i++) {
      const it = matched[i];
      const dg = _aiDiagnose_(it, dayElapsed);
      blocks.push(
        "BARANG: " + it.name + " | divisi " + it.division + " | satuan " + it.unit +
        " | harga " + _aiRupiah_(it.price) +
        "\n" + dg.text
      );
    }
    // Nama mirip: sering jadi sumber salah input
    const first = matched[0];
    const base = String(first.name).toLowerCase().split(" ")[0];
    const similar = data.items
      .filter(function (x) { return x.name !== first.name && String(x.name).toLowerCase().indexOf(base) !== -1; })
      .slice(0, 5)
      .map(function (x) { return x.name + " (" + _aiNum_(x.stock) + " " + x.unit + ")"; });
    if (similar.length) blocks.push("NAMA MIRIP di sheet (cek salah baris): " + similar.join(", "));

    out.text = blocks.join("\n\n");
  } else {
    const stats = data.stats || {};
    const negative = data.items.filter(function (x) { return Number(x.stock) < 0; });
    const low = data.items.slice().sort(function (a, b) { return Number(a.stock) - Number(b.stock); }).slice(0, 5);

    const perDiv = {};
    for (let i = 0; i < data.items.length; i++) {
      const it = data.items[i];
      const d = it.division || "LAINNYA";
      if (!perDiv[d]) perDiv[d] = { count: 0, nilai: 0, minus: 0 };
      perDiv[d].count++;
      perDiv[d].nilai += Number(it.stock) * Number(it.price);
      if (Number(it.stock) < 0) perDiv[d].minus++;
    }

    const lines = [];
    lines.push("Sheet: " + data.sheetName + " | data sampai tanggal " + dayElapsed);
    lines.push("Jumlah barang: " + (stats.totalItems || data.items.length));
    lines.push("Nilai stok (aset): " + _aiRupiah_(stats.totalNilaiStokAset));
    lines.push("Nilai masuk bulan ini: " + _aiRupiah_(stats.totalRupiahMasuk) + " | nilai keluar: " + _aiRupiah_(stats.totalRupiahKeluar));
    lines.push("Barang stok MINUS: " + negative.length +
      (negative.length ? " (" + negative.slice(0, 5).map(function (x) { return x.name + " " + _aiNum_(x.stock); }).join(", ") + ")" : ""));
    lines.push("5 stok terendah: " + low.map(function (x) { return x.name + " " + _aiNum_(x.stock) + " " + x.unit; }).join(", "));
    for (const k in perDiv) {
      lines.push("Divisi " + k + ": " + perDiv[k].count + " barang, nilai " + _aiRupiah_(perDiv[k].nilai) + ", minus " + perDiv[k].minus);
    }
    out.text = lines.join("\n");
  }

  return out;
}

// ── Prompt ─────────────────────────────────────────────────────────
function _aiPrompt_(facts, question, history, lastTopic) {
  const sys =
    "Kamu asisten stok restoran Rimba Alam. Jawab dalam bahasa Indonesia, maksimal 4 kalimat, langsung ke inti.\n" +
    "ATURAN KETAT:\n" +
    "1. Gunakan HANYA angka yang ada di FAKTA. Dilarang mengarang angka atau tanggal.\n" +
    "2. Kalau FAKTA tidak memuat jawabannya, katakan terus terang bahwa datanya belum ada di sheet.\n" +
    "3. Untuk sebab-akibat, sebutkan angkanya lalu bilang 'kemungkinan' — jangan menyimpulkan mutlak.\n" +
    "4. Jangan menyebut nama sheet, nama kolom, atau istilah teknis.\n" +
    "5. Jangan menulis notasi mentah seperti 'tgl2=-2'; sebut tanggal dan angkanya dalam kalimat biasa.";

  let histBlock = "";
  if (Array.isArray(history) && history.length) {
    const turns = history.slice(-AI_HISTORY_MAX_TURNS * 2);
    const lines = [];
    for (let i = 0; i < turns.length; i++) {
      const t = turns[i] || {};
      const role = t.role === "model" || t.role === "assistant" ? "Asisten" : "Karyawan";
      const txt = String(t.text || t.content || "").slice(0, 400);
      if (txt) lines.push(role + ": " + txt);
    }
    if (lines.length) histBlock = "\n\nRIWAYAT (hanya untuk konteks, jangan diulang):\n" + lines.join("\n");
  }

  const topicBlock = lastTopic ? "\nTopik yang sedang dibahas: " + String(lastTopic).slice(0, 80) : "";

  return sys + topicBlock + histBlock + "\n\nFAKTA:\n" + facts.text + "\n\nPERTANYAAN: " + question;
}

// ── Panggilan ke provider ──────────────────────────────────────────
function _aiCall_(prompt) {
  const provider = String(_aiProp_("AI_PROVIDER", "gemini")).toLowerCase();
  const key = _aiProp_("AI_KEY", "");
  if (!key) throw new Error("AI_KEY belum diisi di Script Properties");

  if (provider === "gemini") {
    const model = _aiProp_("AI_MODEL", "gemini-3.5-flash-lite");
    const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent";
    const res = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      headers: { "x-goog-api-key": key },
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 400 }
      }),
      muteHttpExceptions: true
    });
    const code = res.getResponseCode();
    const body = res.getContentText();
    if (code !== 200) throw new Error("Gemini HTTP " + code + ": " + body.slice(0, 200));
    const j = JSON.parse(body);
    const cand = (j.candidates && j.candidates[0]) || null;
    const parts = cand && cand.content && cand.content.parts;
    const text = parts && parts.length ? parts.map(function (p) { return p.text || ""; }).join("") : "";
    if (!text) throw new Error("Gemini mengembalikan jawaban kosong");
    return text.trim();
  }

  // Provider OpenAI-compatible (OpenAI, vikey, 9router, dll)
  const base = String(_aiProp_("AI_BASE_URL", "https://api.openai.com/v1")).replace(/\/+$/, "");
  const model = _aiProp_("AI_MODEL", "gpt-4o-mini");
  const res = UrlFetchApp.fetch(base + "/chat/completions", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + key },
    payload: JSON.stringify({
      model: model,
      temperature: 0.2,
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }]
    }),
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  const body = res.getContentText();
  if (code !== 200) throw new Error("AI HTTP " + code + ": " + body.slice(0, 200));
  const j = JSON.parse(body);
  const msg = j.choices && j.choices[0] && j.choices[0].message;
  const text = msg && msg.content ? String(msg.content) : "";
  if (!text) throw new Error("Provider mengembalikan jawaban kosong");
  return text.trim();
}
