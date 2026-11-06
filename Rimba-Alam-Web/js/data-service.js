/**
 * ==========================================================================
 * DATA SERVICE — Rimba Alam Stock Management
 * ==========================================================================
 * Data katalog bersumber dari Google Sheets asli:
 * "DAILY STOK IN-OUT RIMBA ALAM" (Periode: Oktober 2026 - 441 Barang)
 * Dilengkapi persistensi localStorage otomatis agar mutasi stok, perubahan harga,
 * dan penambahan barang baru tidak hilang saat refresh/tutup browser.
 * ==========================================================================
 */

const DataService = (() => {
  const ITEMS_STORAGE_KEY = "rimba_alam_items_v4";
  const TXNS_STORAGE_KEY = "rimba_alam_transactions_v4";
  const GAS_URL_STORAGE_KEY = "rimba_alam_gas_url_v3";
  const PENDING_SYNC_STORAGE_KEY = "rimba_alam_pending_sync_v3";

  // Data default dari catalog-data.js (fallback jika belum dimuat)
  const _defaultItems = (typeof DEFAULT_CATALOG_ITEMS !== "undefined") ? DEFAULT_CATALOG_ITEMS : [
    { id: 1, name: "Air Kelapa", division: "KITCHEN", unit: "BUAH", price: 15000, stock: 12, minStock: 5 },
    { id: 2, name: "Ayam Kampung", division: "KITCHEN", unit: "EKOR", price: 44000, stock: 25, minStock: 10 },
    { id: 3, name: "Amidis 330Ml", division: "BAR", unit: "CARTON", price: 40700, stock: 27, minStock: 10 },
    { id: 4, name: "Beans Espresso", division: "BAR", unit: "KG", price: 250500, stock: 6, minStock: 3 }
  ];

  const _defaultTransactions = (typeof DEFAULT_SAMPLE_TRANSACTIONS !== "undefined") ? DEFAULT_SAMPLE_TRANSACTIONS : [
    { id: "TXN0001", itemId: 2, itemName: "Ayam Kampung", type: "IN", qty: 10, date: "2026-10-31", staff: "Chef Rina", notes: "Penerimaan Pasar Segar", division: "KITCHEN", unitPrice: 44000, totalRupiah: 440000 },
    { id: "TXN0002", itemId: 2, itemName: "Ayam Kampung", type: "OUT", qty: 5, date: "2026-10-31", staff: "Chef Rina", notes: "Menu Makan Siang", division: "KITCHEN", unitPrice: 44000, totalRupiah: 220000 }
  ];

  let _items = [];
  let _transactions = [];
  let _txnCounter = 1;

  // ── PERSISTENCE HELPERS ──────────────────────────────────────────────

  function _loadData() {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const rawItems = window.localStorage.getItem(ITEMS_STORAGE_KEY);
        if (rawItems) {
          _items = JSON.parse(rawItems);
        } else {
          _items = JSON.parse(JSON.stringify(_defaultItems));
          _saveItems();
        }

        const rawTxns = window.localStorage.getItem(TXNS_STORAGE_KEY);
        if (rawTxns) {
          _transactions = JSON.parse(rawTxns);
        } else {
          _transactions = JSON.parse(JSON.stringify(_defaultTransactions));
          _saveTransactions();
        }
      } else {
        _items = JSON.parse(JSON.stringify(_defaultItems));
        _transactions = JSON.parse(JSON.stringify(_defaultTransactions));
      }
    } catch (e) {
      console.warn("[DataService] Gagal memuat dari localStorage, menggunakan default:", e);
      _items = JSON.parse(JSON.stringify(_defaultItems));
      _transactions = JSON.parse(JSON.stringify(_defaultTransactions));
    }

    // Set counter transaksi
    _txnCounter = _transactions.length + 10;
  }

  function _saveItems() {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(_items));
      }
    } catch (e) {
      console.warn("[DataService] Gagal menyimpan items ke localStorage:", e);
    }
  }

  function _saveTransactions() {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(TXNS_STORAGE_KEY, JSON.stringify(_transactions));
      }
    } catch (e) {
      console.warn("[DataService] Gagal menyimpan transaksi ke localStorage:", e);
    }
  }

  // Muat data awal
  _loadData();

  function _deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function parseQuantity(val) {
    if (val === null || val === undefined) return 0;
    if (typeof val === "number") return isNaN(val) ? 0 : val;
    const clean = String(val).trim().replace(/,/g, ".");
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : Math.round(num * 1000) / 1000;
  }

  function _generateTxnId() {
    const num = String(_txnCounter++).padStart(4, "0");
    return `TXN${num}`;
  }

  // ── PUBLIC API ───────────────────────────────────────────────────────

  /**
   * Cari item berdasarkan query teks awalan (prefix matching)
   */
  function searchItems(query, divisionFilter = "ALL") {
    if (!query || query.trim().length === 0) return [];

    const q = query.trim().toLowerCase();

    // 1. Prioritas Utama: Pencocokan ketat awalan nama item
    const prefixMatches = _items.filter(item => {
      const name = item.name.toLowerCase();
      const divMatch = divisionFilter === "ALL" || item.division === divisionFilter;
      return name.startsWith(q) && divMatch;
    });

    if (prefixMatches.length > 0) {
      return prefixMatches.sort((a, b) => a.name.localeCompare(b.name));
    }

    // 2. Fallback jika tidak ada awalan nama yang cocok: cari kata kedua/ketiga di dalam nama
    const wordMatches = _items.filter(item => {
      const name = item.name.toLowerCase();
      const words = name.split(/[\s_\/-]+/);
      const divMatch = divisionFilter === "ALL" || item.division === divisionFilter;
      return words.some(w => w.startsWith(q)) && divMatch;
    });

    return wordMatches.sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Ambil semua item, opsional filter devisi */
  function getAllItems(divisionFilter = "ALL") {
    if (divisionFilter === "ALL") return _deepClone(_items);
    return _deepClone(_items.filter(it => it.division === divisionFilter));
  }

  /** Ambil satu item by ID */
  function getItemById(id) {
    const item = _items.find(it => it.id === Number(id));
    return item ? _deepClone(item) : null;
  }

  /** Ambil daftar item yang stoknya di bawah minimum atau kosong */
  function getLowStockItems() {
    return _deepClone(_items.filter(it => it.stock <= it.minStock));
  }

  /**
   * Hitung ringkasan statistik operasional dan finansial stok
   */
  function getDashboardStats() {
    const today = new Date().toISOString().split("T")[0];
    const todayTxns = _transactions.filter(t => t.date === today);
    const totalInQty = todayTxns.filter(t => t.type === "IN").reduce((s, t) => s + (t.qty || 0), 0);
    const totalOutQty = todayTxns.filter(t => t.type === "OUT").reduce((s, t) => s + (t.qty || 0), 0);
    const lowStock = _items.filter(it => it.stock <= it.minStock);

    // Hitung Finansial Lengkap (Rupiah)
    let totalNilaiStokAset = 0;
    _items.forEach(it => {
      totalNilaiStokAset += (parseQuantity(it.stock)) * (parseQuantity(it.price));
    });

    // Total Rupiah Masuk & Keluar dari seluruh transaksi
    let totalRupiahMasuk = 0;
    let totalRupiahKeluar = 0;
    _transactions.forEach(t => {
      const val = parseQuantity(t.totalRupiah) || ((parseQuantity(t.qty)) * (parseQuantity(t.unitPrice)));
      if (t.type === "IN") totalRupiahMasuk += val;
      else if (t.type === "OUT") totalRupiahKeluar += val;
    });

    // Breakdown per Devisi
    const divisionStats = {
      KITCHEN: { count: 0, nilaiStok: 0 },
      BAR: { count: 0, nilaiStok: 0 },
      PASTRY: { count: 0, nilaiStok: 0 },
      LAINNYA: { count: 0, nilaiStok: 0 }
    };

    _items.forEach(it => {
      const div = divisionStats[it.division] ? it.division : "LAINNYA";
      divisionStats[div].count++;
      divisionStats[div].nilaiStok += (parseQuantity(it.stock)) * (parseQuantity(it.price));
    });

    const monthNamesIndo = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    const now = new Date();
    const activeMonthName = `${monthNamesIndo[now.getMonth()]} ${now.getFullYear()}`;

    return {
      totalItems: _items.length,
      lowStockCount: lowStock.length,
      todayIn: totalInQty,
      todayOut: totalOutQty,
      todayTxnCount: todayTxns.length,
      totalNilaiStokAset,
      totalRupiahMasuk,
      totalRupiahKeluar,
      activeMonthName,
      divisionStats
    };
  }

  /**
   * Simpan transaksi mutasi stok. Mendukung angka desimal (koma / titik).
   */
  function saveTransaction(data) {
    const item = _items.find(it => it.id === Number(data.itemId));
    if (!item) {
      return { success: false, message: `Barang dengan ID ${data.itemId} tidak ditemukan.` };
    }

    // Validasi hak akses kategori divisi akun terhadap barang
    if (typeof AuthService !== "undefined" && typeof AuthService.canInputItemDivision === "function") {
      if (!AuthService.canInputItemDivision(item.division)) {
        return {
          success: false,
          message: `Akses ditolak: Akun Anda (${AuthService.getUserDivision()}) tidak berhak menginput kategori ${item.division}!`
        };
      }
    }

    const qty = parseQuantity(data.qty);
    if (!qty || isNaN(qty) || qty <= 0) {
      return { success: false, message: "Jumlah harus berupa angka lebih dari 0." };
    }

    const currentStock = parseQuantity(item.stock);
    if (data.type === "OUT" && currentStock < qty) {
      return {
        success: false,
        message: `Stok ${item.name} tidak cukup! Sisa saat ini: ${formatStock(currentStock, item.unit)}`
      };
    }

    // Update stok (dukungan desimal presisi 3 angka di belakang koma)
    if (data.type === "IN") {
      item.stock = Math.round((currentStock + qty) * 1000) / 1000;
    } else {
      item.stock = Math.round((currentStock - qty) * 1000) / 1000;
    }

    const unitPrice = parseQuantity(item.price);
    const totalRupiah = Math.round(qty * unitPrice);

    const txn = {
      id: _generateTxnId(),
      itemId: item.id,
      itemName: item.name,
      type: data.type,
      qty: qty,
      date: data.date || new Date().toISOString().split("T")[0],
      staff: data.staff || "Staff",
      notes: data.notes || "-",
      division: item.division,
      unitPrice: unitPrice,
      totalRupiah: totalRupiah
    };

    _transactions.unshift(txn);

    // Simpan ke localStorage
    _saveItems();
    _saveTransactions();

    // Trigger sinkronisasi realtime ke Google Sheets (jika URL dikonfigurasi)
    _syncTransaction(txn);

    return {
      success: true,
      message: `${data.type === "IN" ? "Stok masuk" : "Stok keluar"} ${formatStock(qty, item.unit)} ${item.name} berhasil dicatat. (${formatRupiah(totalRupiah)})`,
      transaction: _deepClone(txn),
      updatedStock: item.stock
    };
  }

  /**
   * Edit / Koreksi Mutasi Transaksi (Admin Only)
   * Mengoreksi jumlah transaksi yang salah ketik, menyesuaikan stok fisik barang secara otomatis,
   * mencatat jejak audit (siapa yang mengedit & alasannya), dan mengirim pembaruan ke Google Sheets.
   */
  function editTransaction(txnId, { newQty, reason, adminName }) {
    const txn = _transactions.find(t => t.id === txnId);
    if (!txn) {
      return { success: false, message: `Transaksi dengan ID ${txnId} tidak ditemukan.` };
    }

    const item = _items.find(it => it.id === Number(txn.itemId));
    if (!item) {
      return { success: false, message: `Barang dengan ID ${txn.itemId} tidak ditemukan.` };
    }

    const parsedNewQty = parseQuantity(newQty);
    if (isNaN(parsedNewQty) || parsedNewQty <= 0) {
      return { success: false, message: "Jumlah baru harus berupa angka lebih dari 0." };
    }

    const oldQty = parseQuantity(txn.qty);
    if (parsedNewQty === oldQty) {
      return { success: false, message: "Jumlah baru sama dengan jumlah sebelumnya (tidak ada perubahan)." };
    }

    const currentStock = parseQuantity(item.stock);
    let newStock = currentStock;

    if (txn.type === "IN") {
      // Jika tipe masuk: penyesuaian = newQty - oldQty
      // Misal sebelumnya IN 10, sekarang jadi IN 2 -> selisih -8 -> stok berkurang 8
      const delta = parsedNewQty - oldQty;
      newStock = Math.round((currentStock + delta) * 1000) / 1000;
      if (newStock < 0) {
        return {
          success: false,
          message: `Koreksi ditolak: Pengurangan mutasi masuk akan menyebabkan sisa stok menjadi minus (${formatStock(newStock, item.unit)})!`
        };
      }
    } else {
      // Jika tipe keluar: penyesuaian = oldQty - newQty
      // Misal sebelumnya OUT 10, sekarang jadi OUT 2 -> stok bertambah 8
      // Misal sebelumnya OUT 2, sekarang jadi OUT 10 -> stok berkurang 8
      const delta = oldQty - parsedNewQty;
      newStock = Math.round((currentStock + delta) * 1000) / 1000;
      if (newStock < 0) {
        return {
          success: false,
          message: `Koreksi ditolak: Penambahan mutasi keluar melebihi stok yang tersedia (sisa saat ini: ${formatStock(currentStock, item.unit)})!`
        };
      }
    }

    // Update stok fisik barang
    item.stock = newStock;

    // Catat riwayat perubahan pada transaksi
    const originalQty = txn.originalQty !== undefined ? txn.originalQty : oldQty;
    txn.originalQty = originalQty;
    txn.qty = parsedNewQty;
    txn.totalRupiah = Math.round(parsedNewQty * parseQuantity(txn.unitPrice));
    txn.editedBy = adminName || "Admin";
    txn.editedAt = new Date().toISOString();
    txn.editReason = (reason && reason.trim()) ? reason.trim() : "Koreksi jumlah oleh Admin";

    _saveItems();
    _saveTransactions();

    // Kirim koreksi mutasi ke Google Sheets
    _syncEditMutation({
      txnId: txn.id,
      itemId: item.id,
      itemName: item.name,
      division: item.division,
      type: txn.type,
      date: txn.date,
      oldQty: oldQty,
      newQty: parsedNewQty,
      unit: item.unit,
      adminName: txn.editedBy,
      reason: txn.editReason,
      unitPrice: txn.unitPrice,
      totalRupiah: txn.totalRupiah
    });

    return {
      success: true,
      message: `Mutasi ${item.name} berhasil dikoreksi dari ${formatStock(oldQty, item.unit)} ke ${formatStock(parsedNewQty, item.unit)}. Sisa stok saat ini: ${formatStock(newStock, item.unit)}.`,
      transaction: _deepClone(txn),
      updatedStock: item.stock
    };
  }

  /** Ambil riwayat transaksi, terbaru duluan */
  function getTransactions(limit = 100) {
    return _deepClone(_transactions.slice(0, limit));
  }

  /**
   * Filter riwayat transaksi secara fleksibel: tipe, rentang tanggal, staf
   */
  function getFilteredTransactions({ type = "ALL", startDate = null, endDate = null, staff = "ALL", limit = 300 } = {}) {
    let list = _transactions;

    if (type && type !== "ALL") {
      list = list.filter(t => t.type === type);
    }

    if (startDate) {
      list = list.filter(t => t.date >= startDate);
    }

    if (endDate) {
      list = list.filter(t => t.date <= endDate);
    }

    if (staff && staff !== "ALL") {
      const sLower = staff.toLowerCase();
      list = list.filter(t => t.staff && t.staff.toLowerCase().includes(sLower));
    }

    return _deepClone(list.slice(0, limit));
  }

  /**
   * Ambil daftar nama staf unik untuk dropdown filter
   * Catatan: Akun Super Admin (Satian) TIDAK dimasukkan karena tidak menginput stok.
   */
  function getStaffList() {
    const staffSet = new Set();
    _transactions.forEach(t => {
      const s = (t.staff || "").trim();
      if (s && s.toLowerCase() !== "satian" && s.toLowerCase() !== "super admin") {
        staffSet.add(s);
      }
    });
    // Hanya tambahkan staf dan admin operasional
    ["ragil", "angel", "chef", "barista", "gudang", "rey"].forEach(u => staffSet.add(u));
    return Array.from(staffSet).sort();
  }

  /**
   * Ambil ringkasan stok & riwayat untuk 1 item tertentu
   * Default: dari tanggal 1 per tiap bulannya
   * Mendukung rentang kustom (custom range: startDate & endDate)
   */
  function getItemDetailSummary(itemId, options = {}) {
    const item = getItemById(itemId);
    if (!item) return null;

    let yearMonth = null;
    let startDate = null;
    let endDate = null;
    let isCustom = false;

    if (typeof options === "string") {
      yearMonth = options;
    } else if (options && typeof options === "object") {
      yearMonth = options.yearMonth || null;
      startDate = options.startDate || null;
      endDate = options.endDate || null;
      isCustom = !!(options.isCustom || (startDate && endDate && !yearMonth));
    }

    const allItemTxns = _transactions.filter(t => t.itemId === Number(itemId));

    // Jika custom range
    if (isCustom && startDate && endDate) {
      // startDate dan endDate sudah diatur
    } else {
      // Default: dari tanggal 1 per tiap bulannya
      let ym = yearMonth;
      if (!ym) {
        if (allItemTxns.length > 0 && allItemTxns[0].date) {
          ym = allItemTxns[0].date.slice(0, 7);
        } else {
          ym = new Date().toISOString().slice(0, 7);
        }
      }
      yearMonth = ym;
      startDate = `${ym}-01`;
      endDate = `${ym}-31`;
    }

    const periodTxns = allItemTxns.filter(t => t.date >= startDate && t.date <= endDate);

    let inQty = 0;
    let outQty = 0;
    let inRupiah = 0;
    let outRupiah = 0;

    periodTxns.forEach(t => {
      const qty = Number(t.qty) || 0;
      const rp = Number(t.totalRupiah) || (qty * (Number(t.unitPrice) || Number(item.price) || 0));
      if (t.type === "IN") {
        inQty += qty;
        inRupiah += rp;
      } else if (t.type === "OUT") {
        outQty += qty;
        outRupiah += rp;
      }
    });

    const stokAkhirQty = Number(item.stock) || 0;
    const stokAkhirRupiah = stokAkhirQty * (Number(item.price) || 0);

    const monthSet = new Set();
    allItemTxns.forEach(t => {
      if (t.date) monthSet.add(t.date.slice(0, 7));
    });
    monthSet.add(new Date().toISOString().slice(0, 7));
    monthSet.add("2026-10");
    const availableMonths = Array.from(monthSet).sort().reverse();

    return {
      item,
      isCustom,
      yearMonth,
      availableMonths,
      startDate,
      endDate,
      stokAkhirQty,
      stokAkhirRupiah,
      inQty,
      outQty,
      inRupiah,
      outRupiah,
      transactions: periodTxns
    };
  }

  /** Format harga ke Rupiah */
  function formatRupiah(num) {
    const n = Math.round(Number(num) || 0);
    if (n === 0) return "Rp 0";
    return "Rp " + n.toLocaleString("id-ID");
  }

  /** Format stok dengan satuan */
  function formatStock(stock, unit) {
    const s = parseQuantity(stock);
    const formatted = s.toLocaleString("id-ID", { maximumFractionDigits: 3 });
    return `${formatted} ${unit}`;
  }

  /**
   * Update nama barang (koreksi typo) dan/atau harga satuan barang
   * Khusus Admin Only!
   */
  function updateItemInfo(id, { name, price, division } = {}) {
    const item = _items.find(it => it.id === Number(id));
    if (!item) {
      return { success: false, message: `Barang dengan ID ${id} tidak ditemukan.` };
    }

    const oldName = item.name;
    const oldPrice = item.price;
    const oldDiv = item.division;
    let nameChanged = false;
    let priceChanged = false;
    let divChanged = false;

    // Validasi & Update Nama Barang (Koreksi typo)
    if (name !== undefined && name !== null) {
      const cleanName = String(name).trim();
      if (!cleanName) {
        return { success: false, message: "Nama barang tidak boleh kosong!" };
      }
      const exists = _items.some(it => it.id !== item.id && it.name.toLowerCase() === cleanName.toLowerCase());
      if (exists) {
        return { success: false, message: `Barang dengan nama "${cleanName}" sudah ada di katalog.` };
      }
      if (cleanName !== item.name) {
        item.name = cleanName;
        nameChanged = true;

        // Sinkronkan nama di riwayat transaksi untuk barang ini
        _transactions.forEach(t => {
          if (t.itemId === item.id) {
            t.itemName = cleanName;
          }
        });
        _saveTransactions();
      }
    }

    // Validasi & Update Harga Satuan
    if (price !== undefined && price !== null && price !== "") {
      const priceNum = Number(price);
      if (isNaN(priceNum) || priceNum < 0) {
        return { success: false, message: "Harga harus berupa angka minimal 0." };
      }
      if (priceNum !== item.price) {
        item.price = priceNum;
        priceChanged = true;
      }
    }

    // Validasi & Update Divisi / Kategori
    if (division && ["KITCHEN", "BAR", "PASTRY", "LAINNYA"].includes(division)) {
      if (item.division !== division) {
        item.division = division;
        divChanged = true;
        _transactions.forEach(t => {
          if (t.itemId === item.id) {
            t.division = division;
          }
        });
        _saveTransactions();
      }
    }

    if (!nameChanged && !priceChanged && !divChanged) {
      return { success: false, message: "Tidak ada perubahan nama, harga, maupun kategori yang disimpan." };
    }

    _saveItems();

    const changeList = [];
    if (nameChanged) changeList.push(`Nama: "${item.name}"`);
    if (priceChanged) changeList.push(`Harga: ${formatRupiah(item.price)}`);
    if (divChanged) changeList.push(`Kategori: ${item.division === 'BAR' ? 'Barista' : item.division === 'PASTRY' ? 'Pastry' : item.division === 'LAINNYA' ? 'Lain-Lain' : 'Kitchen'}`);

    return {
      success: true,
      message: `Perubahan berhasil disimpan: ${changeList.join(" & ")}.`,
      item: _deepClone(item)
    };
  }

  /**
   * Update harga satuan barang (kompatibilitas fungsi lama)
   */
  function updateItemPrice(id, newPrice) {
    return updateItemInfo(id, { price: newPrice });
  }

  /**
   * Menambah barang baru ke katalog
   */
  function addNewItem(data) {
    if (!data.name || !data.name.trim()) {
      return { success: false, message: "Nama barang wajib diisi." };
    }
    const cleanName = data.name.trim();

    const exists = _items.some(it => it.name.toLowerCase() === cleanName.toLowerCase());
    if (exists) {
      return { success: false, message: `Barang "${cleanName}" sudah terdaftar di katalog.` };
    }

    if (!data.unit || !data.unit.trim()) {
      return { success: false, message: "Satuan barang wajib diisi (contoh: Kg, Liter, Pack, Pcs)." };
    }

    const maxId = _items.reduce((max, it) => Math.max(max, it.id || 0), 0);
    const newId = maxId + 1;

    let validDiv = "KITCHEN";
    const reqDiv = (data.division || "").toUpperCase();
    if (reqDiv === "BAR") validDiv = "BAR";
    else if (reqDiv === "PASTRY") validDiv = "PASTRY";
    else if (reqDiv === "LAINNYA") validDiv = "LAINNYA";

    const newItem = {
      id: newId,
      name: cleanName,
      division: validDiv,
      unit: data.unit.trim().toUpperCase(),
      price: Math.max(0, Number(data.price) || 0),
      stock: Math.max(0, Number(data.stock) || 0),
      minStock: Math.max(0, Number(data.minStock) || 2)
    };

    _items.push(newItem);
    _saveItems();

    return {
      success: true,
      message: `Barang "${newItem.name}" (${newItem.division}) berhasil ditambahkan ke katalog!`,
      item: _deepClone(newItem)
    };
  }

  /**
   * Reset data ke default asli Google Sheets
   */
  function resetToDefaultCatalog() {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(ITEMS_STORAGE_KEY);
        window.localStorage.removeItem(TXNS_STORAGE_KEY);
      }
      _loadData();
      return { success: true, message: "Data stok dan riwayat berhasil direset ke data asli Google Sheets!" };
    } catch (e) {
      return { success: false, message: "Gagal mereset data: " + e.message };
    }
  }

  /**
   * Export data barang ke file CSV (dapat dibuka di Excel)
   */
  function exportItemsToCSV() {
    const headers = ["ID", "Nama Barang", "Devisi", "Satuan", "Harga Satuan (Rp)", "Stok Akhir", "Nilai Stok (Rp)"];
    const rows = _items.map(it => [
      it.id,
      `"${it.name.replace(/"/g, '""')}"`,
      it.division,
      it.unit,
      it.price,
      it.stock,
      (Number(it.stock) || 0) * (Number(it.price) || 0)
    ]);

    const csvContent = "\uFEFF" + [headers.join(",")].concat(rows.map(r => r.join(","))).join("\r\n");
    _downloadFile(csvContent, `Rimba_Alam_Katalog_Stok_${_todayStr()}.csv`, "text/csv;charset=utf-8;");
  }

  /**
   * Export riwayat transaksi ke file CSV
   */
  function exportTransactionsToCSV() {
    const headers = ["ID Transaksi", "Tanggal", "Nama Barang", "Devisi", "Tipe", "Jumlah", "Harga Satuan (Rp)", "Total Nilai (Rp)", "PIC / Staf", "Catatan"];
    const rows = _transactions.map(t => [
      t.id,
      t.date,
      `"${(t.itemName || "").replace(/"/g, '""')}"`,
      t.division,
      t.type,
      t.qty,
      t.unitPrice || 0,
      t.totalRupiah || (t.qty * (t.unitPrice || 0)),
      `"${(t.staff || "").replace(/"/g, '""')}"`,
      `"${(t.notes || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(",")].concat(rows.map(r => r.join(","))).join("\r\n");
    _downloadFile(csvContent, `Rimba_Alam_Riwayat_Transaksi_${_todayStr()}.csv`, "text/csv;charset=utf-8;");
  }

  function _todayStr() {
    return new Date().toISOString().split("T")[0];
  }

  function _downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  // ── GOOGLE APPS SCRIPT REALTIME SYNC ENGINE ───────────────────────
  const DEFAULT_GAS_URL = "https://script.google.com/macros/s/AKfycbx-9xjMymUacVFcpW5RPJ_9JQDb0P9dmmfVwnvUwH_YB4hifGa-kAFSby8NrkdV5_gORQ/exec";

  function getGasUrl() {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const stored = window.localStorage.getItem(GAS_URL_STORAGE_KEY);
        if (stored !== null && stored !== undefined) return stored;
        return DEFAULT_GAS_URL;
      }
    } catch (e) {
      console.warn("[DataService] Gagal membaca GAS URL:", e);
    }
    return DEFAULT_GAS_URL;
  }

  function setGasUrl(url) {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const clean = (url || "").trim();
        window.localStorage.setItem(GAS_URL_STORAGE_KEY, clean);
        return { success: true, message: "URL Web App Google Sheets berhasil disimpan!" };
      }
    } catch (e) {
      return { success: false, message: e.message };
    }
    return { success: true };
  }

  function _getPendingSyncQueue() {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const raw = window.localStorage.getItem(PENDING_SYNC_STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
      }
    } catch (e) {
      console.warn("[DataService] Gagal membaca pending sync:", e);
    }
    return [];
  }

  function _savePendingSyncQueue(queue) {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(PENDING_SYNC_STORAGE_KEY, JSON.stringify(queue));
      }
    } catch (e) {
      console.warn("[DataService] Gagal menyimpan pending sync:", e);
    }
  }

  function _queuePendingSync(payload) {
    const queue = _getPendingSyncQueue();
    // Hindari duplikasi payload ID yang sama di antrean
    if (!queue.some(p => p.id === payload.id)) {
      queue.push(payload);
      _savePendingSyncQueue(queue);
    }
  }

  function getPendingSyncCount() {
    return _getPendingSyncQueue().length;
  }

  async function _syncTransaction(txn) {
    const url = getGasUrl();
    if (!url) {
      // Belum ada URL Google Apps Script yang dikonfigurasi, simpan lokal saja
      return;
    }

    const payload = {
      id: txn.id,
      timestamp: txn.date ? `${txn.date} ${new Date().toTimeString().split(" ")[0]}` : new Date().toISOString(),
      division: txn.division || "-",
      staffName: txn.staff || "-",
      itemId: txn.itemId,
      itemName: txn.itemName,
      unit: txn.unit || "-",
      type: txn.type,
      qty: txn.qty,
      notes: txn.notes || "",
      price: txn.unitPrice || 0,
      totalRp: txn.totalRupiah || 0
    };

    // 1. Coba kirim via server local proxy terlebih dahulu (bebas CORS & auto-redirect)
    try {
      const proxyRes = await fetch("/api/sync-gas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, payload })
      });
      if (proxyRes.ok) {
        const json = await proxyRes.json();
        if (json.success) {
          console.log(`[DataService] Transaksi ${txn.id} tersinkronisasi via proxy.`);
          return;
        }
      }
    } catch (e) {
      // Server proxy tidak aktif (misal running standalone PWA), fallback ke fetch langsung
    }

    // 2. Fallback: kirim langsung ke Google Apps Script
    try {
      const res = await fetch(url, {
        method: "POST",
        mode: "no-cors", // no-cors memastikan request tetap sampai ke Google tanpa diblokir CORS browser
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });

      // Pada mode no-cors, tipe 'opaque' menandakan data berhasil terkirim ke Google
      if (res.ok || res.type === "opaque" || res.status === 0) {
        console.log(`[DataService] Transaksi ${txn.id} terkirim langsung ke Google Sheets.`);
      } else {
        _queuePendingSync(payload);
      }
    } catch (err) {
      console.warn("[DataService] Sinkronisasi tertunda (offline atau error koneksi):", err);
      _queuePendingSync(payload);
    }
  }

  async function _syncEditMutation(editData) {
    const url = getGasUrl();
    if (!url) return;

    const payload = {
      action: "editMutation",
      id: editData.txnId,
      timestamp: `${editData.date} ${new Date().toTimeString().split(" ")[0]}`,
      date: editData.date,
      division: editData.division || "-",
      staffName: editData.adminName || "Admin",
      itemId: editData.itemId,
      itemName: editData.itemName,
      unit: editData.unit || "-",
      type: editData.type,
      oldQty: editData.oldQty,
      qty: editData.newQty,
      notes: `Koreksi dari ${editData.oldQty} ke ${editData.newQty} (${editData.reason})`,
      reason: editData.reason || "Koreksi jumlah oleh Admin",
      price: editData.unitPrice || 0,
      totalRp: editData.totalRupiah || 0
    };

    try {
      const proxyRes = await fetch("/api/sync-gas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, payload })
      });
      if (proxyRes.ok) {
        const json = await proxyRes.json();
        if (json.success) {
          console.log(`[DataService] Koreksi ${editData.txnId} tersinkron via proxy.`);
          return;
        }
      }
    } catch (e) {}

    try {
      await fetch(url, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });
      console.log(`[DataService] Koreksi ${editData.txnId} terkirim langsung ke Google Sheets.`);
    } catch (err) {
      _queuePendingSync(payload);
    }
  }

  async function flushPendingSync() {
    const url = getGasUrl();
    if (!url) return { count: 0, success: true };

    const queue = _getPendingSyncQueue();
    if (queue.length === 0) return { count: 0, success: true };

    const remaining = [];
    let synced = 0;

    for (const item of queue) {
      let sent = false;
      try {
        const proxyRes = await fetch("/api/sync-gas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, payload: item })
        });
        if (proxyRes.ok) {
          const json = await proxyRes.json();
          if (json.success) sent = true;
        }
      } catch (e) {}

      if (!sent) {
        try {
          const res = await fetch(url, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(item)
          });
          if (res.ok || res.type === "opaque" || res.status === 0) {
            sent = true;
          }
        } catch (e) {}
      }

      if (sent) {
        synced++;
      } else {
        remaining.push(item);
      }
    }

    _savePendingSyncQueue(remaining);
    return { synced, remaining: remaining.length, success: remaining.length === 0 };
  }

  async function testGasConnection(targetUrl) {
    const url = (targetUrl || getGasUrl()).trim();
    if (!url) {
      return { success: false, message: "URL Web App Google Sheets belum diisi." };
    }

    // 1. Deteksi kesalahan URL umum
    if (url.includes("docs.google.com/spreadsheets")) {
      return {
        success: false,
        message: "Yang Anda masukkan adalah link Google Sheets! Yang dibutuhkan adalah URL Web App dari menu Ekstensi -> Apps Script -> Deploy (akhiran /exec)."
      };
    }

    if (url.includes("/edit")) {
      return {
        success: false,
        message: "URL ini adalah link halaman editor kode. Anda harus klik tombol 'Deploy' (Terapkan) -> 'New deployment' -> pilih 'Web app' untuk mendapatkan URL yang berakhiran /exec."
      };
    }

    // 2. Coba lewat proxy server terlebih dahulu
    try {
      const proxyRes = await fetch(`/api/test-gas?url=${encodeURIComponent(url)}`);
      if (proxyRes.ok) {
        const json = await proxyRes.json();
        return json;
      }
    } catch (e) {
      // Fallback jika tidak ada server proxy
    }

    // 3. Fallback direct ping
    try {
      const pingUrl = url + (url.includes("?") ? "&" : "?") + "action=ping&t=" + Date.now();
      const res = await fetch(pingUrl, { method: "GET" });
      if (!res.ok) {
        return { success: false, message: `Server Google merespons kode HTTP ${res.status}` };
      }
      const data = await res.json();
      if (data.status === "online" || data.message) {
        return { success: true, message: "Koneksi ke Google Apps Script BERHASIL AKTIF!" };
      }
      return { success: true, message: "Terhubung ke Google Sheets." };
    } catch (err) {
      // Jika terjadi Failed to fetch karena CORS, coba mode no-cors
      try {
        await fetch(url, { method: "GET", mode: "no-cors" });
        return {
          success: true,
          message: "Endpoint terjangkau oleh browser (mode no-cors). Siap menerima transaksi!"
        };
      } catch (err2) {
        return {
          success: false,
          message: `Gagal terhubung (${err.message}). Pastikan saat Deploy, 'Who has access' diubah ke 'Anyone' (Siapa saja).`
        };
      }
    }
  }

  // Listener otomatis: Jika internet sempat mati dan nyala lagi, langsung kirim antrean
  if (typeof window !== "undefined") {
    window.addEventListener("online", () => {
      console.log("[DataService] Jaringan online kembali, mengirimkan antrean tertunda...");
      flushPendingSync();
    });
  }

  return {
    searchItems,
    getAllItems,
    getItemById,
    getLowStockItems,
    getDashboardStats,
    saveTransaction,
    editTransaction,
    getTransactions,
    getFilteredTransactions,
    getStaffList,
    getItemDetailSummary,
    formatRupiah,
    formatStock,
    parseQuantity,
    updateItemInfo,
    updateItemPrice,
    addNewItem,
    resetToDefaultCatalog,
    exportItemsToCSV,
    exportTransactionsToCSV,
    getGasUrl,
    setGasUrl,
    testGasConnection,
    flushPendingSync,
    getPendingSyncCount
  };
})();

if (typeof window !== "undefined") {
  window.DataService = DataService;
}
