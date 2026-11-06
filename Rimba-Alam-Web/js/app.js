/**
 * ==========================================================================
 * APP.JS — Rimba Alam Mobile Stock App
 * ==========================================================================
 * UI, navigation, event handling, rendering.
 * Menggunakan DataService dan AuthService sebagai sumber data.
 * Tidak ada logika penyimpanan langsung di sini.
 * ==========================================================================
 */

const App = (() => {
  let currentPage = "dashboard";
  let selectedItem = null;
  let txnType = "IN";

  // ── INIT ──────────────────────────────────────────────────────────
  function init() {
    if (!AuthService.isLoggedIn()) {
      showLogin();
    } else {
      showMainApp();
    }
    bindGlobalEvents();
  }

  // ── GLOBAL EVENT BINDINGS ─────────────────────────────────────────
  function bindGlobalEvents() {
    // Close autocomplete on outside tap
    document.addEventListener("click", (e) => {
      document.querySelectorAll(".autocomplete-dropdown").forEach(dd => {
        if (!dd.parentElement.contains(e.target)) {
          dd.classList.remove("show");
        }
      });
    });

    // Close dialog on overlay tap
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("dialog-overlay")) {
        e.target.classList.remove("show");
      }
    });

    // 📱 HANDLER TOMBOL BACK ANDROID (Keluhan #1 Pengguna PWA)
    window.addEventListener("popstate", (e) => {
      // 1. Jika ada dialog/modal terbuka -> tutup dialog terlebih dahulu
      const openDialog = document.querySelector(".dialog-overlay.show");
      if (openDialog) {
        openDialog.classList.remove("show");
        return;
      }

      // 2. Jika sedang di sub-halaman -> kembali ke Dashboard
      if (currentPage !== "dashboard") {
        navigateTo("dashboard", false);
      }
    });

    // Aksesibilitas: Tutup dialog dengan tombol Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.querySelectorAll(".dialog-overlay.show").forEach(d => d.classList.remove("show"));
      }
    });

    // Indikator Status Jaringan (Offline / Online)
    window.addEventListener("offline", () => {
      const banner = document.getElementById("networkStatusBanner");
      if (banner) banner.style.display = "block";
      showToast("Koneksi terputus: Mode lokal offline aktif.", "warning");
    });
    window.addEventListener("online", () => {
      const banner = document.getElementById("networkStatusBanner");
      if (banner) banner.style.display = "none";
      showToast("Koneksi internet / Wi-Fi terhubung kembali.", "success");
    });
  }

  // ── LOGIN ─────────────────────────────────────────────────────────
  function showLogin() {
    const loginEl = document.getElementById("loginScreen");
    const mainEl = document.getElementById("mainApp");
    if (loginEl) loginEl.style.display = "flex";
    if (mainEl) mainEl.style.display = "none";
    const userEl = document.getElementById("loginUser");
    const pinEl = document.getElementById("loginPin");
    if (userEl) userEl.value = "";
    if (pinEl) pinEl.value = "";
    if (userEl) setTimeout(() => userEl.focus(), 80);
  }

  function handleLogin(e) {
    if (e && e.preventDefault) e.preventDefault();
    const userEl = document.getElementById("loginUser");
    const pinEl = document.getElementById("loginPin");
    const username = userEl ? userEl.value.trim() : "";
    const pin = pinEl ? pinEl.value.trim() : "";

    const result = AuthService.login(username, pin);
    if (result.success) {
      showToast(result.message, "success");
      showMainApp();
      if (userEl) userEl.value = "";
      if (pinEl) pinEl.value = "";
    } else {
      showToast(result.message, "error");
      if (pinEl) {
        pinEl.value = "";
        pinEl.focus();
      }
    }
    return false;
  }

  function fillLogin(username, pin) {
    const userEl = document.getElementById("loginUser");
    const pinEl = document.getElementById("loginPin");
    if (userEl) userEl.value = username;
    if (pinEl) pinEl.value = pin;
    handleLogin();
  }

  // 🚪 LOGOUT DENGAN KONFIRMASI (Mencegah salah tap)
  function confirmLogout() {
    const dialog = document.getElementById("logoutDialog");
    if (dialog) dialog.classList.add("show");
  }

  function closeLogoutDialog() {
    const dialog = document.getElementById("logoutDialog");
    if (dialog) dialog.classList.remove("show");
  }

  function doLogout() {
    closeLogoutDialog();
    AuthService.logout();
    showLogin();
    showToast("Anda telah keluar dari sistem.", "info");
  }

  function handleLogout() {
    confirmLogout();
  }

  // ── MAIN APP ──────────────────────────────────────────────────────
  function showMainApp() {
    const loginEl = document.getElementById("loginScreen");
    const mainEl = document.getElementById("mainApp");
    if (loginEl) loginEl.style.display = "none";
    if (mainEl) mainEl.style.display = "flex";

    // Navigasi Input: Akun Super Admin Satian TIDAK memiliki tombol input sama sekali
    const isSuper = AuthService.isSuperAdmin();
    const navInput = document.getElementById("navItemInput");
    if (navInput) {
      navInput.style.display = isSuper ? "none" : "";
    }

    renderProfileBar();
    navigateTo("dashboard", false);
    updateLowStockBadge();
  }

  function renderProfileBar() {
    const user = AuthService.getCurrentUser();
    if (!user) return;

    const isAdmin = AuthService.isAdmin();
    const btnSettings = document.getElementById("btnSettingsTopBar");
    if (btnSettings) {
      btnSettings.style.display = isAdmin ? "flex" : "none";
    }

    document.querySelectorAll(".profile-bar").forEach(bar => {
      bar.innerHTML = `
        <div class="profile-avatar">${user.avatar || '👤'}</div>
        <div class="profile-info">
          <div class="profile-name" style="font-size: 1.08rem; font-weight: 800;">${esc(user.name)}</div>
        </div>
        <button class="btn-icon" onclick="App.confirmLogout()" title="Keluar">🚪</button>
      `;
    });
  }

  function updateLowStockBadge() {
    const count = DataService.getLowStockItems().length;
    const badge = document.getElementById("alertBadge");
    if (count > 0) {
      badge.style.display = "block";
      badge.textContent = count;
    } else {
      badge.style.display = "none";
    }
  }

  // ── NAVIGATION ────────────────────────────────────────────────────
  function navigateTo(page, pushHistory = true) {
    // Larang Super Admin Satian mengakses halaman input stok
    if (page === "input" && !AuthService.canInputStock()) {
      showToast("Akun Super Admin difokuskan untuk kelola karyawan dan tidak memiliki akses input stok.", "warning");
      navigateTo("dashboard", false);
      return;
    }

    // Validasi hak akses Admin untuk menu Pengaturan
    if (page === "settings" && !AuthService.isAdmin()) {
      showToast("Akses Ditolak: Hanya Admin yang dapat mengakses menu Pengaturan.", "error");
      return;
    }

    currentPage = page;

    if (pushHistory && window.history && window.history.pushState) {
      window.history.pushState({ page }, "", "#" + page);
    }

    // Toggle page visibility
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    const target = document.getElementById("page-" + page);
    if (target) target.classList.add("active");

    // Toggle nav active state
    document.querySelectorAll(".nav-item").forEach(n => {
      n.classList.toggle("active", n.dataset.page === page);
    });

    // Update top bar title
    const titles = {
      dashboard: "Dashboard",
      items: "Daftar Barang",
      input: "Input Stok",
      history: "Riwayat Transaksi",
      alerts: "Peringatan Stok",
      settings: AuthService.isSuperAdmin() ? "Kelola Karyawan" : "Pengaturan & Barang",
    };
    document.getElementById("topBarTitle").textContent = titles[page] || "Rimba Alam";

    // Render page content
    switch (page) {
      case "dashboard": renderDashboard(); break;
      case "items":     renderItemList();   break;
      case "input":     renderInputForm();  break;
      case "history":   renderHistory();    break;
      case "alerts":    renderAlerts();     break;
      case "settings":  renderSettings();   break;
    }
  }

  // ── DASHBOARD ─────────────────────────────────────────────────────
  function renderDashboard() {
    const stats = DataService.getDashboardStats();
    const recentTxns = DataService.getTransactions(5);
    const isAdmin = AuthService.isAdmin();
    const canViewMoney = AuthService.canViewMoney();

    const container = document.getElementById("dashboardContent");
    container.innerHTML = `
      <div class="profile-bar"></div>

      ${canViewMoney ? `
      <!-- 💰 RINGKASAN FINANSIAL STOK RIMBA ALAM (HANYA DITAMPILKAN UNTUK ADMIN) -->
      <div class="card" style="margin-bottom: 12px; background: linear-gradient(135deg, #1b5e20, #2e7d32); color: white; border: none; box-shadow: 0 4px 12px rgba(27,94,32,0.25);">
        <div class="card-body" style="padding: 14px 16px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size: .72rem; text-transform: uppercase; letter-spacing: .5px; opacity: 0.9;">💰 Total Nilai Aset Stok</span>
            <span style="font-size: .72rem; background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 12px; font-weight:600;">${stats.activeMonthName || "November 2026"}</span>
          </div>
          <div style="font-size: 1.5rem; font-weight: 800; margin: 4px 0 10px 0; letter-spacing: -.5px;">
            ${DataService.formatRupiah(stats.totalNilaiStokAset)}
          </div>
          <div style="display:flex; justify-content:space-between; gap: 8px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px; font-size: .76rem;">
            <div>
              <span style="opacity: 0.85;">📥 Belanja (Rupiah Masuk):</span>
              <strong style="display:block; color: #c8e6c9; font-size:.84rem; margin-top:2px;">${DataService.formatRupiah(stats.totalRupiahMasuk)}</strong>
            </div>
            <div style="text-align: right;">
              <span style="opacity: 0.85;">📤 Pemakaian (Rupiah Keluar):</span>
              <strong style="display:block; color: #ffcdd2; font-size:.84rem; margin-top:2px;">${DataService.formatRupiah(stats.totalRupiahKeluar)}</strong>
            </div>
          </div>
        </div>
      </div>
      ` : ""}

      <div class="stat-grid">
        <div class="stat-card" onclick="App.navigateTo('items')" title="Buka Daftar Barang">
          <div class="stat-icon">📦</div>
          <div class="stat-value">${stats.totalItems}</div>
          <div class="stat-label">Total Item Terdaftar ›</div>
        </div>
        <div class="stat-card" onclick="App.navigateTo('alerts')" title="Buka Peringatan Stok">
          <div class="stat-icon">⚠️</div>
          <div class="stat-value text-warning">${stats.lowStockCount}</div>
          <div class="stat-label">Stok Menipis ›</div>
        </div>
        <div class="stat-card" onclick="App.navigateToHistory('IN')" title="Buka Riwayat Stok Masuk">
          <div class="stat-icon">📥</div>
          <div class="stat-value text-success">${stats.todayIn}</div>
          <div class="stat-label">Masuk Hari Ini ›</div>
        </div>
        <div class="stat-card" onclick="App.navigateToHistory('OUT')" title="Buka Riwayat Stok Keluar">
          <div class="stat-icon">📤</div>
          <div class="stat-value text-danger">${stats.todayOut}</div>
          <div class="stat-label">Keluar Hari Ini ›</div>
        </div>
      </div>

      ${isAdmin ? `
      <!-- Shortcut Pengaturan (Hanya Tampil untuk Admin & Super Admin) -->
      <div class="card" style="margin-bottom: 16px; cursor: pointer; border-left: 4px solid var(--secondary);" onclick="App.navigateTo('settings')">
        <div class="card-body" style="display:flex; align-items:center; justify-content:space-between; padding: 12px 14px;">
          <div style="display:flex; align-items:center; gap: 10px;">
            <span style="font-size: 1.4rem;">⚙️</span>
            <div>
              <strong style="font-size: .88rem; display:block;">Pengaturan & Kelola Barang ${AuthService.isSuperAdmin() ? '& User' : ''}</strong>
              <span style="font-size: .74rem; color: var(--on-surface-variant);">Ubah harga satuan, tambah barang baru ${AuthService.isSuperAdmin() ? '& kelola karyawan' : ''}</span>
            </div>
          </div>
          <span style="font-size: 1.1rem; color: var(--outline);">›</span>
        </div>
      </div>
      ` : ""}

      <div class="section-header mt-16">
        <span class="section-title">🕒 Riwayat Transaksi Terakhir</span>
        <button class="section-link" onclick="App.navigateTo('history')">Lihat semua</button>
      </div>
      ${recentTxns.length > 0 ? `
        <div class="txn-list">${recentTxns.map(renderTxnRow).join("")}</div>
      ` : `<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">Belum ada transaksi</div></div>`}
    `;

    renderProfileBar();
  }

  // ── ITEMS LIST ────────────────────────────────────────────────────
  let itemDivFilter = "ALL";

  function renderItemList() {
    const container = document.getElementById("itemsContent");
    container.innerHTML = `
      <div class="search-wrap">
        <span class="search-icon">🔍</span>
        <input type="text" class="search-input" id="itemSearchBox"
               placeholder="Masukan nama item"
               oninput="App.handleItemListSearch(this.value)"
               autocomplete="off">
        <button class="search-clear" id="itemSearchClear" onclick="App.clearItemSearch()">✕</button>
        <div class="autocomplete-dropdown" id="itemListDropdown"></div>
      </div>

      <div class="chip-row">
        <button class="chip ${itemDivFilter === 'ALL' ? 'active' : ''}" onclick="App.filterItemDiv('ALL')">Semua</button>
        <button class="chip ${itemDivFilter === 'KITCHEN' ? 'active' : ''}" onclick="App.filterItemDiv('KITCHEN')">🍳 Kitchen</button>
        <button class="chip ${itemDivFilter === 'BAR' ? 'active' : ''}" onclick="App.filterItemDiv('BAR')">☕ Barista</button>
        <button class="chip ${itemDivFilter === 'PASTRY' ? 'active' : ''}" onclick="App.filterItemDiv('PASTRY')">🍰 Pastry</button>
        <button class="chip ${itemDivFilter === 'LAINNYA' ? 'active' : ''}" onclick="App.filterItemDiv('LAINNYA')">📦 Lain-Lain</button>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <span style="font-size:.78rem; font-weight:700; color:var(--on-surface-variant);">KLIK NAMA UNTUK DETAIL & RIWAYAT</span>
        <button type="button" class="section-link" onclick="DataService.exportItemsToCSV()" style="display:flex; align-items:center; gap:4px; font-size:.75rem;">
          <span>📥</span> Unduh CSV
        </button>
      </div>

      <div class="item-list" id="itemListContainer"></div>
    `;

    renderItemRows();
  }

  function renderItemRows(query = "") {
    const container = document.getElementById("itemListContainer");
    if (!container) return;

    const canViewMoney = AuthService.canViewMoney();

    let items;
    if (query.trim()) {
      items = DataService.searchItems(query, itemDivFilter);
    } else {
      items = DataService.getAllItems(itemDivFilter);
    }

    if (items.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-text">Tidak ada item yang cocok</div></div>`;
      return;
    }

    container.innerHTML = items.map(it => {
      const isLow = it.stock <= it.minStock;
      const subtotalNilai = (Number(it.stock) || 0) * (Number(it.price) || 0);
      return `
        <div class="item-row" onclick="App.openItemDetail(${it.id})">
          <div class="item-left">
            <div class="item-name">${esc(it.name)}</div>
            <div class="item-meta">
              ${getDivisionBadge(it.division)}
              <span>Satuan: ${esc(it.unit)}</span>
              ${canViewMoney ? `<span>· @ ${DataService.formatRupiah(it.price)}</span>` : ''}
              ${(canViewMoney && subtotalNilai > 0) ? `· <strong style="color:var(--primary); font-size:.74rem;">Aset: ${DataService.formatRupiah(subtotalNilai)}</strong>` : ''}
            </div>
          </div>
          <div class="item-right">
            <div style="text-align:right;">
              <div class="item-stock-val ${isLow ? 'low' : 'ok'}">${DataService.parseQuantity(it.stock).toLocaleString("id-ID", { maximumFractionDigits: 3 })}</div>
              <div class="item-stock-unit">${esc(it.unit)}</div>
            </div>
            <button type="button" class="btn-item-input" onclick="event.stopPropagation(); App.goToInputWithItem(${it.id})" title="Input Stok Langsung">
              ➕ Input
            </button>
          </div>
        </div>
      `;
    }).join("");
  }

  function handleItemListSearch(val) {
    const clearBtn = document.getElementById("itemSearchClear");
    if (clearBtn) clearBtn.classList.toggle("show", val.length > 0);
    renderItemRows(val);
  }

  function clearItemSearch() {
    const input = document.getElementById("itemSearchBox");
    if (input) { input.value = ""; input.focus(); }
    const clearBtn = document.getElementById("itemSearchClear");
    if (clearBtn) clearBtn.classList.remove("show");
    renderItemRows();
  }

  function filterItemDiv(div) {
    itemDivFilter = div;
    renderItemList();
  }

  // ── ITEM DETAIL & MONTHLY / CUSTOM HISTORY MODAL ───────────────────
  let currentDetailItemId = null;
  let currentDetailOptions = {};

  function openItemDetail(itemId, options) {
    currentDetailItemId = Number(itemId);
    const data = DataService.getItemDetailSummary(currentDetailItemId, options);
    if (!data || !data.item) return;

    currentDetailOptions = {
      isCustom: !!data.isCustom,
      yearMonth: data.yearMonth,
      startDate: data.startDate,
      endDate: data.endDate
    };

    const item = data.item;
    const canViewMoney = AuthService.canViewMoney();
    const canInput = AuthService.canInputStock();

    const titleEl = document.getElementById("itemDetailTitle");
    const metaEl = document.getElementById("itemDetailMeta");
    const bodyEl = document.getElementById("itemDetailBody");
    const dialogEl = document.getElementById("itemDetailDialog");

    if (!dialogEl || !bodyEl) return;

    titleEl.textContent = item.name;
    metaEl.innerHTML = `
      ${getDivisionBadge(item.division)}
      Satuan: <strong>${esc(item.unit)}</strong>
      ${canViewMoney ? `· @ <strong>${DataService.formatRupiah(item.price)}</strong>` : ''}
    `;

    const monthOptions = (data.availableMonths || []).map(ym => {
      const parts = ym.split("-");
      const monthNames = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      const label = `${monthNames[Number(parts[1])] || parts[1]} ${parts[0]}`;
      const selected = (!data.isCustom && ym === data.yearMonth) ? "selected" : "";
      return `<option value="${ym}" ${selected}>1 ${label} - Selesai</option>`;
    }).join("");

    bodyEl.innerHTML = `
      <!-- Switcher Mode Periode: Bulanan vs Custom -->
      <div style="background:#f5f5f5; border-radius:8px; padding:8px 10px; margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="font-size:.74rem; font-weight:700; color:var(--on-surface-variant);">📅 PERIODE MUTASI:</span>
          <div style="display:flex; gap:4px;">
            <button type="button" class="chip ${!data.isCustom ? 'active' : ''}" style="padding:2px 8px; font-size:.7rem;" onclick="App.switchDetailPeriodMode(false)">Bulan (Tgl 1)</button>
            <button type="button" class="chip ${data.isCustom ? 'active' : ''}" style="padding:2px 8px; font-size:.7rem;" onclick="App.switchDetailPeriodMode(true)">Rentang Custom</button>
          </div>
        </div>

        ${!data.isCustom ? `
        <!-- Mode Bulanan (Default tgl 1) -->
        <div style="display:flex; align-items:center; gap:8px;">
          <label style="font-size:.72rem; color:var(--on-surface-variant); white-space:nowrap;">Pilih Bulan:</label>
          <select class="filter-select-input" style="padding:3px 8px; font-size:.76rem; flex:1;" onchange="App.openItemDetail(${item.id}, this.value)">
            ${monthOptions}
          </select>
        </div>
        ` : `
        <!-- Mode Rentang Custom -->
        <div style="display:flex; flex-direction:column; gap:6px;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
            <div>
              <label style="font-size:.68rem; color:var(--on-surface-variant); font-weight:600;">Dari Tanggal:</label>
              <input type="date" id="detailCustomStart" class="filter-date-input" style="padding:4px 6px; font-size:.75rem;" value="${data.startDate}">
            </div>
            <div>
              <label style="font-size:.68rem; color:var(--on-surface-variant); font-weight:600;">Sampai Tanggal:</label>
              <input type="date" id="detailCustomEnd" class="filter-date-input" style="padding:4px 6px; font-size:.75rem;" value="${data.endDate}">
            </div>
          </div>
          <button type="button" class="btn btn-primary" style="padding:5px 10px; font-size:.74rem; font-weight:700;" onclick="App.applyDetailCustomRange(${item.id})">
            🔍 Terapkan Periode Custom
          </button>
        </div>
        `}
      </div>

      <!-- 1. Ringkasan Jumlah Stok Fisik -->
      <div class="detail-stat-card">
        <div class="detail-section-title">
          <span>📦 MUTASI STOK (${esc(item.unit)})</span>
          <span style="font-size:.68rem; font-weight:400; text-transform:none;">
            ${data.isCustom ? `${data.startDate} s/d ${data.endDate}` : `Sejak tgl 1 ${data.yearMonth}`}
          </span>
        </div>
        <div class="stat-grid-3">
          <div class="stat-box">
            <div class="stat-box-label">Stok Saat Ini</div>
            <div class="stat-box-val primary">${data.stokAkhirQty.toLocaleString("id-ID")} <span style="font-size:.65rem; font-weight:600;">${esc(item.unit)}</span></div>
          </div>
          <div class="stat-box">
            <div class="stat-box-label">📥 Masuk (IN)</div>
            <div class="stat-box-val in">+${data.inQty.toLocaleString("id-ID")} <span style="font-size:.65rem; font-weight:600;">${esc(item.unit)}</span></div>
          </div>
          <div class="stat-box">
            <div class="stat-box-label">📤 Keluar (OUT)</div>
            <div class="stat-box-val out">-${data.outQty.toLocaleString("id-ID")} <span style="font-size:.65rem; font-weight:600;">${esc(item.unit)}</span></div>
          </div>
        </div>
      </div>

      <!-- 2. Ringkasan Finansial Rupiah (Admin Only) -->
      ${canViewMoney ? `
      <div class="detail-stat-card" style="background:#e8f5e9; border-color:rgba(27,94,32,.2);">
        <div class="detail-section-title" style="color:var(--primary);">
          <span>💰 NILAI RUPIAH (ADMIN ONLY)</span>
          <span style="font-size:.68rem; font-weight:600; text-transform:none;">@ ${DataService.formatRupiah(item.price)}/${esc(item.unit)}</span>
        </div>
        <div class="stat-grid-3">
          <div class="stat-box">
            <div class="stat-box-label">Rp Stok Akhir</div>
            <div class="stat-box-val primary" style="font-size:.82rem;">${DataService.formatRupiah(data.stokAkhirRupiah)}</div>
          </div>
          <div class="stat-box">
            <div class="stat-box-label">Rp Masuk Total</div>
            <div class="stat-box-val in" style="font-size:.82rem;">+${DataService.formatRupiah(data.inRupiah)}</div>
          </div>
          <div class="stat-box">
            <div class="stat-box-label">Rp Keluar Total</div>
            <div class="stat-box-val out" style="font-size:.82rem;">-${DataService.formatRupiah(data.outRupiah)}</div>
          </div>
        </div>
      </div>
      ` : ''}

      <!-- 3. Riwayat Transaksi Barang Ini -->
      <div style="margin-top:10px;">
        <div class="detail-section-title">
          <span>🕒 RIWAYAT MUTASI BARANG INI</span>
          <span style="font-size:.7rem; font-weight:700; color:var(--primary);">${data.transactions.length} Catatan</span>
        </div>

        ${data.transactions.length === 0 ? `
          <div class="empty-state" style="padding:16px 8px; background:#fafafa; border-radius:8px;">
            <div class="empty-state-icon" style="font-size:1.6rem;">📋</div>
            <div class="empty-state-text" style="font-size:.82rem;">Belum ada riwayat transaksi barang ini pada periode terpilih.</div>
          </div>
        ` : `
          <div class="txn-list" style="margin-bottom:12px; max-height:220px; overflow-y:auto; padding-right:2px;">
            ${data.transactions.map(t => {
              const isIn = t.type === "IN";
              const rpVal = Number(t.totalRupiah) || (Number(t.qty || 0) * (Number(t.unitPrice) || Number(item.price) || 0));
              return `
                <div class="txn-row" style="padding:10px 12px; margin-bottom:6px; box-shadow:none; border:1px solid rgba(0,0,0,0.06);">
                  <div class="txn-icon ${isIn ? 'in' : 'out'}" style="width:32px; height:32px; font-size:.85rem;">${isIn ? '📥' : '📤'}</div>
                  <div class="txn-body">
                    <div style="font-weight:700; font-size:.84rem;">
                      ${isIn ? 'Masuk' : 'Keluar'}: 
                      <span class="${isIn ? 'text-success' : 'text-danger'}">${isIn ? '+' : '-'}${Number(t.qty).toLocaleString("id-ID")} ${esc(item.unit)}</span>
                    </div>
                    <div class="txn-detail" style="font-size:.74rem;">
                      👤 Diinput: <strong>${esc(t.staff || 'Staff')}</strong>
                      ${t.notes && t.notes !== '-' ? `· <em>${esc(t.notes)}</em>` : ''}
                      ${canViewMoney ? `<br><strong style="color:var(--primary);">Nilai: ${DataService.formatRupiah(rpVal)}</strong>` : ''}
                    </div>
                  </div>
                  <div class="txn-right">
                    <div class="txn-date" style="font-weight:600; font-size:.75rem; color:var(--on-surface-variant);">${t.date}</div>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        `}
      </div>

      <!-- Tombol Aksi Bawah -->
      <div style="display:flex; gap:8px; margin-top:14px; padding-top:12px; border-top:1px solid rgba(0,0,0,.08);">
        <button type="button" class="btn btn-outline" style="flex:1;" onclick="App.closeItemDetail()">✕ Tutup</button>
        ${canInput ? `
        <button type="button" class="btn btn-primary" style="flex:2; font-weight:700;" onclick="App.goToInputFromDetail(${item.id})">
          ➕ Input Stok Barang Ini
        </button>
        ` : ''}
      </div>
    `;

    dialogEl.classList.add("show");
  }

  function switchDetailPeriodMode(toCustom) {
    if (!currentDetailItemId) return;
    if (toCustom) {
      const today = new Date().toISOString().split("T")[0];
      const start = currentDetailOptions.startDate || today;
      const end = currentDetailOptions.endDate || today;
      openItemDetail(currentDetailItemId, { startDate: start, endDate: end, isCustom: true });
    } else {
      openItemDetail(currentDetailItemId, currentDetailOptions.yearMonth || null);
    }
  }

  function applyDetailCustomRange(itemId) {
    const s = document.getElementById("detailCustomStart")?.value;
    const e = document.getElementById("detailCustomEnd")?.value;
    if (!s || !e) {
      showToast("Pilih tanggal awal dan akhir!", "error");
      return;
    }
    openItemDetail(itemId, { startDate: s, endDate: e, isCustom: true });
  }

  function closeItemDetail() {
    const dialogEl = document.getElementById("itemDetailDialog");
    if (dialogEl) dialogEl.classList.remove("show");
    currentDetailItemId = null;
  }

  function goToInputFromDetail(itemId) {
    closeItemDetail();
    goToInputWithItem(itemId);
  }

  // ── INPUT FORM ────────────────────────────────────────────────────
  function renderInputForm() {
    const user = AuthService.getCurrentUser();
    const container = document.getElementById("inputContent");
    if (!container) return;

    if (!AuthService.canInputStock()) {
      container.innerHTML = `
        <div class="empty-state" style="padding:48px 20px; background:var(--surface); border-radius:var(--radius-lg); margin-top:16px;">
          <div class="empty-state-icon" style="font-size:3rem;">👑</div>
          <div class="empty-state-text" style="font-size:1.05rem; font-weight:700; margin-bottom:8px; color:var(--on-surface);">
            Akses Input Khusus Staf & Admin
          </div>
          <p style="font-size:.84rem; color:var(--on-surface-variant); max-width:320px; margin:0 auto 16px; line-height:1.4;">
            Akun <strong>${esc(user?.name || 'Super Admin')}</strong> adalah akun pengelola sistem & pengguna dan tidak diperuntukkan melakukan input transaksi mutasi stok.
          </p>
          <div style="display:flex; justify-content:center; gap:8px;">
            <button type="button" class="btn btn-outline" style="font-size:.82rem;" onclick="App.navigateTo('dashboard')">
              🌿 Ke Beranda
            </button>
            <button type="button" class="btn btn-primary" style="font-size:.82rem;" onclick="App.navigateTo('items')">
              📦 Cek Stok Barang
            </button>
          </div>
        </div>
      `;
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const userDiv = AuthService.getUserDivision();
    const canAll = AuthService.isAdmin() || userDiv === "ADMIN";
    const allowedText = canAll
      ? "Izin Input: <strong>Semua Kategori</strong> (Kitchen, Barista, Pastry, Lain-Lain)"
      : `Izin Input: <strong>${formatDivisionName(userDiv)}</strong> & <strong>Lain-Lain</strong>`;

    container.innerHTML = `
      <!-- Info Kategori Akun Aktif -->
      <div style="background:var(--surface); border:1px solid var(--border-color); border-radius:10px; padding:10px 14px; margin-bottom:14px; display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:.8rem; color:var(--on-surface-variant);">Kategori Akun:</span>
          ${getDivisionBadge(userDiv)}
        </div>
        <div style="font-size:.74rem; color:var(--on-surface-variant); text-align:right;">
          ${allowedText}
        </div>
      </div>

      <!-- Search for item -->
      <div class="form-group">
        <label class="form-label">Pilih Barang <span class="text-danger">*</span></label>
        <div class="search-wrap">
          <span class="search-icon">🔍</span>
          <input type="text" class="search-input" id="inputItemSearch"
                 placeholder="Masukan nama item"
                 oninput="App.handleInputItemSearch(this.value)"
                 onfocus="App.handleInputItemSearch(this.value)"
                 autocomplete="off">
          <button class="search-clear" id="inputSearchClear" onclick="App.clearInputItemSearch()">✕</button>
          <div class="autocomplete-dropdown" id="inputItemDropdown"></div>
        </div>
      </div>

      <!-- Selected Item Preview -->
      <div class="selected-preview" id="selectedItemPreview">
        <div class="sel-item-info">
          <div class="sel-item-name" id="selName">-</div>
          <div class="sel-item-detail" id="selDetail">-</div>
        </div>
        <button class="sel-remove-btn" onclick="App.deselectItem()">✕</button>
      </div>

      <!-- Type Toggle -->
      <div class="form-group">
        <label class="form-label">Tipe Mutasi <span class="text-danger">*</span></label>
        <div class="type-toggle">
          <button type="button" class="type-btn type-in ${txnType === 'IN' ? 'active' : ''}"
                  onclick="App.setTxnType('IN')">📥 MASUK</button>
          <button type="button" class="type-btn type-out ${txnType === 'OUT' ? 'active' : ''}"
                  onclick="App.setTxnType('OUT')">📤 KELUAR</button>
        </div>
      </div>

      <!-- Quantity (Lebar Penuh & Angka Tengah - Dukungan Koma & Titik) -->
      <div class="form-group">
        <label class="form-label">Jumlah / Qty <span class="text-danger">*</span> <span style="font-size:.74rem; font-weight:normal; color:var(--on-surface-variant);">(Bisa desimal contoh: 2.5 atau 8,2)</span></label>
        <div class="qty-stepper">
          <button type="button" class="stepper-btn" onclick="App.stepQty(-1)">−</button>
          <input type="text" inputmode="decimal" id="inputQty" class="form-input" placeholder="0"
                 oninput="App.checkStockWarning()" autocomplete="off">
          <button type="button" class="stepper-btn" onclick="App.stepQty(1)">+</button>
        </div>
        <div id="qtyWarningMsg" style="display:none; color:var(--danger); font-size:.8rem; font-weight:700; margin-top:4px;"></div>
        <div class="quick-qty-row">
          <button type="button" class="quick-qty-btn" onclick="App.stepQty(0.5)">+0.5</button>
          <button type="button" class="quick-qty-btn" onclick="App.setQty(1)">+1</button>
          <button type="button" class="quick-qty-btn" onclick="App.setQty(2)">+2</button>
          <button type="button" class="quick-qty-btn" onclick="App.setQty(5)">+5</button>
          <button type="button" class="quick-qty-btn" onclick="App.setQty(10)">+10</button>
          <button type="button" class="quick-qty-btn" onclick="App.setQty(20)">+20</button>
          <button type="button" class="quick-qty-btn" onclick="App.setQty(50)">+50</button>
        </div>
      </div>

      <!-- Date -->
      <div class="form-group">
        <label class="form-label">Tanggal</label>
        <input type="date" id="inputDate" class="form-input" value="${today}">
      </div>

      <!-- Staff (Otomatis dari Akun Login, Tidak Bisa Diganti) -->
      <div class="form-group">
        <label class="form-label">Nama Staff</label>
        <div class="form-input-icon-wrap">
          <span class="form-input-icon">👤</span>
          <input type="text" id="inputStaff" class="form-input" 
                 value="${user ? esc(user.name) : 'Staff'}"
                 readonly
                 style="background: var(--surface-container); color: var(--on-surface); font-weight: 700; cursor: not-allowed; border-color: var(--outline-variant);"
                 placeholder="Nama petugas">
        </div>
        <div class="form-hint" style="color: var(--primary); font-weight: 600; display: flex; align-items: center; gap: 4px; margin-top: 4px;">
          <span>🔒</span> Terbaca otomatis dari akun login: <strong>${user ? esc(user.name) : 'Staff'}</strong>
        </div>
      </div>

      <!-- Notes -->
      <div class="form-group">
        <label class="form-label">Catatan</label>
        <textarea id="inputNotes" class="form-input" rows="2" placeholder="Keterangan, supplier, dsb."></textarea>
      </div>

      <!-- Submit -->
      <button class="btn btn-primary btn-block mt-8" onclick="App.confirmSubmit()">
        💾 Simpan Transaksi
      </button>
    `;

    // Pastikan terisi nama user login
    if (user && document.getElementById("inputStaff")) {
      document.getElementById("inputStaff").value = user.name;
    }

    if (selectedItem) {
      showSelectedPreview();
      const sInput = document.getElementById("inputItemSearch");
      if (sInput) sInput.value = selectedItem.name;
      const clearBtn = document.getElementById("inputSearchClear");
      if (clearBtn) clearBtn.classList.add("show");
    }
  }

  function showDivisionRestrictedAlert(targetDiv) {
    const userDiv = AuthService.getUserDivision();
    const allowed = AuthService.getAllowedDivisions();
    const allowedText = allowed.map(d => formatDivisionName(d)).join(" & ");
    showToast(`⛔ Akses Terbatas: Akun Anda (${formatDivisionName(userDiv)}) hanya berhak input barang: ${allowedText}!`, "error");
  }

  function handleInputItemSearch(val) {
    const dropdown = document.getElementById("inputItemDropdown");
    const clearBtn = document.getElementById("inputSearchClear");
    if (clearBtn) clearBtn.classList.toggle("show", val.length > 0);

    if (!val.trim()) {
      dropdown.classList.remove("show");
      return;
    }

    const items = DataService.searchItems(val);
    if (items.length === 0) {
      dropdown.innerHTML = `<div class="autocomplete-empty">Tidak ada item untuk "${esc(val)}"</div>`;
      dropdown.classList.add("show");
      return;
    }

    const q = val.trim().toLowerCase();
    const canViewMoney = AuthService.canViewMoney();

    dropdown.innerHTML = items.slice(0, 25).map(it => {
      const isAllowed = AuthService.canInputItemDivision(it.division);
      const isLow = it.stock <= it.minStock;
      const highlighted = highlightMatch(it.name, q);
      const clickHandler = isAllowed
        ? `App.selectItem(${it.id})`
        : `App.showDivisionRestrictedAlert('${it.division}')`;

      return `
        <div class="autocomplete-item" onclick="${clickHandler}" style="${!isAllowed ? 'opacity:0.6; background:#fafafa;' : ''}">
          <div class="ac-item-left">
            <div class="ac-item-name" style="font-size:.92rem; font-weight:700;">
              ${highlighted} ${getDivisionBadge(it.division)}
              ${!isAllowed ? `<span style="font-size:.68rem; color:var(--danger); font-weight:700; margin-left:4px;">⛔ Khusus ${formatDivisionName(it.division)}</span>` : ''}
            </div>
            <div class="ac-item-meta" style="margin-top:2px;">
              <span>Satuan: ${esc(it.unit)}</span>
              ${canViewMoney ? `<span>· @ ${DataService.formatRupiah(it.price)}</span>` : ''}
            </div>
          </div>
          <div class="ac-item-right">
            <div class="ac-item-stock ${isLow ? 'low' : 'ok'}">${DataService.parseQuantity(it.stock).toLocaleString("id-ID", { maximumFractionDigits: 3 })}</div>
            <div style="font-size:.68rem;color:var(--on-surface-variant)">${esc(it.unit)}</div>
          </div>
        </div>
      `;
    }).join("");

    dropdown.classList.add("show");
  }

  function clearInputItemSearch() {
    const input = document.getElementById("inputItemSearch");
    if (input) { input.value = ""; input.focus(); }
    const clearBtn = document.getElementById("inputSearchClear");
    if (clearBtn) clearBtn.classList.remove("show");
    const dropdown = document.getElementById("inputItemDropdown");
    if (dropdown) dropdown.classList.remove("show");
  }

  function selectItem(id) {
    const item = DataService.getItemById(id);
    if (!item) return;

    if (!AuthService.canInputItemDivision(item.division)) {
      showDivisionRestrictedAlert(item.division);
      return;
    }

    selectedItem = item;

    const searchInput = document.getElementById("inputItemSearch");
    if (searchInput) searchInput.value = selectedItem.name;

    const dropdown = document.getElementById("inputItemDropdown");
    if (dropdown) dropdown.classList.remove("show");

    const clearBtn = document.getElementById("inputSearchClear");
    if (clearBtn) clearBtn.classList.add("show");

    showSelectedPreview();
    document.getElementById("inputQty")?.focus();
  }

  function showSelectedPreview() {
    if (!selectedItem) return;
    const preview = document.getElementById("selectedItemPreview");
    if (!preview) return;
    preview.classList.add("show");

    const isLow = selectedItem.stock <= selectedItem.minStock;
    const canViewMoney = AuthService.canViewMoney();

    document.getElementById("selName").innerHTML = `${esc(selectedItem.name)} ${getDivisionBadge(selectedItem.division)}`;
    document.getElementById("selDetail").innerHTML =
      `Devisi: <strong>${formatDivisionName(selectedItem.division)}</strong> · ` +
      `Sisa Stok: <strong class="${isLow ? 'text-danger' : 'text-success'}">${DataService.formatStock(selectedItem.stock, selectedItem.unit)}</strong>` +
      (canViewMoney ? ` · Harga: <strong>${DataService.formatRupiah(selectedItem.price)}</strong>` : '');
  }

  function deselectItem() {
    selectedItem = null;
    const preview = document.getElementById("selectedItemPreview");
    if (preview) preview.classList.remove("show");
    const searchInput = document.getElementById("inputItemSearch");
    if (searchInput) { searchInput.value = ""; searchInput.focus(); }
    const clearBtn = document.getElementById("inputSearchClear");
    if (clearBtn) clearBtn.classList.remove("show");
  }

  function goToInputWithItem(id) {
    if (!AuthService.canInputStock()) {
      showToast("Akun Super Admin difokuskan untuk kelola sistem & user. Input stok dilakukan oleh Staf/Admin.", "warning");
      return;
    }
    const item = DataService.getItemById(id);
    if (!item) return;
    if (!AuthService.canInputItemDivision(item.division)) {
      showDivisionRestrictedAlert(item.division);
      return;
    }
    selectedItem = item;
    navigateTo("input");
  }

  function setTxnType(type) {
    txnType = type;
    document.querySelectorAll(".type-btn").forEach(btn => {
      btn.classList.toggle("active", btn.classList.contains("type-" + type.toLowerCase()));
    });
    checkStockWarning();
  }

  function checkStockWarning() {
    const input = document.getElementById("inputQty");
    const warnEl = document.getElementById("qtyWarningMsg");
    if (!input || !warnEl) return;
    const val = DataService.parseQuantity(input.value);
    const stockVal = selectedItem ? DataService.parseQuantity(selectedItem.stock) : 0;
    if (txnType === "OUT" && selectedItem && val > stockVal) {
      warnEl.style.display = "block";
      warnEl.innerHTML = `⚠️ Melebihi stok yang ada (${DataService.formatStock(selectedItem.stock, selectedItem.unit)})!`;
    } else {
      warnEl.style.display = "none";
    }
  }

  function stepQty(delta) {
    const input = document.getElementById("inputQty");
    if (!input) return;
    let val = DataService.parseQuantity(input.value);
    val = Math.max(0, Math.round((val + delta) * 100) / 100);
    input.value = val > 0 ? (val % 1 === 0 ? val : String(val).replace('.', ',')) : "";
    checkStockWarning();
  }

  function setQty(val) {
    const input = document.getElementById("inputQty");
    if (input) {
      input.value = val;
      checkStockWarning();
    }
  }

  // ── CONFIRMATION DIALOG ───────────────────────────────────────────
  function confirmSubmit() {
    if (!AuthService.canInputStock()) {
      showToast("Akun Super Admin tidak memiliki izin untuk input transaksi stok.", "warning");
      return;
    }

    if (!selectedItem) {
      showToast("Pilih barang terlebih dahulu!", "error");
      return;
    }

    if (!AuthService.canInputItemDivision(selectedItem.division)) {
      showDivisionRestrictedAlert(selectedItem.division);
      return;
    }

    const rawQty = document.getElementById("inputQty")?.value;
    const qty = DataService.parseQuantity(rawQty);
    if (!qty || isNaN(qty) || qty <= 0) {
      showToast("Jumlah harus berupa angka lebih dari 0! (Bisa desimal misal 2.5 atau 8,2)", "error");
      return;
    }

    // ⛔ STRICT VALIDASI: Form Out menolak qty > stok tersedia (Mencegah saldo negatif)
    const availableStock = DataService.parseQuantity(selectedItem.stock);
    if (txnType === "OUT" && qty > availableStock) {
      showToast(`❌ Pengeluaran gagal: Jumlah keluar (${DataService.formatStock(qty, selectedItem.unit)}) melebihi sisa stok (${DataService.formatStock(availableStock, selectedItem.unit)})!`, "error");
      return;
    }

    const date = document.getElementById("inputDate")?.value || new Date().toISOString().split("T")[0];
    const currentUser = AuthService.getCurrentUser();
    const staff = (currentUser && currentUser.name) ? currentUser.name : (document.getElementById("inputStaff")?.value.trim() || "Staff");
    const notes = document.getElementById("inputNotes")?.value.trim() || "-";

    const overlay = document.getElementById("confirmDialog");
    const summaryEl = document.getElementById("confirmSummary");

    const canViewMoney = AuthService.canViewMoney();
    const totalNilai = qty * (Number(selectedItem.price) || 0);

    summaryEl.innerHTML = `
      <div class="dialog-summary-row"><span>Barang:</span><strong>${esc(selectedItem.name)}</strong></div>
      <div class="dialog-summary-row"><span>Devisi:</span>${getDivisionBadge(selectedItem.division)}</div>
      <div class="dialog-summary-row"><span>Tipe Mutasi:</span><strong class="${txnType === 'IN' ? 'text-success' : 'text-danger'}">${txnType === 'IN' ? '📥 Stok Masuk' : '📤 Stok Keluar'}</strong></div>
      <div class="dialog-summary-row"><span>Jumlah:</span><strong>${qty} ${esc(selectedItem.unit)}</strong></div>
      ${canViewMoney ? `
      <div class="dialog-summary-row"><span>Harga Satuan:</span><strong>${DataService.formatRupiah(selectedItem.price)}</strong></div>
      <div class="dialog-summary-row"><span>Total Nilai (Rp):</span><strong style="color:var(--primary); font-size:1.05rem;">${DataService.formatRupiah(totalNilai)}</strong></div>
      ` : ''}
      <div class="dialog-summary-row"><span>Sisa Stok Fisik:</span><strong>${selectedItem.stock.toLocaleString("id-ID")} ${esc(selectedItem.unit)}</strong></div>
      <div class="dialog-summary-row"><span>Tanggal:</span><strong>${date}</strong></div>
      <div class="dialog-summary-row"><span>Petugas / PIC:</span><strong>${esc(staff)}</strong></div>
      <div class="dialog-summary-row"><span>Catatan:</span><strong>${esc(notes)}</strong></div>
    `;

    overlay.classList.add("show");

    // Bind confirm action
    document.getElementById("btnConfirmYes").onclick = () => {
      overlay.classList.remove("show");
      doSaveTransaction({ itemId: selectedItem.id, type: txnType, qty, date, staff, notes });
    };
    document.getElementById("btnConfirmNo").onclick = () => {
      overlay.classList.remove("show");
    };
  }

  let isSavingTransaction = false;

  function doSaveTransaction(data) {
    if (isSavingTransaction) return; // Mencegah double click / transaksi ganda
    isSavingTransaction = true;

    const btnYes = document.getElementById("btnConfirmYes");
    if (btnYes) {
      btnYes.disabled = true;
      btnYes.textContent = "⏳ Menyimpan...";
    }

    setTimeout(() => {
      const result = DataService.saveTransaction(data);
      isSavingTransaction = false;
      if (btnYes) {
        btnYes.disabled = false;
        btnYes.textContent = "✅ Ya, Simpan";
      }

      if (result.success) {
        showToast(result.message, "success");
        selectedItem = null;
        txnType = "IN";
        renderInputForm();
        updateLowStockBadge();
      } else {
        showToast(result.message, "error");
      }
    }, 100);
  }

  // ── HISTORY ───────────────────────────────────────────────────────
  const _todayIso = new Date().toISOString().split("T")[0];
  let historyFilter = "ALL";
  let historyStartDate = _todayIso;
  let historyEndDate = _todayIso;
  let historyStaff = "ALL";

  function renderHistory() {
    const todayStr = new Date().toISOString().split("T")[0];
    if (!historyStartDate && !historyEndDate) {
      historyStartDate = todayStr;
      historyEndDate = todayStr;
    }

    const container = document.getElementById("historyContent");
    if (!container) return;

    const isAdmin = AuthService.canViewMoney();
    const staffList = DataService.getStaffList();

    container.innerHTML = `
      <!-- Filter Card -->
      <div class="history-filter-card">
        <!-- Date Quick Chips -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:4px;">
          <span class="filter-input-label">📅 RENTANG TANGGAL:</span>
          <div class="chip-row" style="margin-bottom:0; gap:4px;">
            <button class="chip hist-date-chip ${historyStartDate === todayStr && historyEndDate === todayStr ? 'active' : ''}" id="preset_TODAY" onclick="App.setHistoryDatePreset('TODAY')" style="padding:3px 8px; font-size:.72rem;">Hari Ini</button>
            <button class="chip hist-date-chip" id="preset_7DAYS" onclick="App.setHistoryDatePreset('7DAYS')" style="padding:3px 8px; font-size:.72rem;">7 Hari</button>
            <button class="chip hist-date-chip" id="preset_MONTH" onclick="App.setHistoryDatePreset('MONTH')" style="padding:3px 8px; font-size:.72rem;">Bulan Ini</button>
            <button class="chip hist-date-chip ${!historyStartDate && !historyEndDate ? 'active' : ''}" id="preset_ALL" onclick="App.setHistoryDatePreset('ALL')" style="padding:3px 8px; font-size:.72rem;">Semua</button>
          </div>
        </div>

        <!-- Date Inputs (Default Hari Ini) -->
        <div class="date-range-row">
          <div class="filter-input-wrap">
            <label class="filter-input-label" for="histStartDate">Dari Tanggal</label>
            <input type="date" id="histStartDate" class="filter-date-input" value="${historyStartDate}" onchange="App.handleHistoryDateChange()">
          </div>
          <div class="filter-input-wrap">
            <label class="filter-input-label" for="histEndDate">Sampai Tanggal</label>
            <input type="date" id="histEndDate" class="filter-date-input" value="${historyEndDate}" onchange="App.handleHistoryDateChange()">
          </div>
        </div>

        <!-- Filter Nama Karyawan (KHUSUS ADMIN ONLY) -->
        ${isAdmin ? `
        <div class="filter-input-wrap" style="margin-top:8px; padding-top:8px; border-top:1px dashed rgba(0,0,0,0.12);">
          <label class="filter-input-label" for="histStaffSelect" style="color:var(--primary); font-weight:700;">
            👤 FILTER KARYAWAN (ADMIN ONLY):
          </label>
          <select id="histStaffSelect" class="filter-select-input" onchange="App.handleHistoryStaffChange(this.value)">
            <option value="ALL" ${historyStaff === 'ALL' ? 'selected' : ''}>-- Semua Karyawan / Staf --</option>
            ${staffList.map(s => `<option value="${esc(s)}" ${historyStaff === s ? 'selected' : ''}>${esc(s)}</option>`).join("")}
          </select>
        </div>
        ` : ''}
      </div>

      <!-- Action & Type Bar -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; gap:8px;">
        <div class="chip-row" style="margin-bottom:0;">
          <button class="chip ${historyFilter === 'ALL' ? 'active' : ''}" id="histAll" onclick="App.filterHistory('ALL')">Semua</button>
          <button class="chip ${historyFilter === 'IN' ? 'active' : ''}" id="histIn" onclick="App.filterHistory('IN')">📥 Masuk</button>
          <button class="chip ${historyFilter === 'OUT' ? 'active' : ''}" id="histOut" onclick="App.filterHistory('OUT')">📤 Keluar</button>
        </div>
        <button type="button" class="btn btn-outline" style="font-size:.74rem; padding:6px 10px; display:flex; align-items:center; gap:4px; white-space:nowrap;" onclick="DataService.exportTransactionsToCSV()">
          <span>📥</span> CSV
        </button>
      </div>

      <div class="txn-list" id="historyList"></div>
    `;

    applyHistoryFilters();
  }

  function applyHistoryFilters() {
    const list = document.getElementById("historyList");
    if (!list) return;

    const txns = DataService.getFilteredTransactions({
      type: historyFilter,
      startDate: historyStartDate,
      endDate: historyEndDate,
      staff: historyStaff,
      limit: 300
    });

    renderHistoryList(txns);
  }

  function filterHistory(type) {
    historyFilter = type;
    document.getElementById("histAll")?.classList.toggle("active", type === "ALL");
    document.getElementById("histIn")?.classList.toggle("active", type === "IN");
    document.getElementById("histOut")?.classList.toggle("active", type === "OUT");
    applyHistoryFilters();
  }

  function setHistoryDatePreset(preset) {
    const today = new Date();
    const todayIso = today.toISOString().split("T")[0];

    if (preset === "TODAY") {
      historyStartDate = todayIso;
      historyEndDate = todayIso;
    } else if (preset === "7DAYS") {
      const past = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
      historyStartDate = past.toISOString().split("T")[0];
      historyEndDate = todayIso;
    } else if (preset === "MONTH") {
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      historyStartDate = `${year}-${month}-01`;
      historyEndDate = todayIso;
    } else if (preset === "ALL") {
      historyStartDate = "";
      historyEndDate = "";
    }

    const startInput = document.getElementById("histStartDate");
    const endInput = document.getElementById("histEndDate");
    if (startInput) startInput.value = historyStartDate;
    if (endInput) endInput.value = historyEndDate;

    document.querySelectorAll(".hist-date-chip").forEach(c => c.classList.remove("active"));
    const activeChip = document.getElementById(`preset_${preset}`);
    if (activeChip) activeChip.classList.add("active");

    applyHistoryFilters();
  }

  function handleHistoryDateChange() {
    const startInput = document.getElementById("histStartDate");
    const endInput = document.getElementById("histEndDate");
    historyStartDate = startInput ? startInput.value : "";
    historyEndDate = endInput ? endInput.value : "";
    document.querySelectorAll(".hist-date-chip").forEach(c => c.classList.remove("active"));
    applyHistoryFilters();
  }

  function handleHistoryStaffChange(staffVal) {
    historyStaff = staffVal;
    applyHistoryFilters();
  }

  function navigateToHistory(filter = "ALL") {
    navigateTo("history");
    if (filter && filter !== "ALL") {
      filterHistory(filter);
    }
  }

  function renderHistoryList(txns) {
    const list = document.getElementById("historyList");
    if (!list) return;

    if (txns.length === 0) {
      let filterDesc = [];
      if (historyStartDate && historyEndDate) {
        if (historyStartDate === historyEndDate) filterDesc.push(`tanggal ${historyStartDate}`);
        else filterDesc.push(`periode ${historyStartDate} s/d ${historyEndDate}`);
      }
      if (historyStaff !== "ALL") filterDesc.push(`karyawan "${historyStaff}"`);
      if (historyFilter !== "ALL") filterDesc.push(`tipe ${historyFilter}`);

      const descText = filterDesc.length > 0 ? filterDesc.join(", ") : "filter saat ini";

      list.innerHTML = `
        <div class="empty-state" style="padding:28px 16px;">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-text" style="font-weight:700; margin-bottom:6px;">Tidak ada transaksi untuk ${descText}</div>
          <p style="font-size:.8rem; color:var(--on-surface-variant); margin-bottom:12px;">
            ${historyStartDate === new Date().toISOString().split("T")[0] ? 'Belum ada transaksi diinput hari ini.' : 'Coba ubah tanggal atau bersihkan filter pencarian.'}
          </p>
          <div style="display:flex; justify-content:center; gap:8px;">
            <button type="button" class="btn btn-outline" style="font-size:.78rem; padding:6px 12px;" onclick="App.setHistoryDatePreset('MONTH')">📆 Cek Bulan Ini</button>
            <button type="button" class="btn btn-outline" style="font-size:.78rem; padding:6px 12px;" onclick="App.setHistoryDatePreset('ALL')">Lihat Semua Tanggal</button>
          </div>
        </div>
      `;
      return;
    }

    list.innerHTML = txns.map(renderTxnRow).join("");
  }

  function renderTxnRow(txn) {
    const isIn = txn.type === "IN";
    const canViewMoney = AuthService.canViewMoney();
    const canEditMutation = AuthService.isAdmin() || AuthService.isSuperAdmin();
    const totalRp = Number(txn.totalRupiah) || ((Number(txn.qty) || 0) * (Number(txn.unitPrice) || 0));
    const wasEdited = !!txn.editedBy;

    return `
      <div class="txn-row" style="flex-direction:column; align-items:stretch; gap:6px;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
          <div style="display:flex; align-items:center; gap:10px; flex:1;">
            <div class="txn-icon ${isIn ? 'in' : 'out'}">${isIn ? '📥' : '📤'}</div>
            <div class="txn-body">
              <div class="txn-title">${esc(txn.itemName)}</div>
              <div class="txn-detail">
                ${getDivisionBadge(txn.division)}
                ${esc(txn.staff)} · ${esc(txn.notes)}
                ${(canViewMoney && totalRp > 0) ? `<br><strong style="color:var(--primary); font-size:.76rem;">Nilai: ${DataService.formatRupiah(totalRp)}</strong>` : ''}
              </div>
            </div>
          </div>
          <div class="txn-right" style="display:flex; flex-direction:column; align-items:flex-end;">
            <div class="txn-qty ${isIn ? 'in' : 'out'}">${isIn ? '+' : '-'}${DataService.parseQuantity(txn.qty).toLocaleString("id-ID", { maximumFractionDigits: 3 })}</div>
            <div class="txn-date">${txn.date}</div>
            ${canEditMutation ? `
            <button type="button" class="btn btn-outline btn-sm" style="font-size:.7rem; padding:3px 8px; margin-top:4px;" onclick="App.openEditMutationDialog('${txn.id}')" title="Koreksi Mutasi Ini (Admin Only)">
              ✏️ Koreksi
            </button>
            ` : ''}
          </div>
        </div>

        ${wasEdited ? `
        <div style="background:#fff8e1; border-left:3px solid #f57f17; border-radius:4px; padding:4px 8px; font-size:.72rem; color:#5d4037; margin-top:2px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:4px;">
          <span>✏️ <strong>Koreksi:</strong> dari <strong>${txn.originalQty}</strong> ke <strong>${txn.qty}</strong> (Diedit oleh: <strong>${esc(txn.editedBy)}</strong>)</span>
          ${txn.editReason ? `<span style="font-style:italic; color:#795548;">"${esc(txn.editReason)}"</span>` : ''}
        </div>
        ` : ''}
      </div>
    `;
  }

  // ── ALERTS ────────────────────────────────────────────────────────
  function renderAlerts() {
    const lowItems = DataService.getLowStockItems();
    const container = document.getElementById("alertsContent");

    if (lowItems.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-text">Semua stok aman! Tidak ada peringatan.</div></div>`;
      return;
    }

    container.innerHTML = `
      <p class="text-muted mb-16" style="font-size:.85rem;">
        ⚠️ <strong>${lowItems.length}</strong> item memiliki stok sama dengan atau di bawah batas minimum.
      </p>
      ${lowItems.map(it => renderAlertCard(it)).join("")}
    `;
  }

  function renderAlertCard(it) {
    const isDanger = it.stock === 0;
    return `
      <div class="alert-card ${isDanger ? 'danger-alert' : ''}" onclick="App.goToInputWithItem(${it.id})">
        <div class="alert-icon">${isDanger ? '🔴' : '🟡'}</div>
        <div class="alert-body">
          <div class="alert-title">${esc(it.name)}</div>
          <div class="alert-detail">
            ${getDivisionBadge(it.division)}
            Stok: <strong class="${isDanger ? 'text-danger' : 'text-warning'}">${DataService.formatStock(it.stock, it.unit)}</strong>
            · Min: ${DataService.formatStock(it.minStock, it.unit)}
          </div>
        </div>
      </div>
    `;
  }

  // ── SETTINGS (GANTI HARGA & TAMBAH BARANG) ───────────────────────
  let settingsActiveTab = "price";
  let selectedItemForPriceEdit = null;
  let newItemDivision = "KITCHEN";
  let selectedNewItemUnit = "Kg";
  let isCustomUnitActive = false;
  let customUnitValue = "";

  function getEffectiveUnit() {
    if (isCustomUnitActive) {
      return customUnitValue.trim();
    }
    return selectedNewItemUnit || "Kg";
  }

  let selectedNewUserRole = "staff";
  let selectedNewUserDivision = "KITCHEN";
  let isEditingItemName = false;

  function toggleEditItemName() {
    isEditingItemName = !isEditingItemName;
    const wrap = document.getElementById("wrapEditItemName");
    const btn = document.getElementById("btnToggleEditName");
    const input = document.getElementById("inputEditItemName");

    if (wrap) wrap.style.display = isEditingItemName ? "block" : "none";
    if (btn) {
      btn.innerHTML = isEditingItemName ? "✕ Batal Ubah" : "✏️ Ubah Nama";
      btn.classList.toggle("btn-outline", !isEditingItemName);
    }
    if (isEditingItemName && input) {
      if (selectedItemForPriceEdit) input.value = selectedItemForPriceEdit.name;
      input.focus();
      input.select();
    } else if (!isEditingItemName && input && selectedItemForPriceEdit) {
      input.value = selectedItemForPriceEdit.name;
    }
  }

  function setNewUserDivisionSelection(div) {
    selectedNewUserDivision = (div || "KITCHEN").toUpperCase();
    selectedNewUserRole = selectedNewUserDivision === "ADMIN" ? "admin" : "staff";
    ["ADMIN", "BAR", "KITCHEN", "PASTRY"].forEach(d => {
      const btn = document.getElementById("btnNewDiv" + d);
      if (btn) {
        btn.classList.toggle("active", d === selectedNewUserDivision);
      }
    });
  }

  function setNewUserRoleSelection(role) {
    selectedNewUserRole = role;
    if (role === "admin") {
      setNewUserDivisionSelection("ADMIN");
    } else {
      if (selectedNewUserDivision === "ADMIN") {
        setNewUserDivisionSelection("KITCHEN");
      }
    }
  }

  function renderSettings() {
    const container = document.getElementById("settingsContent");
    if (!container) return;

    const isSuper = AuthService.isSuperAdmin();
    const isAdmin = AuthService.isAdmin();

    // Pastikan tab aktif sesuai peran: Super Admin Satian fokus pada Kelola Karyawan & Integrasi
    if (isSuper) {
      if (settingsActiveTab !== "users" && settingsActiveTab !== "sheets" && settingsActiveTab !== "backup") {
        settingsActiveTab = "users";
      }
    } else {
      if (settingsActiveTab === "users" || settingsActiveTab === "sheets") {
        settingsActiveTab = "price";
      }
    }

    container.innerHTML = `
      <!-- Sub-Tab Switcher -->
      <div class="chip-row mb-16">
        ${!isSuper ? `
        <button class="chip ${settingsActiveTab === 'price' ? 'active' : ''}" onclick="App.setSettingsTab('price')">
          🏷️ Ubah Nama & Harga Barang
        </button>
        <button class="chip ${settingsActiveTab === 'add-item' ? 'active' : ''}" onclick="App.setSettingsTab('add-item')">
          ➕ Tambah Barang Baru
        </button>
        ` : `
        <button class="chip ${settingsActiveTab === 'users' ? 'active' : ''}" onclick="App.setSettingsTab('users')">
          👥 Kelola Karyawan
        </button>
        <button class="chip ${settingsActiveTab === 'sheets' ? 'active' : ''}" onclick="App.setSettingsTab('sheets')">
          🔗 Integrasi Spreadsheet
        </button>
        `}
        <button class="chip ${settingsActiveTab === 'backup' ? 'active' : ''}" onclick="App.setSettingsTab('backup')">
          📊 Laporan & Reset
        </button>
      </div>

      ${!isSuper ? `
      <!-- Tab 1: Ubah Nama & Harga Barang (Khusus Admin Only) -->
      <div id="settingsTabPrice" style="display: ${settingsActiveTab === 'price' ? 'block' : 'none'};">
        <div class="card">
          <div class="card-body">
            <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 4px;">🏷️ Ubah Nama & Harga Satuan Barang</h3>
            <p style="font-size: .8rem; color: var(--on-surface-variant); margin-bottom: 14px;">
              Cari nama barang di bawah untuk mengoreksi nama (typo) atau memperbarui harga satuan barang.
            </p>

            ${!isAdmin ? `
            <div class="empty-state" style="padding:24px 16px; background:#fff3e0; border-radius:8px;">
              <div class="empty-state-icon" style="font-size:2rem;">🔒</div>
              <div class="empty-state-text" style="font-weight:700; color:#e65100;">Akses Khusus Admin</div>
              <p style="font-size:.82rem; color:var(--on-surface-variant); margin-top:4px;">
                Pengubahan nama barang dan harga satuan hanya dapat dilakukan oleh akun Admin (Ragil / Angel).
              </p>
            </div>
            ` : `
            <!-- Search Item for Edit -->
            <div class="form-group">
              <label class="form-label">Cari Barang</label>
              <div class="search-wrap">
                <span class="search-icon">🔍</span>
                <input type="text" class="search-input" id="priceSearchInput"
                       placeholder="Masukan nama item"
                       oninput="App.handlePriceSearch(this.value)"
                       autocomplete="off">
                <button class="search-clear" id="priceSearchClear" onclick="App.clearPriceSearch()">✕</button>
                <div class="autocomplete-dropdown" id="priceSearchDropdown"></div>
              </div>
            </div>

            <!-- Edit Box (Muncul saat item dipilih) -->
            <div id="priceEditBox" style="display: none; background: var(--surface-dim); border: 1.5px solid var(--outline-variant); border-radius: var(--radius-md); padding: 14px; margin-top: 14px;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                <div>
                  <h4 id="editPriceItemName" style="font-size: 1.05rem; font-weight: 800; color: var(--primary);">-</h4>
                  <div id="editPriceItemMeta" style="font-size: .78rem; color: var(--on-surface-variant); margin-top: 2px;">-</div>
                </div>
                <button type="button" class="btn-icon" style="width:32px;height:32px;font-size:.9rem;" onclick="App.clearPriceSearch()">✕</button>
              </div>

              <!-- Nama Barang: Default Readonly / Text Biasa + Tombol Ubah Nama -->
              <div class="form-group" style="margin-bottom: 12px; background: #fff; padding: 10px 12px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.08);">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <label class="filter-input-label" style="font-size:.7rem; color:var(--on-surface-variant); display:block; margin-bottom:2px;">Nama Barang:</label>
                    <div id="editDisplayName" style="font-size: 1rem; font-weight: 700; color: var(--on-surface);">-</div>
                  </div>
                  <button type="button" id="btnToggleEditName" class="btn btn-outline" style="font-size: .74rem; padding: 4px 10px; border-radius: 6px; white-space:nowrap;" onclick="App.toggleEditItemName()">
                    ✏️ Ubah Nama
                  </button>
                </div>

                <!-- Textbox Koreksi Nama: Default Tersembunyi (Hanya muncul saat tombol Ubah Nama diklik) -->
                <div id="wrapEditItemName" style="display: none; margin-top: 10px; padding-top: 8px; border-top: 1px dashed rgba(0,0,0,0.12);">
                  <label class="form-label" style="font-size:.76rem; color:var(--primary); font-weight:700;">
                    Koreksi Nama Barang (Typo) <span class="text-danger">*</span>
                  </label>
                  <div class="form-input-icon-wrap">
                    <span class="form-input-icon">✏️</span>
                    <input type="text" id="inputEditItemName" class="form-input" placeholder="Masukkan nama baru" style="font-size: .95rem; font-weight: 700;">
                  </div>
                  <div style="font-size:.7rem; color:var(--on-surface-variant); margin-top:3px;">
                    Koreksi kesalahan ketik (typo). Nama baru otomatis tersinkron ke katalog & riwayat transaksi.
                  </div>
                </div>
              </div>

              <!-- Harga Satuan Saat Ini -->
              <div class="form-group" style="margin-bottom: 12px;">
                <label class="form-label" style="font-size:.8rem;">Harga Satuan Saat Ini:</label>
                <div id="editPriceCurrent" style="font-size: 1.15rem; font-weight: 800; color: var(--on-surface-variant);">-</div>
              </div>

              <!-- Harga Satuan Baru -->
              <div class="form-group" style="margin-bottom: 12px;">
                <label class="form-label">Harga Satuan Baru (Rp) <span class="text-danger">*</span></label>
                <div class="form-input-icon-wrap">
                  <span class="form-input-icon">💰</span>
                  <input type="number" id="inputNewPrice" class="form-input" min="0" step="50" placeholder="Contoh: 45000" style="font-size: 1.05rem; font-weight: 700;">
                </div>
              </div>

              <!-- Kategori / Divisi Barang -->
              <div class="form-group" style="margin-bottom: 16px;">
                <label class="form-label" style="font-size:.8rem;">Kategori / Divisi <span class="text-danger">*</span></label>
                <div class="type-toggle" style="display:flex; flex-wrap:wrap; gap:6px;">
                  <button type="button" id="editDivKitchen" class="type-btn type-in" onclick="App.setEditItemDivision('KITCHEN')">
                    🍳 Kitchen
                  </button>
                  <button type="button" id="editDivBar" class="type-btn type-out" onclick="App.setEditItemDivision('BAR')">
                    ☕ Barista
                  </button>
                  <button type="button" id="editDivPastry" class="type-btn type-pastry" onclick="App.setEditItemDivision('PASTRY')">
                    🍰 Pastry
                  </button>
                  <button type="button" id="editDivLainnya" class="type-btn type-lainnya" onclick="App.setEditItemDivision('LAINNYA')">
                    📦 Lain-Lain
                  </button>
                </div>
              </div>

              <button type="button" class="btn btn-primary btn-block" onclick="App.saveItemEdits()">
                💾 Simpan Perubahan Barang
              </button>
            </div>
            `}
          </div>
        </div>

        ${isAdmin ? `
        <!-- Quick Items List for edit -->
        <div class="section-header mt-16">
          <span class="section-title">📋 Daftar Barang (Pilih Langsung)</span>
        </div>
        <div class="item-list" id="quickPriceList">
          ${renderQuickPriceList()}
        </div>
        ` : ''}
      </div>

      <!-- Tab 2: Tambah Barang Baru -->
      <div id="settingsTabAddItem" style="display: ${settingsActiveTab === 'add-item' ? 'block' : 'none'};">
        <div class="card">
          <div class="card-body">
            <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 4px;">➕ Tambah Barang Baru</h3>
            <p style="font-size: .8rem; color: var(--on-surface-variant); margin-bottom: 16px;">
              Item baru otomatis masuk ke katalog dan bisa langsung diinput mutasi stoknya.
            </p>

            <form onsubmit="App.saveNewItem(event)">
              <!-- Nama Barang -->
              <div class="form-group">
                <label class="form-label">Nama Bahan / Barang <span class="text-danger">*</span></label>
                <input type="text" id="newItemName" class="form-input" placeholder="Contoh: Jamur Enoki, Sirup Vanilla..." required autocomplete="off">
              </div>

              <!-- Devisi -->
              <div class="form-group">
                <label class="form-label">Devisi / Kategori <span class="text-danger">*</span></label>
                <div class="type-toggle" style="display:flex; flex-wrap:wrap; gap:6px;">
                  <button type="button" id="btnDivKitchen" class="type-btn type-in ${newItemDivision === 'KITCHEN' ? 'active' : ''}" onclick="App.setNewItemDivision('KITCHEN')">
                    🍳 Kitchen
                  </button>
                  <button type="button" id="btnDivBar" class="type-btn type-out ${newItemDivision === 'BAR' ? 'active' : ''}" onclick="App.setNewItemDivision('BAR')">
                    ☕ Barista
                  </button>
                  <button type="button" id="btnDivPastry" class="type-btn type-pastry ${newItemDivision === 'PASTRY' ? 'active' : ''}" onclick="App.setNewItemDivision('PASTRY')">
                    🍰 Pastry
                  </button>
                  <button type="button" id="btnDivLainnya" class="type-btn type-lainnya ${newItemDivision === 'LAINNYA' ? 'active' : ''}" onclick="App.setNewItemDivision('LAINNYA')">
                    📦 Lain-Lain
                  </button>
                </div>
              </div>

              <!-- Satuan Barang (Tombol Pilihan Lengkap, Tanpa Input Text Normal) -->
              <div class="form-group">
                <label class="form-label">Satuan Barang <span class="text-danger">*</span></label>
                
                <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px;" id="unitButtonsContainer">
                  ${renderUnitPillButtons()}
                </div>

                <!-- Input Text Manual: HANYA MUNCUL JIKA "Lainnya..." DIKLIK -->
                <div id="customUnitBox" style="display: ${isCustomUnitActive ? 'block' : 'none'}; margin-top: 8px;">
                  <input type="text" id="newItemCustomUnit" class="form-input" 
                         placeholder="Tulis satuan manual, misal: Galon, Dus, Cup, Porsi..." 
                         value="${esc(customUnitValue)}"
                         oninput="App.handleCustomUnitInput(this.value)">
                </div>

                <div style="font-size: .78rem; color: var(--on-surface-variant); margin-top: 4px;">
                  Satuan dipilih: <strong id="unitSelectedLabel" style="color: var(--primary); font-size: .85rem;">${esc(getEffectiveUnit() || 'Belum dipilih')}</strong>
                </div>
              </div>

              <!-- Harga Satuan -->
              <div class="form-group">
                <label class="form-label">Harga Satuan (Rp) <span class="text-danger">*</span></label>
                <div class="form-input-icon-wrap">
                  <span class="form-input-icon">💰</span>
                  <input type="number" id="newItemPrice" class="form-input" placeholder="0" min="0" step="50" required>
                </div>
              </div>

              <!-- Stok Awal & Batas Minimum -->
              <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div class="form-group">
                  <label class="form-label">Stok Awal</label>
                  <input type="number" id="newItemStock" class="form-input" placeholder="0" min="0" step="any" value="0">
                </div>
                <div class="form-group">
                  <label class="form-label">Batas Min Stok</label>
                  <input type="number" id="newItemMinStock" class="form-input" placeholder="Contoh: 5" min="0" step="any" value="2">
                </div>
              </div>

              <!-- Submit Button -->
              <button type="submit" class="btn btn-primary btn-block mt-8">
                ➕ Simpan Barang ke Katalog
              </button>
            </form>
          </div>
        </div>
      </div>
      ` : ''}

      <!-- Tab 3: Kelola Karyawan (Hanya untuk Super Admin Satian) -->
      ${isSuper ? `
      <div id="settingsTabUsers" style="display: ${settingsActiveTab === 'users' ? 'block' : 'none'};">
        ${renderUserManagementTab()}
      </div>

      <!-- Tab Khusus Super Admin Satian: Integrasi Spreadsheet -->
      <div id="settingsTabSheets" style="display: ${settingsActiveTab === 'sheets' ? 'block' : 'none'};">
        <div class="card mb-16" style="border: 1.5px solid #2e7d32; overflow: visible;">
          <div class="card-body">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
              <h3 style="font-size: 1rem; font-weight: 700; color: #1b5e20;">🔗 Integrasi Google Sheets (Super Admin Satian)</h3>
              <span id="gasSyncBadge" class="badge" style="background:${DataService.getGasUrl() ? '#e8f5e9' : '#f5f5f5'}; color:${DataService.getGasUrl() ? '#2e7d32' : '#757575'}; font-size:.72rem;">
                ${DataService.getGasUrl() ? '🟢 Terhubung Aktif' : '⚪ Belum Terhubung'}
              </span>
            </div>
            <p style="font-size: .8rem; color: var(--on-surface-variant); margin-bottom: 12px;">
              Hanya akun <b>Super Admin (Satian)</b> yang berwenang mengatur dan mengganti link tujuan spreadsheet. Seluruh transaksi mutasi stok staf kitchen, bar, dan pastry akan otomatis masuk ke Google Sheets ini secara real-time.
            </p>

            <div class="form-group mb-8">
              <label class="form-label" style="font-size:.78rem; font-weight:600;">URL Web App Google Apps Script Aktif</label>
              <input type="url" id="inputGasUrl" class="form-input" style="font-size:.78rem;" placeholder="https://script.google.com/macros/s/.../exec" value="${DataService.getGasUrl()}">
            </div>

            <div style="display:flex; gap:8px; margin-bottom: 12px;">
              <button type="button" class="btn btn-outline" style="flex:1; padding:10px; font-size:.82rem; font-weight:600;" onclick="App.testGasConnectionUI()">
                🔌 Tes Koneksi
              </button>
              <button type="button" class="btn btn-primary" style="flex:1; padding:10px; font-size:.82rem; font-weight:700;" onclick="App.saveGasUrlUI()">
                💾 Simpan URL
              </button>
            </div>

            ${DataService.getPendingSyncCount() > 0 ? `
            <div style="background:#fff3e0; border-radius:6px; padding:8px 12px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:.75rem; color:#e65100;">⚠️ ${DataService.getPendingSyncCount()} transaksi offline menunggu sinyal</span>
              <button type="button" class="btn btn-outline" style="font-size:.72rem; padding:4px 8px;" onclick="App.flushPendingSyncUI()">Kirim Sekarang</button>
            </div>
            ` : ''}

            <!-- Panduan Ganti ke Sheet Asli Rimba Alam -->
            <div style="background: #f1f8e9; border: 1px dashed #7cb342; border-radius: 8px; padding: 12px; margin-top: 10px;">
              <div style="font-weight: 700; font-size: .82rem; color: #2e7d32; margin-bottom: 4px;">
                💡 Cara Ganti ke Spreadsheet Asli Rimba Alam Nanti:
              </div>
              <ol style="margin: 0; padding-left: 18px; font-size: .78rem; color: var(--on-surface-variant); line-height: 1.5;">
                <li>Buka Spreadsheet Asli Rimba Alam di browser.</li>
                <li>Klik <b>Ekstensi</b> ➔ <b>Apps Script</b>.</li>
                <li>Paste kode <code>google-apps-script-sync.js</code> ➔ Simpan (💾).</li>
                <li>Klik <b>Deploy</b> ➔ <b>New deployment</b> ➔ Web app ➔ Siapa saja (Anyone) ➔ Deploy.</li>
                <li>Copy URL baru yang berakhiran <code>/exec</code>, paste ke kotak di atas, lalu klik <b>Simpan URL</b>. Selesai! Semua mutasi otomatis pindah ke sheet asli.</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
      ` : ''}

      <!-- Tab 4: Laporan & Reset Data -->
      <div id="settingsTabBackup" style="display: ${settingsActiveTab === 'backup' ? 'block' : 'none'};">
        <div class="card mb-16">
          <div class="card-body">
            <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 4px;">📥 Unduh Laporan Rekap (Excel / CSV)</h3>
            <p style="font-size: .8rem; color: var(--on-surface-variant); margin-bottom: 14px;">
              Ekspor seluruh data katalog stok fisik atau riwayat mutasi ke format CSV yang kompatibel dengan Microsoft Excel & Google Sheets.
            </p>
            <div style="display:flex; flex-direction:column; gap:10px;">
              <button type="button" class="btn btn-outline btn-block" style="display:flex; align-items:center; justify-content:center; gap:8px; padding:12px; font-weight:600;" onclick="DataService.exportItemsToCSV()">
                <span>📦</span> Unduh Katalog Semua Barang (CSV)
              </button>
              <button type="button" class="btn btn-outline btn-block" style="display:flex; align-items:center; justify-content:center; gap:8px; padding:12px; font-weight:600;" onclick="DataService.exportTransactionsToCSV()">
                <span>🕒</span> Unduh Riwayat Transaksi Stok (CSV)
              </button>
            </div>
          </div>
        </div>

        <div class="card" style="border: 1.5px solid var(--danger);">
          <div class="card-body">
            <h3 style="font-size: 1rem; font-weight: 700; color: var(--danger); margin-bottom: 4px;">🔄 Reset ke Data Asli Spreadsheet</h3>
            <p style="font-size: .8rem; color: var(--on-surface-variant); margin-bottom: 14px;">
              Gunakan tombol ini jika Anda selesai mencoba-coba data dan ingin mengembalikan semua stok dan transaksi ke kondisi bersih asli Google Sheets (Oktober 2026).
            </p>
            <button type="button" class="btn btn-block" style="background:var(--danger); color:white; padding:12px; font-weight:700;" onclick="App.handleResetData()">
              ⚠️ Reset Semua Data ke Default Asli
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderUserManagementTab() {
    const users = AuthService.getAllUsers();
    return `
      <!-- Form Tambah User -->
      <div class="card mb-16">
        <div class="card-body">
          <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 4px;">👥 Tambah Karyawan Baru</h3>
          <p style="font-size: .8rem; color: var(--on-surface-variant); margin-bottom: 14px;">
            Super Admin dapat mendaftarkan akun karyawan baru, menentukan kategori divisi kerja, dan menetapkan PIN.
          </p>
          <form onsubmit="App.handleAddNewUser(event)">
            <div class="form-group">
              <label class="form-label">Nama Karyawan <span class="text-danger">*</span></label>
              <input type="text" id="newUserName" class="form-input" placeholder="Contoh: Budi, Sari, Rey..." required autocomplete="off">
            </div>
            <div class="form-group">
              <label class="form-label">PIN Karyawan (min. 4 angka) <span class="text-danger">*</span></label>
              <input type="password" id="newUserPin" class="form-input" placeholder="Default: 1234" value="1234" inputmode="numeric" required>
            </div>
            <div class="form-group">
              <label class="form-label">Kategori / Divisi Karyawan <span class="text-danger">*</span></label>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <button type="button" id="btnNewDivADMIN" class="type-btn ${selectedNewUserDivision === 'ADMIN' ? 'active' : ''}" style="border:1px solid #c5cae9; font-size:.78rem; padding:8px 4px; ${selectedNewUserDivision === 'ADMIN' ? 'background:#e8eaf6; color:#283593; font-weight:700;' : ''}" onclick="App.setNewUserDivisionSelection('ADMIN')">
                  🛡️ Admin (Semua)
                </button>
                <button type="button" id="btnNewDivBAR" class="type-btn ${selectedNewUserDivision === 'BAR' ? 'active' : ''}" style="border:1px solid #b3e5fc; font-size:.78rem; padding:8px 4px; ${selectedNewUserDivision === 'BAR' ? 'background:#e0f2fe; color:#0369a1; font-weight:700;' : ''}" onclick="App.setNewUserDivisionSelection('BAR')">
                  ☕ Barista (Bar+Lain)
                </button>
                <button type="button" id="btnNewDivKITCHEN" class="type-btn ${selectedNewUserDivision === 'KITCHEN' ? 'active' : ''}" style="border:1px solid #c8e6c9; font-size:.78rem; padding:8px 4px; ${selectedNewUserDivision === 'KITCHEN' ? 'background:#e8f5e9; color:#2e7d32; font-weight:700;' : ''}" onclick="App.setNewUserDivisionSelection('KITCHEN')">
                  🍳 Kitchen (Dapur+Lain)
                </button>
                <button type="button" id="btnNewDivPASTRY" class="type-btn ${selectedNewUserDivision === 'PASTRY' ? 'active' : ''}" style="border:1px solid #e1bee7; font-size:.78rem; padding:8px 4px; ${selectedNewUserDivision === 'PASTRY' ? 'background:#f3e5f5; color:#6a1b9a; font-weight:700;' : ''}" onclick="App.setNewUserDivisionSelection('PASTRY')">
                  🍰 Pastry (Kue+Lain)
                </button>
              </div>
              <div class="form-hint" style="margin-top:8px; font-size:.74rem; line-height:1.4;">
                🛡️ <strong>Admin:</strong> Bebas input semua kategori (Kitchen, Barista, Pastry, Lain-Lain), tambah barang & ubah harga.<br>
                ☕ <strong>Barista:</strong> Hanya bisa input stok kategori Barista & Lain-Lain.<br>
                🍳 <strong>Kitchen:</strong> Hanya bisa input stok kategori Kitchen & Lain-Lain.<br>
                🍰 <strong>Pastry:</strong> Hanya bisa input stok kategori Pastry & Lain-Lain.
              </div>
            </div>
            <button type="submit" class="btn btn-primary btn-block mt-8">
              ➕ Daftarkan Karyawan
            </button>
          </form>
        </div>
      </div>

      <!-- List User Terdaftar -->
      <div class="section-header">
        <span class="section-title">📋 Daftar Karyawan Terdaftar (${users.length})</span>
      </div>
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${users.map(u => {
          const isSuper = u.role === "superadmin" || (u.username && u.username.toLowerCase() === "satian");
          const userDiv = (u.division || (u.role === 'admin' ? 'ADMIN' : 'KITCHEN')).toUpperCase();

          return `
            <div class="card" style="margin-bottom:0;">
              <div class="card-body" style="padding:12px; display:flex; flex-direction:column; gap:10px;">
                <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
                  <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:1.5rem;">${u.avatar || '👤'}</span>
                    <div>
                      <strong style="font-size:.9rem; display:block;">${esc(u.name)}</strong>
                      <div style="display:flex; align-items:center; gap:6px; margin-top:2px; flex-wrap:wrap;">
                        ${isSuper ? '<span class="badge" style="background:#e8f5e9; color:#1b5e20; font-weight:700;">👑 Super Admin</span>' : getDivisionBadge(userDiv)}
                        <span style="font-size:.7rem; color:var(--on-surface-variant);">ID: ${esc(u.username)}</span>
                        <span style="font-size:.7rem; color:var(--primary); font-weight:700;">PIN: ${esc(u.pin || '1234')}</span>
                      </div>
                    </div>
                  </div>

                  <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; justify-content:flex-end;">
                    <button type="button" class="btn btn-outline btn-sm" style="font-size:.74rem; padding:6px 10px; font-weight:600;"
                            onclick="App.openEditUserDialog('${u.username}')" title="Edit Nama, Reset PIN & Divisi">
                      ✏️ Edit
                    </button>
                    <button type="button" class="btn btn-outline btn-sm" style="font-size:.72rem; padding:6px 8px;"
                            onclick="App.openChangePinDialog('${u.username}')" title="Atur PIN Karyawan Ini">
                      🔑 PIN
                    </button>
                    ${!isSuper ? `
                    <button type="button" class="btn btn-outline btn-sm" style="font-size:.72rem; padding:6px 8px; color:var(--danger); border-color:var(--danger);"
                            onclick="App.handleDeleteUser('${u.username}', '${esc(u.name)}')">
                      🗑️
                    </button>
                    ` : ''}
                  </div>
                </div>

                ${!isSuper ? `
                <!-- Switcher Kategori Akun -->
                <div style="display:flex; align-items:center; justify-content:space-between; padding-top:6px; border-top:1px dashed var(--border-color); gap:8px;">
                  <label style="font-size:.72rem; color:var(--on-surface-variant); font-weight:600; white-space:nowrap;">Kategori Akun:</label>
                  <select class="filter-select-input" style="font-size:.75rem; padding:4px 8px; flex:1; max-width:220px;" onchange="App.handleChangeUserDivision('${u.username}', this.value)">
                    <option value="ADMIN" ${userDiv === 'ADMIN' ? 'selected' : ''}>🛡️ Admin (Semua Kategori)</option>
                    <option value="BAR" ${userDiv === 'BAR' ? 'selected' : ''}>☕ Barista (Bar + Lain-Lain)</option>
                    <option value="KITCHEN" ${userDiv === 'KITCHEN' ? 'selected' : ''}>🍳 Kitchen (Kitchen + Lain-Lain)</option>
                    <option value="PASTRY" ${userDiv === 'PASTRY' ? 'selected' : ''}>🍰 Pastry (Pastry + Lain-Lain)</option>
                    <option value="LAINNYA" ${userDiv === 'LAINNYA' ? 'selected' : ''}>📦 Lain-Lain</option>
                  </select>
                </div>
                ` : ''}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function handleAddNewUser(e) {
    e.preventDefault();
    const nameInput = document.getElementById("newUserName");
    const pinInput = document.getElementById("newUserPin");
    const name = nameInput ? nameInput.value.trim() : "";
    const pin = pinInput ? pinInput.value.trim() : "1234";
    if (!name) {
      showToast("Nama karyawan wajib diisi!", "error");
      return;
    }
    if (!pin || pin.length < 4) {
      showToast("PIN minimal 4 angka!", "error");
      return;
    }

    const overlay = document.getElementById("confirmDialog");
    const summaryEl = document.getElementById("confirmSummary");

    let divText = "🍳 Kitchen (Kitchen & Lain-Lain)";
    if (selectedNewUserDivision === "ADMIN") divText = "🛡️ Admin (Semua Kategori)";
    else if (selectedNewUserDivision === "BAR") divText = "☕ Barista (Bar & Lain-Lain)";
    else if (selectedNewUserDivision === "PASTRY") divText = "🍰 Pastry (Pastry & Lain-Lain)";

    summaryEl.innerHTML = `
      <div class="dialog-summary-row"><span>Aksi:</span><strong>➕ Tambah Karyawan Baru</strong></div>
      <div class="dialog-summary-row"><span>Nama:</span><strong>${esc(name)}</strong></div>
      <div class="dialog-summary-row"><span>Kategori:</span><strong>${divText}</strong></div>
      <div class="dialog-summary-row"><span>PIN Awal:</span><strong>${esc(pin)}</strong></div>
      <div class="dialog-summary-row"><span>Keterangan:</span><span>Karyawan ini dapat langsung login dengan nama "${esc(name)}" dan PIN "${esc(pin)}"</span></div>
    `;

    overlay.classList.add("show");

    document.getElementById("btnConfirmYes").onclick = () => {
      overlay.classList.remove("show");
      const res = AuthService.addUser(name, selectedNewUserDivision, pin);
      if (res.success) {
        showToast(res.message, "success");
        renderSettings();
      } else {
        showToast(res.message, "error");
      }
    };
    document.getElementById("btnConfirmNo").onclick = () => {
      overlay.classList.remove("show");
    };
  }

  function handleChangeUserDivision(username, newDiv) {
    const overlay = document.getElementById("confirmDialog");
    const summaryEl = document.getElementById("confirmSummary");

    let divLabel = formatDivisionName(newDiv);
    if (newDiv === "ADMIN") divLabel = "🛡️ Admin (Bisa input SEMUA kategori)";
    else if (newDiv === "BAR") divLabel = "☕ Barista (Hanya Bar & Lain-Lain)";
    else if (newDiv === "KITCHEN") divLabel = "🍳 Kitchen (Hanya Kitchen & Lain-Lain)";
    else if (newDiv === "PASTRY") divLabel = "🍰 Pastry (Hanya Pastry & Lain-Lain)";

    summaryEl.innerHTML = `
      <div class="dialog-summary-row"><span>Aksi:</span><strong>🔄 Ubah Kategori Karyawan</strong></div>
      <div class="dialog-summary-row"><span>Username:</span><strong>${esc(username)}</strong></div>
      <div class="dialog-summary-row"><span>Kategori Baru:</span><strong style="color:var(--primary); font-size:1.05rem;">${divLabel}</strong></div>
      <div class="dialog-summary-row"><span>Hak Akses:</span><span>Akses input stok karyawan ini akan langsung disesuaikan dengan kategori yang dipilih.</span></div>
    `;

    overlay.classList.add("show");

    document.getElementById("btnConfirmYes").onclick = () => {
      overlay.classList.remove("show");
      const res = AuthService.updateUserDivision(username, newDiv);
      if (res.success) {
        showToast(res.message, "success");
        renderSettings();
      } else {
        showToast(res.message, "error");
      }
    };
    document.getElementById("btnConfirmNo").onclick = () => {
      overlay.classList.remove("show");
      renderSettings(); // Re-render to revert dropdown selection if canceled
    };
  }

  function handleChangeUserRole(username, newRole) {
    const div = newRole === "admin" ? "ADMIN" : "KITCHEN";
    handleChangeUserDivision(username, div);
  }

  function handleDeleteUser(username, name) {
    const overlay = document.getElementById("confirmDialog");
    const summaryEl = document.getElementById("confirmSummary");

    summaryEl.innerHTML = `
      <div class="dialog-summary-row"><span>Aksi:</span><strong style="color:var(--danger);">🗑️ Hapus Karyawan</strong></div>
      <div class="dialog-summary-row"><span>Nama:</span><strong>${esc(name)}</strong></div>
      <div class="dialog-summary-row"><span>Username:</span><strong>${esc(username)}</strong></div>
      <div class="dialog-summary-row"><span>Peringatan:</span><span style="color:var(--danger);">Akun ini tidak akan dapat login lagi ke sistem.</span></div>
    `;

    overlay.classList.add("show");

    document.getElementById("btnConfirmYes").onclick = () => {
      overlay.classList.remove("show");
      const res = AuthService.deleteUser(username);
      if (res.success) {
        showToast(res.message, "success");
        renderSettings();
      } else {
        showToast(res.message, "error");
      }
    };
    document.getElementById("btnConfirmNo").onclick = () => {
      overlay.classList.remove("show");
    };
  }

  function renderUnitPillButtons() {
    const commonUnits = ["Kg", "Gram", "Liter", "Botol", "Pack", "Pcs", "Ekor", "Ikat", "Kaleng", "Carton", "Karung"];
    let html = commonUnits.map(u => {
      const isActive = (!isCustomUnitActive && selectedNewItemUnit === u);
      return `<button type="button" class="chip ${isActive ? 'active' : ''}" onclick="App.selectNewItemUnit('${u}')">${u}</button>`;
    }).join("");

    const isOtherActive = isCustomUnitActive;
    html += `<button type="button" class="chip ${isOtherActive ? 'active' : ''}" onclick="App.toggleCustomUnit()" style="${isOtherActive ? 'background:var(--secondary); color:#fff; border-color:var(--secondary);' : 'border-color:var(--secondary); color:var(--secondary);'}">➕ Lainnya...</button>`;
    return html;
  }

  function selectNewItemUnit(unit) {
    selectedNewItemUnit = unit;
    isCustomUnitActive = false;
    document.getElementById("unitButtonsContainer").innerHTML = renderUnitPillButtons();
    const customBox = document.getElementById("customUnitBox");
    if (customBox) customBox.style.display = "none";
    const label = document.getElementById("unitSelectedLabel");
    if (label) label.textContent = unit;
  }

  function toggleCustomUnit() {
    isCustomUnitActive = true;
    document.getElementById("unitButtonsContainer").innerHTML = renderUnitPillButtons();
    const customBox = document.getElementById("customUnitBox");
    if (customBox) {
      customBox.style.display = "block";
      const input = document.getElementById("newItemCustomUnit");
      if (input) {
        input.focus();
        if (!customUnitValue) customUnitValue = "";
      }
    }
    const label = document.getElementById("unitSelectedLabel");
    if (label) label.textContent = customUnitValue || "Ketik satuan manual...";
  }

  function handleCustomUnitInput(val) {
    customUnitValue = val;
    const label = document.getElementById("unitSelectedLabel");
    if (label) label.textContent = val.trim() || "Belum diisi";
  }

  function setSettingsTab(tab) {
    settingsActiveTab = tab;
    renderSettings();
  }

  function renderQuickPriceList() {
    const items = DataService.getAllItems().slice(0, 15);
    return items.map(it => `
      <div class="item-row" style="cursor:default;">
        <div class="item-left">
          <div class="item-name">${esc(it.name)}</div>
          <div class="item-meta">
            ${getDivisionBadge(it.division)}
            <span>${esc(it.unit)}</span>
          </div>
        </div>
        <div class="item-right" style="display:flex; align-items:center; gap:8px;">
          <div style="font-weight:700; font-size:.88rem; color:var(--primary);">${DataService.formatRupiah(it.price)}</div>
          <button type="button" class="btn btn-outline btn-sm" onclick="App.selectItemForPriceEdit(${it.id})" style="padding:4px 10px; font-size:.75rem;">
            ✏️ Ubah
          </button>
        </div>
      </div>
    `).join("");
  }

  function handlePriceSearch(val) {
    const dropdown = document.getElementById("priceSearchDropdown");
    const clearBtn = document.getElementById("priceSearchClear");
    if (clearBtn) clearBtn.classList.toggle("show", val.length > 0);

    if (!val || !val.trim()) {
      dropdown.classList.remove("show");
      dropdown.innerHTML = "";
      return;
    }

    const items = DataService.searchItems(val);
    if (items.length === 0) {
      dropdown.innerHTML = `<div class="autocomplete-empty">Tidak ada barang untuk "${esc(val)}"</div>`;
      dropdown.classList.add("show");
      return;
    }

    const q = val.trim().toLowerCase();
    dropdown.innerHTML = items.slice(0, 20).map(it => {
      const highlighted = highlightMatch(it.name, q);
      return `
        <div class="autocomplete-item" onclick="App.selectItemForPriceEdit(${it.id})">
          <div class="ac-item-left">
            <div class="ac-item-name">${highlighted}</div>
            <div class="ac-item-meta">
              ${getDivisionBadge(it.division)}
              <span>${esc(it.unit)}</span>
            </div>
          </div>
          <div class="ac-item-right">
            <div style="font-weight:700; color:var(--primary); font-size:.88rem;">${DataService.formatRupiah(it.price)}</div>
            <div style="font-size:.7rem; color:var(--on-surface-variant);">Pilih untuk ubah</div>
          </div>
        </div>
      `;
    }).join("");

    dropdown.classList.add("show");
  }

  function clearPriceSearch() {
    const input = document.getElementById("priceSearchInput");
    if (input) { input.value = ""; input.focus(); }
    const clearBtn = document.getElementById("priceSearchClear");
    if (clearBtn) clearBtn.classList.remove("show");
    const dropdown = document.getElementById("priceSearchDropdown");
    if (dropdown) dropdown.classList.remove("show");
    const editBox = document.getElementById("priceEditBox");
    if (editBox) editBox.style.display = "none";
    selectedItemForPriceEdit = null;
  }

  let selectedEditDivision = "KITCHEN";

  function setEditItemDivision(div) {
    selectedEditDivision = div;
    document.getElementById("editDivKitchen")?.classList.toggle("active", div === "KITCHEN");
    document.getElementById("editDivBar")?.classList.toggle("active", div === "BAR");
    document.getElementById("editDivPastry")?.classList.toggle("active", div === "PASTRY");
    document.getElementById("editDivLainnya")?.classList.toggle("active", div === "LAINNYA");
  }

  function selectItemForPriceEdit(id) {
    const item = DataService.getItemById(id);
    if (!item) return;

    selectedItemForPriceEdit = item;
    const searchInput = document.getElementById("priceSearchInput");
    if (searchInput) searchInput.value = item.name;

    const dropdown = document.getElementById("priceSearchDropdown");
    if (dropdown) dropdown.classList.remove("show");

    const clearBtn = document.getElementById("priceSearchClear");
    if (clearBtn) clearBtn.classList.add("show");

    const editBox = document.getElementById("priceEditBox");
    if (editBox) editBox.style.display = "block";

    // Set kategori barang
    selectedEditDivision = item.division || "KITCHEN";
    setEditItemDivision(selectedEditDivision);

    // Reset status ubah nama ke default (readonly text + tombol ubah)
    isEditingItemName = false;
    const wrapEditName = document.getElementById("wrapEditItemName");
    if (wrapEditName) wrapEditName.style.display = "none";
    const btnToggle = document.getElementById("btnToggleEditName");
    if (btnToggle) {
      btnToggle.innerHTML = "✏️ Ubah Nama";
      btnToggle.className = "btn btn-outline";
    }

    const displayName = document.getElementById("editDisplayName");
    if (displayName) displayName.textContent = item.name;

    const editNameInput = document.getElementById("inputEditItemName");
    if (editNameInput) editNameInput.value = item.name;

    document.getElementById("editPriceItemName").textContent = item.name;
    document.getElementById("editPriceItemMeta").innerHTML = `
      ${getDivisionBadge(item.division)}
      Satuan: <strong>${esc(item.unit)}</strong> &bull; Stok: <strong>${DataService.formatStock(item.stock, item.unit)}</strong>
    `;
    document.getElementById("editPriceCurrent").textContent = DataService.formatRupiah(item.price);

    const newPriceInput = document.getElementById("inputNewPrice");
    if (newPriceInput) {
      newPriceInput.value = item.price;
      newPriceInput.focus();
      newPriceInput.select();
    }
  }

  // Popup konfirmasi sebelum simpan nama & harga (Khusus Admin)
  function saveItemEdits() {
    if (!AuthService.isAdmin()) {
      showToast("Akses ditolak: Hanya Admin yang dapat mengubah nama dan harga barang!", "error");
      return;
    }
    if (!selectedItemForPriceEdit) {
      showToast("Pilih barang terlebih dahulu!", "error");
      return;
    }

    // Ambil nama baru jika mode ubah nama aktif, jika tidak gunakan nama lama
    let newName = selectedItemForPriceEdit.name;
    if (isEditingItemName) {
      const inputVal = document.getElementById("inputEditItemName")?.value.trim();
      if (!inputVal) {
        showToast("Nama barang tidak boleh kosong!", "error");
        return;
      }
      newName = inputVal;
    }

    const newPriceVal = document.getElementById("inputNewPrice")?.value;
    if (newPriceVal === "" || isNaN(newPriceVal) || Number(newPriceVal) < 0) {
      showToast("Masukkan harga baru yang valid!", "error");
      return;
    }
    const newPriceNum = Number(newPriceVal);

    const isNameDifferent = newName !== selectedItemForPriceEdit.name;
    const isPriceDifferent = newPriceNum !== selectedItemForPriceEdit.price;
    const isDivDifferent = selectedEditDivision !== selectedItemForPriceEdit.division;

    if (!isNameDifferent && !isPriceDifferent && !isDivDifferent) {
      showToast("Tidak ada perubahan nama, harga, maupun kategori yang disimpan.", "warning");
      return;
    }

    // Popup Konfirmasi
    const overlay = document.getElementById("confirmDialog");
    const summaryEl = document.getElementById("confirmSummary");

    summaryEl.innerHTML = `
      <div class="dialog-summary-row"><span>Aksi:</span><strong>✏️ Perbarui Data Barang</strong></div>
      ${isNameDifferent ? `
      <div class="dialog-summary-row"><span>Nama Lama:</span><span style="text-decoration:line-through; color:var(--on-surface-variant);">${esc(selectedItemForPriceEdit.name)}</span></div>
      <div class="dialog-summary-row"><span>Nama Baru:</span><strong style="color:var(--primary); font-size:1rem;">${esc(newName)}</strong></div>
      ` : `
      <div class="dialog-summary-row"><span>Barang:</span><strong>${esc(selectedItemForPriceEdit.name)}</strong></div>
      `}
      ${isDivDifferent ? `
      <div class="dialog-summary-row"><span>Kategori Lama:</span><span style="text-decoration:line-through; color:var(--on-surface-variant);">${formatDivisionName(selectedItemForPriceEdit.division)}</span></div>
      <div class="dialog-summary-row"><span>Kategori Baru:</span><strong style="color:var(--primary); font-size:1rem;">${formatDivisionName(selectedEditDivision)}</strong></div>
      ` : ''}
      <div class="dialog-summary-row"><span>Harga Lama:</span><span style="text-decoration:line-through; color:var(--on-surface-variant);">${DataService.formatRupiah(selectedItemForPriceEdit.price)}</span></div>
      <div class="dialog-summary-row"><span>Harga Baru:</span><strong style="color:var(--success); font-size:1.05rem;">${DataService.formatRupiah(newPriceNum)}</strong></div>
    `;

    overlay.classList.add("show");

    document.getElementById("btnConfirmYes").onclick = () => {
      overlay.classList.remove("show");
      doSaveItemEdits(selectedItemForPriceEdit.id, newName, newPriceNum, selectedEditDivision);
    };
    document.getElementById("btnConfirmNo").onclick = () => {
      overlay.classList.remove("show");
    };
  }

  function doSaveItemEdits(id, newName, newPrice, newDiv) {
    const res = DataService.updateItemInfo(id, { name: newName, price: newPrice, division: newDiv });
    if (res.success) {
      showToast(res.message, "success");
      selectedItemForPriceEdit = res.item;
      isEditingItemName = false;
      const wrapEditName = document.getElementById("wrapEditItemName");
      if (wrapEditName) wrapEditName.style.display = "none";
      const btnToggle = document.getElementById("btnToggleEditName");
      if (btnToggle) {
        btnToggle.innerHTML = "✏️ Ubah Nama";
        btnToggle.className = "btn btn-outline";
      }
      const displayName = document.getElementById("editDisplayName");
      if (displayName) displayName.textContent = res.item.name;

      document.getElementById("editPriceItemName").textContent = res.item.name;
      document.getElementById("editPriceItemMeta").innerHTML = `
        ${getDivisionBadge(res.item.division)}
        Satuan: <strong>${esc(res.item.unit)}</strong> &bull; Stok: <strong>${DataService.formatStock(res.item.stock, res.item.unit)}</strong>
      `;
      document.getElementById("editPriceCurrent").textContent = DataService.formatRupiah(res.item.price);
      const quickList = document.getElementById("quickPriceList");
      if (quickList) quickList.innerHTML = renderQuickPriceList();
    } else {
      showToast(res.message, "error");
    }
  }

  // Kompatibilitas fungsi lama
  function saveNewPrice() {
    saveItemEdits();
  }

  function doSaveNewPrice(id, newPrice) {
    const currentName = selectedItemForPriceEdit ? selectedItemForPriceEdit.name : null;
    const currentDiv = selectedItemForPriceEdit ? selectedItemForPriceEdit.division : null;
    doSaveItemEdits(id, currentName, newPrice, currentDiv);
  }

  function setNewItemDivision(div) {
    newItemDivision = div;
    document.getElementById("btnDivKitchen")?.classList.toggle("active", div === "KITCHEN");
    document.getElementById("btnDivBar")?.classList.toggle("active", div === "BAR");
    document.getElementById("btnDivPastry")?.classList.toggle("active", div === "PASTRY");
    document.getElementById("btnDivLainnya")?.classList.toggle("active", div === "LAINNYA");
  }

  // Popup konfirmasi sebelum simpan barang baru
  function saveNewItem(e) {
    e.preventDefault();
    const name = document.getElementById("newItemName")?.value.trim();
    if (!name) {
      showToast("Nama barang wajib diisi!", "error");
      return;
    }
    const unit = getEffectiveUnit();
    if (!unit) {
      showToast("Pilih atau ketik satuan barang!", "error");
      return;
    }
    const price = parseFloat(document.getElementById("newItemPrice")?.value) || 0;
    const stock = parseFloat(document.getElementById("newItemStock")?.value) || 0;
    const minStock = parseFloat(document.getElementById("newItemMinStock")?.value) || 0;

    // Popup Konfirmasi Tambah Barang
    const overlay = document.getElementById("confirmDialog");
    const summaryEl = document.getElementById("confirmSummary");

    summaryEl.innerHTML = `
      <div class="dialog-summary-row"><span>Aksi:</span><strong>➕ Tambah Barang Baru</strong></div>
      <div class="dialog-summary-row"><span>Nama:</span><strong>${esc(name)}</strong></div>
      <div class="dialog-summary-row"><span>Devisi:</span><strong>${newItemDivision}</strong></div>
      <div class="dialog-summary-row"><span>Satuan:</span><strong>${esc(unit)}</strong></div>
      <div class="dialog-summary-row"><span>Harga:</span><strong>${DataService.formatRupiah(price)}</strong></div>
      <div class="dialog-summary-row"><span>Stok Awal:</span><strong>${stock.toLocaleString("id-ID")} ${esc(unit)}</strong></div>
      <div class="dialog-summary-row"><span>Batas Min Stok:</span><strong>${minStock.toLocaleString("id-ID")} ${esc(unit)}</strong></div>
    `;

    overlay.classList.add("show");

    document.getElementById("btnConfirmYes").onclick = () => {
      overlay.classList.remove("show");
      doSaveNewItem({
        name,
        division: newItemDivision,
        unit,
        price,
        stock,
        minStock,
      });
    };
    document.getElementById("btnConfirmNo").onclick = () => {
      overlay.classList.remove("show");
    };
  }

  function doSaveNewItem(itemData) {
    const res = DataService.addNewItem(itemData);
    if (res.success) {
      showToast(res.message, "success");
      // Reset form
      document.getElementById("newItemName").value = "";
      selectedNewItemUnit = "Kg";
      isCustomUnitActive = false;
      customUnitValue = "";
      document.getElementById("newItemPrice").value = "";
      document.getElementById("newItemStock").value = "0";
      document.getElementById("newItemMinStock").value = "2";
      updateLowStockBadge();
      renderSettings();
    } else {
      showToast(res.message, "error");
    }
  }

  // ── TOAST NOTIFICATIONS ───────────────────────────────────────────
  function showToast(message, type = "") {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    const icon = type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️";
    toast.innerHTML = `<span>${icon}</span><span>${esc(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-20px)";
      toast.style.transition = "all .3s";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ── HELPERS ───────────────────────────────────────────────────────
  function formatDivisionName(div) {
    const d = (div || "").toUpperCase();
    if (d === "ADMIN" || d === "ALL") return "Admin";
    if (d === "BAR" || d === "BARISTA") return "Barista";
    if (d === "PASTRY") return "Pastry";
    if (d === "LAINNYA") return "Lain-Lain";
    return "Kitchen";
  }

  function getDivisionBadge(division) {
    const d = (division || "").toUpperCase();
    if (d === "ADMIN" || d === "ALL") {
      return `<span class="badge" style="background:#e8eaf6; color:#283593; font-weight:700;">🛡️ Admin</span>`;
    } else if (d === "BAR" || d === "BARISTA") {
      return `<span class="badge" style="background:#e0f2fe; color:#0369a1; font-weight:700;">☕ Barista</span>`;
    } else if (d === "PASTRY") {
      return `<span class="badge" style="background:#f3e5f5; color:#6a1b9a; font-weight:700;">🍰 Pastry</span>`;
    } else if (d === "LAINNYA") {
      return `<span class="badge" style="background:#fff3e0; color:#e65100; font-weight:700;">📦 Lain-Lain</span>`;
    } else {
      return `<span class="badge" style="background:#e8f5e9; color:#2e7d32; font-weight:700;">🍳 Kitchen</span>`;
    }
  }

  function esc(str) {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
  }

  function highlightMatch(text, query) {
    if (!query) return esc(text);
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return esc(text);
    const before = text.substring(0, idx);
    const match = text.substring(idx, idx + query.length);
    const after = text.substring(idx + query.length);
    return esc(before) + `<mark>${esc(match)}</mark>` + esc(after);
  }

  // ── PENGATURAN PIN KARYAWAN ─────────────────────────────────────────
  let _changePinTargetUser = null;

  function openChangePinDialog(targetUsername = null) {
    _changePinTargetUser = targetUsername;
    const overlay = document.getElementById("changePinDialog");
    const groupOldPin = document.getElementById("groupOldPin");
    const targetNameEl = document.getElementById("changePinTargetName");
    const inputOld = document.getElementById("inputOldPin");
    const inputNew = document.getElementById("inputNewPin");
    const inputConfirm = document.getElementById("inputConfirmPin");

    if (inputOld) inputOld.value = "";
    if (inputNew) inputNew.value = "";
    if (inputConfirm) inputConfirm.value = "";

    const currentUser = AuthService.getCurrentUser();
    const isSuper = AuthService.isSuperAdmin();

    // Jika Super Admin mengatur PIN karyawan lain, tidak perlu PIN lama
    if (targetUsername && targetUsername !== currentUser?.username && isSuper) {
      if (groupOldPin) groupOldPin.style.display = "none";
      if (targetNameEl) targetNameEl.innerHTML = `Atur PIN baru untuk karyawan: <strong>${esc(targetUsername)}</strong>`;
    } else {
      _changePinTargetUser = null;
      if (groupOldPin) groupOldPin.style.display = "block";
      if (targetNameEl) targetNameEl.innerHTML = `Ubah PIN untuk akun: <strong>${currentUser ? esc(currentUser.name) : 'Saya'}</strong>`;
    }

    if (overlay) overlay.classList.add("show");
  }

  function closeChangePinDialog() {
    const overlay = document.getElementById("changePinDialog");
    if (overlay) overlay.classList.remove("show");
    _changePinTargetUser = null;
  }

  function submitChangePin(e) {
    if (e && e.preventDefault) e.preventDefault();
    const inputOld = document.getElementById("inputOldPin");
    const inputNew = document.getElementById("inputNewPin");
    const inputConfirm = document.getElementById("inputConfirmPin");

    const oldPin = inputOld ? inputOld.value.trim() : "";
    const newPin = inputNew ? inputNew.value.trim() : "";
    const confirmPin = inputConfirm ? inputConfirm.value.trim() : "";

    // 🔒 STRICT VALIDASI: PIN Lama wajib diisi saat ubah PIN mandiri
    if (!_changePinTargetUser) {
      if (!oldPin) {
        showToast("PIN lama wajib diisi!", "error");
        if (inputOld) inputOld.focus();
        return false;
      }
    }

    if (!newPin || newPin.length < 4) {
      showToast("PIN baru minimal 4 angka!", "error");
      if (inputNew) inputNew.focus();
      return false;
    }

    if (newPin !== confirmPin) {
      showToast("Konfirmasi PIN baru tidak cocok!", "error");
      return false;
    }

    let res;
    if (_changePinTargetUser) {
      res = AuthService.setEmployeePin(_changePinTargetUser, newPin);
    } else {
      res = AuthService.changeMyPin(oldPin, newPin);
    }

    if (res.success) {
      showToast(res.message, "success");
      closeChangePinDialog();
      if (currentPage === "settings") {
        renderSettings();
      }
    } else {
      showToast(res.message, "error");
    }
    return false;
  }

  // ── EDIT USER (NAMA, RESET PIN, KATEGORI) ────────────────────────
  function openEditUserDialog(username) {
    const users = AuthService.getAllUsers();
    const user = users.find(u => u.username === username);
    if (!user) {
      showToast("User tidak ditemukan!", "error");
      return;
    }

    const overlay = document.getElementById("editUserDialog");
    if (!overlay) return;

    const usernameInput = document.getElementById("editUserUsername");
    const nameInput = document.getElementById("editUserName");
    const pinInput = document.getElementById("editUserPin");
    const divSelect = document.getElementById("editUserDivision");
    const groupDiv = document.getElementById("groupEditUserDiv");
    const titleEl = document.getElementById("editUserDialogTitle");

    if (usernameInput) usernameInput.value = user.username;
    if (nameInput) nameInput.value = user.name || "";
    if (pinInput) pinInput.value = "";

    const isSuper = user.role === "superadmin" || user.username === "satian";
    if (groupDiv) {
      groupDiv.style.display = isSuper ? "none" : "block";
    }
    if (divSelect) {
      const userDiv = (user.division || (user.role === 'admin' ? 'ADMIN' : 'KITCHEN')).toUpperCase();
      divSelect.value = userDiv;
    }

    if (titleEl) {
      titleEl.innerHTML = `✏️ Edit Karyawan: <strong>${esc(user.name)}</strong>`;
    }

    overlay.classList.add("show");
    setTimeout(() => {
      if (nameInput) {
        nameInput.focus();
        nameInput.select();
      }
    }, 100);
  }

  function closeEditUserDialog() {
    const overlay = document.getElementById("editUserDialog");
    if (overlay) overlay.classList.remove("show");
  }

  function submitEditUser(e) {
    if (e && e.preventDefault) e.preventDefault();

    const username = document.getElementById("editUserUsername")?.value;
    const name = document.getElementById("editUserName")?.value?.trim();
    const pin = document.getElementById("editUserPin")?.value?.trim();
    const divSelect = document.getElementById("editUserDivision");
    const division = divSelect ? divSelect.value : undefined;

    if (!username) {
      showToast("Data karyawan tidak valid!", "error");
      return false;
    }
    if (!name) {
      showToast("Nama karyawan wajib diisi!", "error");
      document.getElementById("editUserName")?.focus();
      return false;
    }
    if (pin && pin.length < 4) {
      showToast("PIN baru minimal 4 angka!", "error");
      document.getElementById("editUserPin")?.focus();
      return false;
    }

    const res = AuthService.updateUserInfo(username, {
      name: name,
      pin: pin || undefined,
      division: division
    });

    if (res.success) {
      showToast(res.message, "success");
      closeEditUserDialog();
      renderSettings();
    } else {
      showToast(res.message, "error");
    }
    return false;
  }

  // ── EDIT MUTASI STOK (ADMIN ONLY) ─────────────────────────────────
  let _currentEditingTxnId = null;

  function openEditMutationDialog(txnId) {
    if (!AuthService.isAdmin() && !AuthService.isSuperAdmin()) {
      showToast("Akses ditolak: Hanya Admin yang dapat mengoreksi mutasi stok.", "error");
      return;
    }

    const txns = DataService.getTransactions(500);
    const txn = txns.find(t => t.id === txnId);
    if (!txn) {
      showToast("Transaksi tidak ditemukan!", "error");
      return;
    }

    _currentEditingTxnId = txnId;
    const overlay = document.getElementById("editMutationDialog");
    if (!overlay) return;

    const item = DataService.getItemById(txn.itemId);
    const unit = item ? item.unit : (txn.unit || "Unit");
    const currentStock = item ? item.stock : 0;

    const infoEl = document.getElementById("editMutationInfo");
    if (infoEl) {
      infoEl.innerHTML = `
        <div style="background:#f5f5f5; border-radius:8px; padding:8px 10px; margin-bottom:8px; line-height:1.5;">
          <strong>${esc(txn.itemName)}</strong> ${getDivisionBadge(txn.division)}<br>
          <span style="font-size:.76rem; color:var(--on-surface-variant);">
            Tipe: <strong class="${txn.type === 'IN' ? 'text-success' : 'text-danger'}">${txn.type === 'IN' ? '📥 Stok Masuk' : '📤 Stok Keluar'}</strong> &bull;
            Tanggal: <strong>${txn.date}</strong> &bull;
            Penginput: <strong>${esc(txn.staff)}</strong><br>
            Sisa Stok Fisik Saat Ini: <strong style="color:var(--primary);">${DataService.formatStock(currentStock, unit)}</strong>
          </span>
        </div>
      `;
    }

    const txnIdInput = document.getElementById("editMutationTxnId");
    if (txnIdInput) txnIdInput.value = txn.id;

    const oldQtyInput = document.getElementById("editMutationOldQty");
    if (oldQtyInput) {
      oldQtyInput.value = `${DataService.parseQuantity(txn.qty).toLocaleString("id-ID", { maximumFractionDigits: 3 })} ${unit}`;
    }

    const newQtyInput = document.getElementById("editMutationNewQty");
    if (newQtyInput) {
      newQtyInput.value = String(txn.qty).replace('.', ',');
    }

    const reasonInput = document.getElementById("editMutationReason");
    if (reasonInput) {
      reasonInput.value = "";
    }

    overlay.classList.add("show");
    setTimeout(() => {
      if (newQtyInput) {
        newQtyInput.focus();
        newQtyInput.select();
      }
    }, 100);
  }

  function closeEditMutationDialog() {
    const overlay = document.getElementById("editMutationDialog");
    if (overlay) overlay.classList.remove("show");
    _currentEditingTxnId = null;
  }

  function submitEditMutation(e) {
    if (e && e.preventDefault) e.preventDefault();

    const txnId = document.getElementById("editMutationTxnId")?.value || _currentEditingTxnId;
    const rawNewQty = document.getElementById("editMutationNewQty")?.value;
    const reason = document.getElementById("editMutationReason")?.value?.trim();

    if (!txnId) {
      showToast("Data transaksi tidak valid!", "error");
      return false;
    }

    const newQty = DataService.parseQuantity(rawNewQty);
    if (isNaN(newQty) || newQty <= 0) {
      showToast("Jumlah baru harus berupa angka lebih dari 0!", "error");
      document.getElementById("editMutationNewQty")?.focus();
      return false;
    }

    if (!reason) {
      showToast("Alasan koreksi wajib diisi!", "error");
      document.getElementById("editMutationReason")?.focus();
      return false;
    }

    const currentUser = AuthService.getCurrentUser();
    const adminName = currentUser ? currentUser.name : "Admin";

    const res = DataService.editTransaction(txnId, {
      newQty: newQty,
      reason: reason,
      adminName: adminName
    });

    if (res.success) {
      showToast("✅ " + res.message, "success");
      closeEditMutationDialog();
      renderHistory();
      renderDashboard();
    } else {
      showToast("❌ " + res.message, "error");
    }
    return false;
  }

  function handleResetData() {
    const overlay = document.getElementById("confirmDialog");
    const summaryEl = document.getElementById("confirmSummary");

    summaryEl.innerHTML = `
      <div class="dialog-summary-row"><span>Aksi:</span><strong style="color:var(--danger);">⚠️ Reset ke Data Asli</strong></div>
      <div class="dialog-summary-row"><span>Sumber:</span><strong>Google Sheets (Oktober 2026 - 441 Barang)</strong></div>
      <div class="dialog-summary-row"><span>Peringatan:</span><span style="color:var(--danger);">Seluruh transaksi baru dan perubahan harga akan dikembalikan ke kondisi awal spreadsheet.</span></div>
    `;

    overlay.classList.add("show");

    document.getElementById("btnConfirmYes").onclick = () => {
      overlay.classList.remove("show");
      const res = DataService.resetToDefaultCatalog();
      if (res.success) {
        showToast(res.message, "success");
        updateLowStockBadge();
        renderSettings();
      } else {
        showToast(res.message, "error");
      }
    };
    document.getElementById("btnConfirmNo").onclick = () => {
      overlay.classList.remove("show");
    };
  }

  // ── GOOGLE APPS SCRIPT SYNC UI HANDLERS ───────────────────────────
  function saveGasUrlUI() {
    const input = document.getElementById("inputGasUrl");
    if (!input) return;
    const res = DataService.setGasUrl(input.value);
    if (res.success) {
      showToast(res.message || "URL Google Sheets berhasil disimpan!", "success");
      renderSettings();
    } else {
      showToast(res.message || "Gagal menyimpan URL", "error");
    }
  }

  async function testGasConnectionUI() {
    const input = document.getElementById("inputGasUrl");
    const url = input ? input.value : "";
    if (!url.trim()) {
      showToast("Silakan masukkan URL Web App terlebih dahulu", "error");
      return;
    }
    showToast("Menguji koneksi ke Google Sheets...", "info");
    const res = await DataService.testGasConnection(url);
    if (res.success) {
      showToast("🟢 " + res.message, "success");
    } else {
      showToast("🔴 " + res.message, "error");
    }
  }

  async function flushPendingSyncUI() {
    showToast("Mengirim antrean mutasi...", "info");
    const res = await DataService.flushPendingSync();
    if (res.success) {
      showToast(`✅ Berhasil mengirim ${res.synced} transaksi ke Google Sheets!`, "success");
    } else {
      showToast(`Terkirim ${res.synced}, sisa antrean: ${res.remaining}`, "warning");
    }
    renderSettings();
  }

  // ── PUBLIC API ────────────────────────────────────────────────────
  return {
    init,
    handleLogin,
    fillLogin,
    handleLogout,
    confirmLogout,
    closeLogoutDialog,
    doLogout,
    navigateTo,
    navigateToHistory,
    handleItemListSearch,
    clearItemSearch,
    filterItemDiv,
    handleInputItemSearch,
    clearInputItemSearch,
    selectItem,
    deselectItem,
    goToInputWithItem,
    openItemDetail,
    closeItemDetail,
    switchDetailPeriodMode,
    applyDetailCustomRange,
    goToInputFromDetail,
    setHistoryDatePreset,
    handleHistoryDateChange,
    handleHistoryStaffChange,
    applyHistoryFilters,
    setTxnType,
    stepQty,
    setQty,
    checkStockWarning,
    confirmSubmit,
    filterHistory,
    showToast,
    setSettingsTab,
    handlePriceSearch,
    clearPriceSearch,
    selectItemForPriceEdit,
    toggleEditItemName,
    setEditItemDivision,
    saveItemEdits,
    saveNewPrice,
    setNewItemDivision,
    saveNewItem,
    selectNewItemUnit,
    toggleCustomUnit,
    handleCustomUnitInput,
    handleAddNewUser,
    handleChangeUserRole,
    handleChangeUserDivision,
    handleDeleteUser,
    setNewUserRoleSelection,
    setNewUserDivisionSelection,
    showDivisionRestrictedAlert,
    openChangePinDialog,
    closeChangePinDialog,
    submitChangePin,
    openEditUserDialog,
    closeEditUserDialog,
    submitEditUser,
    openEditMutationDialog,
    closeEditMutationDialog,
    submitEditMutation,
    handleResetData,
    saveGasUrlUI,
    testGasConnectionUI,
    flushPendingSyncUI
  };
})();

if (typeof window !== "undefined") {
  window.App = App;
}

if (typeof document !== "undefined" && document.addEventListener) {
  document.addEventListener("DOMContentLoaded", App.init);
}
