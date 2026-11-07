#!/usr/bin/env python3
"""Patch rimba-stock/index.html: tambah token sinkronisasi (device-side) + fetch shim.
Idempotent-ish: script akan gagal keras kalau anchor tidak ketemu, supaya tidak
menghasilkan file setengah jadi.
"""
import re, sys, shutil

P = "index.html"
src = open(P, encoding="utf-8").read()
orig_len = len(src)

def must(old, new, count=1, label=""):
    global src
    n = src.count(old)
    if n != count:
        sys.exit(f"ANCHOR FAIL [{label}]: expected {count}, found {n}")
    src = src.replace(old, new)

# 1. storage key
must(
 'const GAS_URL_STORAGE_KEY = "rimba_alam_gas_url_v4";',
 'const GAS_URL_STORAGE_KEY = "rimba_alam_gas_url_v4";\n  const SYNC_TOKEN_STORAGE_KEY = "rimba_alam_sync_token_v1";',
 label="storage-key")

# 2. getSyncToken/setSyncToken + fetch shim, disisipkan sebelum setGasUrl
must(
 '  function setGasUrl(url) {',
 '''  /** Token rahasia per-perangkat. TIDAK disimpan di repo, diisi sekali oleh Super Admin. */
  function getSyncToken() {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        return (window.localStorage.getItem(SYNC_TOKEN_STORAGE_KEY) || "").trim();
      }
    } catch (e) {}
    return "";
  }

  function setSyncToken(token) {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(SYNC_TOKEN_STORAGE_KEY, (token || "").trim());
        return { success: true, message: "Token sinkronisasi disimpan di perangkat ini." };
      }
      return { success: false, message: "Penyimpanan browser tidak tersedia." };
    } catch (e) {
      return { success: false, message: "Gagal menyimpan token: " + e.message };
    }
  }

  /**
   * Shim fetch: setiap request ke script.google.com otomatis diberi token.
   * GET  -> tambah ?token=... di query
   * POST -> sisipkan field "token" ke body JSON
   * Tujuannya supaya semua jalur (baca sheet, tulis mutasi, baca pengguna, ping)
   * ikut terlindungi tanpa mengubah satu per satu pemanggilnya.
   */
  (function installGasFetchShim() {
    if (typeof window === "undefined" || !window.fetch || window.__gasFetchShim) return;
    window.__gasFetchShim = true;
    const _origFetch = window.fetch.bind(window);

    window.fetch = function (input, init) {
      try {
        const url = typeof input === "string" ? input : (input && input.url) || "";
        if (url.indexOf("script.google.com") !== -1) {
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
        }
      } catch (e) {
        /* jangan pernah menggagalkan request hanya karena shim */
      }
      return _origFetch(input, init);
    };
  })();

  function setGasUrl(url) {''',
 label="token-fns")

# 3. export
must(
 '''    getGasUrl,
    setGasUrl,''',
 '''    getGasUrl,
    setGasUrl,
    getSyncToken,
    setSyncToken,''',
 label="exports")

# 4. UI: input token di Pengaturan
must(
 '''              <input type="url" id="inputGasUrl" class="form-input" style="font-size:.78rem;" placeholder="https://script.google.com/macros/s/.../exec" value="${DataService.getGasUrl()}">
            </div>''',
 '''              <input type="url" id="inputGasUrl" class="form-input" style="font-size:.78rem;" placeholder="https://script.google.com/macros/s/.../exec" value="${DataService.getGasUrl()}">
            </div>

            <div class="form-group mb-8">
              <label class="form-label" style="font-size:.78rem; font-weight:600;">Token Sinkronisasi ${DataService.getSyncToken() ? '🟢 terpasang' : '🔴 belum diisi'}</label>
              <input type="password" id="inputSyncToken" class="form-input" style="font-size:.78rem;" placeholder="tempel token dari Super Admin" value="${DataService.getSyncToken()}" autocomplete="off">
              <p style="font-size:.7rem; color:var(--on-surface-variant); margin-top:4px;">
                Wajib sama dengan Script Property <b>SYNC_TOKEN</b> di Apps Script. Tanpa token, perangkat ini tidak bisa membaca/menulis sheet.
              </p>
            </div>''',
 label="ui-input")

# 5. handler simpan: token ikut disimpan
must(
 '''  function saveGasUrlUI() {
    const input = document.getElementById("inputGasUrl");
    if (!input) return;
    const res = DataService.setGasUrl(input.value);''',
 '''  function saveGasUrlUI() {
    const input = document.getElementById("inputGasUrl");
    if (!input) return;
    const tokenEl = document.getElementById("inputSyncToken");
    if (tokenEl) DataService.setSyncToken(tokenEl.value);
    const res = DataService.setGasUrl(input.value);''',
 label="save-handler")

open(P, "w", encoding="utf-8").write(src)
print(f"patched {orig_len} -> {len(src)} bytes (+{len(src)-orig_len})")
