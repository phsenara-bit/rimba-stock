#!/usr/bin/env python3
"""Patch v4: buang jalur token (digantikan verifikasi PIN), biar Pengaturan tidak membingungkan."""
import sys

P = "index.html"
src = open(P, encoding="utf-8").read()


def must(old, new="", count=1, label=""):
    global src
    n = src.count(old)
    if n != count:
        sys.exit(f"ANCHOR FAIL [{label}]: expected {count}, found {n}")
    src = src.replace(old, new)


# 1. Konstanta token
must('  const SYNC_TOKEN_STORAGE_KEY = "rimba_alam_sync_token_v1";\n', "", label="token-const")

# 2. getSyncToken / setSyncToken
start = src.find("  /** Token rahasia per-perangkat.")
end = src.find("  /**\n   * Bootstrap token dari URL")
if start < 0 or end < 0 or end <= start:
    sys.exit("ANCHOR FAIL [token-fns]")
src = src[:start] + src[end:]

# 3. Bootstrap token dari link
start = src.find("  /**\n   * Bootstrap token dari URL")
end = src.find("  function readDeviceCred()")
if start < 0 or end < 0 or end <= start:
    sys.exit("ANCHOR FAIL [bootstrap]")
src = src[:start] + src[end:]

# 4. Field token di Pengaturan
must(
    """
            <div class="form-group mb-8">
              <label class="form-label" style="font-size:.78rem; font-weight:600;">Token Sinkronisasi ${DataService.getSyncToken() ? '🟢 terpasang' : '🔴 belum diisi'}</label>
              <input type="password" id="inputSyncToken" class="form-input" style="font-size:.78rem;" placeholder="tempel token dari Super Admin" value="${DataService.getSyncToken()}" autocomplete="off">
              <p style="font-size:.7rem; color:var(--on-surface-variant); margin-top:4px;">
                Wajib sama dengan Script Property <b>SYNC_TOKEN</b> di Apps Script. Tanpa token, perangkat ini tidak bisa membaca/menulis sheet.
              </p>
            </div>""",
    "",
    label="token-ui",
)

# 5. Handler simpan token
must("    if (tokenEl) DataService.setSyncToken(tokenEl.value);\n", "", label="token-save")

# 6. Pemakaian token di shim
must(
    """          const cred = readDeviceCred();
          const token = getSyncToken();
          const method""",
    """          const cred = readDeviceCred();
          const method""",
    label="shim-token-1",
)
must("                if (token) obj.token = token;\n", "", label="shim-token-2")
must(
    """          } else if (cred || token) {""",
    """          } else if (cred) {""",
    label="shim-token-3",
)
must(
    """            if (token && url.indexOf("token=") === -1) extra.push("token=" + encodeURIComponent(token));\n""",
    "",
    label="shim-token-4",
)

# 7. Export helper token
must(
    """    getSyncToken,
    setSyncToken,
""",
    "",
    label="token-export",
)

open(P, "w", encoding="utf-8").write(src)
print("patched v4 ok")
