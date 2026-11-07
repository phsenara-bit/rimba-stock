#!/usr/bin/env python3
"""Patch v2: token bisa dipasang lewat link (satu tap), tanpa ngetik."""
import sys

P = "index.html"
src = open(P, encoding="utf-8").read()

ANCHOR = '''  (function installGasFetchShim() {'''

NEW = '''  /**
   * Bootstrap token dari URL: https://rimbastock.my.id/#token=XXXX
   * Super Admin cukup kirim link sekali; staf tinggal buka, token tersimpan
   * otomatis dan URL-nya dibersihkan supaya tidak ikut ter-share.
   */
  (function bootstrapTokenFromUrl() {
    try {
      if (typeof window === "undefined" || !window.location) return;
      const raw = String(window.location.hash || "") + "&" + String(window.location.search || "");
      const m = raw.match(/[?#&]token=([^&\\s]+)/);
      if (!m) return;
      const tok = decodeURIComponent(m[1]).trim();
      if (!tok) return;
      if (typeof window.localStorage !== "undefined") {
        window.localStorage.setItem(SYNC_TOKEN_STORAGE_KEY, tok);
      }
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, "", window.location.pathname);
      }
      console.log("[DataService] Token sinkronisasi terpasang dari link.");
    } catch (e) {
      /* jangan pernah menggagalkan load aplikasi */
    }
  })();

  (function installGasFetchShim() {'''

n = src.count(ANCHOR)
if n != 1:
    sys.exit(f"ANCHOR FAIL: {n}")

src = src.replace(ANCHOR, NEW)
open(P, "w", encoding="utf-8").write(src)
print("patched bootstrap ok")