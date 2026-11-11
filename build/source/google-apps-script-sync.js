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

    // Akun awal untuk sheet BARU. PIN dibuat acak per akun — bukan 1234 —
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
    });
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

function doPost(e) {
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
          insertItemAlphabetically(s, {
            name: itemName,
            division: division,
            unit: unit,
            price: price,
            stock: stock
          });
          console.log(`Menyinkronkan item baru "${itemName}" ke tab yang sudah ada: ${sName}`);
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

function doGet(e) {
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
function getOrCreateMonthlySheet(ss, year, monthNum) {
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "June",
    "July", "August", "Sep", "Okt", "Nov", "Des"
  ];
  const fullMonthNames = [
    "januari", "februari", "maret", "april", "mei", "juni",
    "juli", "agustus", "september", "oktober", "november", "desember"
  ];
  const targetPrefix = monthNames[monthNum - 1].toLowerCase();
  const fullPrefix = fullMonthNames[monthNum - 1];

  const sheets = ss.getSheets();
  
  // 1. Cek tab yang namanya mengandung bulan ini (misal "Nov", "November", "Des 2026")
  for (let s of sheets) {
    const sName = s.getName().toLowerCase();
    if (s.getName() === SHEET_LOG_NAME || s.getName() === SHEET_SPOIL_NAME) continue;
    if (sName.includes(targetPrefix) || sName.includes(fullPrefix)) {
      return s;
    }
  }

  // 2. AUTO-ROLLOVER BULAN BARU OTOMATIS:
  // Jika tab bulan baru belum ada, sistem mengkloning tab BULAN SEBELUMNYA yang kronologis!
  let prevMonthNum = monthNum - 1;
  let prevYear = year;
  if (prevMonthNum < 1) {
    prevMonthNum = 12;
    prevYear = year - 1;
  }
  const prevPrefix = monthNames[prevMonthNum - 1].toLowerCase();
  const prevFullPrefix = fullMonthNames[prevMonthNum - 1];

  let prevSheet = null;
  // 2a. Cari tab bulan tepat sebelumnya (contoh: cari "Nov" / "November" jika sedang membuat "Des 2026")
  for (let s of sheets) {
    const sName = s.getName().toLowerCase();
    if (s.getName() === SHEET_LOG_NAME || s.getName() === SHEET_SPOIL_NAME) continue;
    if (sName.includes(prevPrefix) || sName.includes(prevFullPrefix)) {
      prevSheet = s;
      break;
    }
  }

  // 2b. Jika tidak ditemukan, cari tab bulanan terakhir (scanning dari kanan ke kiri sheet terbaru, BUKAN May!)
  if (!prevSheet) {
    for (let i = sheets.length - 1; i >= 0; i--) {
      const s = sheets[i];
      const sName = s.getName();
      if (sName !== SHEET_LOG_NAME && sName !== SHEET_SPOIL_NAME && s.getLastRow() >= 14) {
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
        // PIN kosong = akun tanpa akses. Jangan pernah diisi 1234 otomatis.
        const pin = String(row[2] === undefined || row[2] === null ? "" : row[2]).trim().replace(/^'/, "");
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
    let pin = String(payload.pin || "").trim();
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
