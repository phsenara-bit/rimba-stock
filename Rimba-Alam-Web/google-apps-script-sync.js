/**
 * ============================================================================
 * GOOGLE APPS SCRIPT (GAS) - RIMBA ALAM STOCK API (v3.0 - SMART MONTHLY ENGINE)
 * ============================================================================
 * Fitur:
 * 1. DUKUNGAN ANGKA DESIMAL: Bisa input 2.5, 8.2, 0.5 (koma maupun titik).
 * 2. DUAL-SYNC: Catat riwayat di 'MUTASI_APP' dan isi sel tanggal riil di tab bulanan.
 * 3. OTOMATIS BIKIN SHEET BULAN BARU (Desember dst):
 *    - Membaca kalender riil (jumlah hari 28, 29, 30, atau 31 hari).
 *    - Otomatis menyalin 'SISA STOK AKHIR' bulan lalu ke Kolom B ('S, AKHIR')
 *      sebagai STOK AWAL bulan baru secara otomatis!
 * 4. LockService Concurrency Guard: Anti-bentrok saat banyak staf input barengan.
 * ============================================================================
 */

const SHEET_LOG_NAME = "MUTASI_APP";

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

    const txnId = payload.id || ("TXN-" + new Date().getTime());
    const timestamp = payload.timestamp || Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
    const division = payload.division || "-";
    const staffName = payload.staffName || "-";
    const itemId = payload.itemId || "-";
    const itemName = payload.itemName || "-";
    const unit = payload.unit || "-";
    const type = payload.type || "OUT";
    
    // Parse angka desimal (bisa koma '8,2' atau titik '8.2')
    const rawQtyStr = String(payload.qty || "0").replace(/,/g, ".");
    const qty = parseFloat(rawQtyStr) || 0;
    
    const notes = payload.notes || "";
    const price = Number(payload.price) || 0;
    const totalRp = Math.round(qty * price);

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

    // ── 2. UPDATE LANGSUNG SEL DI TAB BULANAN ──
    const isEdit = payload.action === "editMutation";
    const oldQty = parseFloat(String(payload.oldQty || "0").replace(/,/g, ".")) || 0;

    updateMonthlyMatrixCell(ss, {
      date: payload.date || timestamp.split(" ")[0],
      itemName: itemName,
      type: type,
      qty: qty,
      isEdit: isEdit,
      oldQty: oldQty
    });

    return createJsonResponse({
      success: true,
      txnId: txnId,
      message: isEdit
        ? `Koreksi ${itemName} (${type} dari ${oldQty} ke ${qty} ${unit}) berhasil dicatat!`
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
  return createJsonResponse({
    status: "online",
    message: "Rimba Alam Stock Web App is ready to receive transactions."
  });
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Update nilai sel di tab bulanan pada kolom tanggal transaksi.
 * Jika sheet bulan baru (misal 'Des 2026') belum ada, otomatis dibuatkan!
 */
function updateMonthlyMatrixCell(ss, data) {
  try {
    const parts = data.date.split("-");
    const year = parseInt(parts[0], 10);
    const monthNum = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    if (isNaN(day) || day < 1 || day > 31) return;

    // Ambil sheet bulan ini, atau otomatis generate jika belum ada
    const targetSheet = getOrCreateMonthlySheet(ss, year, monthNum);
    if (!targetSheet) {
      console.warn("Sheet bulanan tidak ditemukan/gagal dibuat untuk: " + data.date);
      return;
    }

    // Cari baris barang berdasarkan nama (Kolom A, mulai baris 4)
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
        if (rowItemName.includes(cleanSearchName) || cleanSearchName.includes(rowItemName)) {
          rowIndex = r + 4;
          break;
        }
      }
    }

    if (rowIndex === -1) {
      console.warn("Barang tidak terdaftar di sheet: " + data.itemName);
      return;
    }

    // Hitung Kolom Tanggal (1-based index):
    // Header sheet: Kolom A=1, B=2, C=3, D=4
    // Tanggal 1: IN = Col 5 (E), OUT = Col 6 (F)
    // Tanggal d: IN = 2*d + 3,  OUT = 2*d + 4
    const isOut = (data.type === "OUT");
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

    cell.setValue(newVal);
  } catch (e) {
    console.warn("Error updateMonthlyMatrixCell: " + e.toString());
  }
}

/**
 * Mencari tab bulanan. Jika bulan berganti (misal Desember tiba) dan sheet belum ada,
 * fungsi ini OTOMATIS MEMBUAT SHEET BARU dan menyalin SISA STOK AKHIR bulan lalu
 * menjadi STOK AWAL (Kolom B) bulan baru!
 */
function getOrCreateMonthlySheet(ss, year, monthNum) {
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "June",
    "July", "August", "Sep", "Okt", "Nov", "Des"
  ];
  const targetPrefix = monthNames[monthNum - 1].toLowerCase();
  const targetSheetName = `${monthNames[monthNum - 1]} ${year}`;

  const sheets = ss.getSheets();
  for (let s of sheets) {
    const sName = s.getName().toLowerCase();
    if (sName.includes(targetPrefix) && sName.includes(String(year))) {
      return s;
    }
  }

  // Jika belum ada sheet untuk bulan baru (misal Desember 2026), OTOMATIS BUATKAN!
  try {
    console.log(`Membuat sheet otomatis untuk bulan baru: ${targetSheetName}`);
    
    // Cari sheet bulan sebelumnya sebagai template data
    let prevSheet = null;
    let prevMonthIdx = monthNum - 2;
    let prevYear = year;
    if (prevMonthIdx < 0) {
      prevMonthIdx = 11;
      prevYear = year - 1;
    }
    const prevPrefix = monthNames[prevMonthIdx].toLowerCase();

    for (let s of sheets) {
      const sName = s.getName().toLowerCase();
      if (sName.includes(prevPrefix)) {
        prevSheet = s;
        break;
      }
    }

    if (!prevSheet) {
      // Fallback ke sheet bulan apapun yang ada
      for (let s of sheets) {
        if (s.getName() !== SHEET_LOG_NAME) {
          prevSheet = s;
          break;
        }
      }
    }

    if (!prevSheet) return null;

    // Hitung jumlah hari riil dalam bulan ini (28, 29, 30, atau 31)
    const daysInMonth = new Date(year, monthNum, 0).getDate();

    // Duplikasi struktur sheet bulan lalu
    const newSheet = prevSheet.copyTo(ss);
    newSheet.setName(targetSheetName);

    // Update Judul di baris 1
    newSheet.getRange("A1").setValue(`DAILY STOK IN-OUT RIMBA ALAM PERIODE : ${monthNames[monthNum - 1]} ${year}`);

    // Update Header Kolom B: S, AKHIR (BulanSebelumnya)
    newSheet.getRange("B2").setValue(`S, AKHIR\n(${monthNames[prevMonthIdx]})`);

    // Update Header Tanggal di Baris 2 (misal: 1-Des, 2-Des, ..., 31-Des)
    const currentMonthLabel = monthNames[monthNum - 1]; // "Des"
    for (let d = 1; d <= 31; d++) {
      const colIn = 2 * d + 3; // Kolom IN untuk tanggal d
      if (d <= daysInMonth) {
        newSheet.getRange(2, colIn).setValue(`${d}-${currentMonthLabel}`);
      } else {
        // Jika bulan ini tidak sampai tgl 31 (misal 30 hari atau 28 hari)
        newSheet.getRange(2, colIn).setValue("");
      }
    }

    const lastRow = prevSheet.getLastRow();
    if (lastRow >= 4) {
      // AMBIL SISA STOK AKHIR DARI BULAN LALU (Kolom 69 di sheet 31 hari)
      // Kolom 69 adalah hasil formula Sisa Stok Akhir bulan lalu
      const prevEndStockValues = prevSheet.getRange(4, 69, lastRow - 3, 1).getValues();

      // Salin ke Kolom B (Stok Awal) sheet bulan baru
      newSheet.getRange(4, 2, lastRow - 3, 1).setValues(prevEndStockValues);

      // Bersihkan seluruh sel transaksi harian tanggal 1 s/d 31 di sheet baru
      // Kolom 5 s/d 66 (IN dan OUT)
      newSheet.getRange(4, 5, lastRow - 3, 62).clearContent();
    }

    return newSheet;
  } catch (err) {
    console.warn("Gagal membuat sheet otomatis: " + err.toString());
    return null;
  }
}
