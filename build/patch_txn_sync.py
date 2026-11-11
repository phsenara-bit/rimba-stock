import io, sys

p = "Code.gs"
s = io.open(p, encoding="utf-8").read()

def rep(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        sys.exit("FAIL (%d): %r" % (n, old[:110]))
    s = s.replace(old, new)

# ══ 1. Handler baca riwayat dari MUTASI_APP ═════════════════════════════
rep('''function _g2HandleReadUsers(user) {
  const list = _g2PublicUsers();
  return _g2Json({
    success: true,
    count: list.length,
    users: list,
    scope: _g2IsPrivileged(user.role) ? "admin" : "staff"
  });
}''',
'''function _g2HandleReadUsers(user) {
  const list = _g2PublicUsers();
  return _g2Json({
    success: true,
    count: list.length,
    users: list,
    scope: _g2IsPrivileged(user.role) ? "admin" : "staff"
  });
}

/* ── riwayat transaksi (MUTASI_APP) ─────────────────────────────────────
 * Dulu riwayat cuma hidup di localStorage browser, jadi hilang begitu ganti
 * perangkat/incognito dan tidak pernah sama antar staf. Route ini yang
 * membuat sheet jadi sumber riwayat.
 *
 * Ringan: baca hanya N baris terakhir, dan hasilnya di-cache 60 detik di
 * CacheService supaya buka app berbarengan tidak menumpuk baca sheet.
 */
const G2_TXN_DEFAULT_LIMIT = 500;
const G2_TXN_MAX_LIMIT = 2000;
const G2_TXN_CACHE_SECONDS = 60;

function _g2HandleReadTransactions(e, user) {
  let limit = parseInt((e && e.parameter && e.parameter.limit) || "", 10);
  if (!(limit > 0)) limit = G2_TXN_DEFAULT_LIMIT;
  if (limit > G2_TXN_MAX_LIMIT) limit = G2_TXN_MAX_LIMIT;

  const cache = CacheService.getScriptCache();
  const cacheKey = "g2_txns_v1_" + limit;
  try {
    const hit = cache.get(cacheKey);
    if (hit) return _g2Json(JSON.parse(hit));
  } catch (err) { /* cache miss / rusak → baca sheet */ }

  const rows = [];
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss ? ss.getSheetByName("MUTASI_APP") : null;
    if (sh) {
      const last = sh.getLastRow();
      if (last > 1) {
        const start = Math.max(2, last - limit + 1);
        const n = last - start + 1;
        const vals = sh.getRange(start, 1, n, 12).getValues();
        for (let i = 0; i < vals.length; i++) {
          const r = vals[i];
          const id = _g2Str(r[0]);
          if (!id) continue;
          const when = _g2Str(r[1]);
          const notes = _g2Str(r[9]);
          // Catatan spoil disimpan sebagai "[SPOIL: alasan] sisa catatan".
          let spoilReason = "";
          let cleanNotes = notes;
          const m = notes.match(/^\\[SPOIL:\\s*([^\\]]+)\\]\\s*/);
          if (m) {
            spoilReason = m[1].trim();
            cleanNotes = notes.replace(/^\\[SPOIL:\\s*[^\\]]+\\]\\s*/, "");
          }
          rows.push({
            id: id,
            date: when.slice(0, 10),
            time: when.slice(11, 19),
            division: _g2Str(r[2]).toUpperCase(),
            staff: _g2Str(r[3]),
            itemId: _g2Str(r[4]),
            itemName: _g2Str(r[5]),
            unit: _g2Str(r[6]),
            type: _g2Str(r[7]) || "OUT",
            qty: Number(String(r[8]).replace(",", ".")) || 0,
            notes: cleanNotes,
            spoilReason: spoilReason,
            unitPrice: Number(r[10]) || 0,
            totalRupiah: Number(r[11]) || 0
          });
        }
      }
    }
  } catch (err) {
    console.error("[readTransactions] " + (err && err.stack ? err.stack : err));
  }

  // Terbaru di atas: baris sheet sudah berurut waktu menurun.
  rows.reverse();

  const out = { success: true, count: rows.length, transactions: rows };
  try { cache.put(cacheKey, JSON.stringify(out), G2_TXN_CACHE_SECONDS); } catch (err) {}
  return _g2Json(out);
}''')

# ══ 2. Pasang di doGet ═════════════════════════════════════════════════
rep('''  if (action === "readusers" || action === "getusers") {
    return _g2HandleReadUsers(user);
  }

  if (action === "askai") {
    if (!_g2IsPrivileged(user.role)) {
      return _aiError_("FORBIDDEN", "Mirim khusus untuk akun admin.");
    }
    return handleAskAI_(e, user, null);
  }''',
'''  if (action === "readusers" || action === "getusers") {
    return _g2HandleReadUsers(user);
  }

  if (action === "readtransactions") {
    return _g2HandleReadTransactions(e, user);
  }

  if (action === "askai") {
    if (!_g2IsPrivileged(user.role)) {
      return _aiError_("FORBIDDEN", "Mirim khusus untuk akun admin.");
    }
    return handleAskAI_(e, user, null);
  }''')

# ══ 3. Pasang di doPost ════════════════════════════════════════════════
rep('''  if (action === "readusers" || action === "getusers") {
    return _g2HandleReadUsers(user);
  }

  if (action === "askai") {
    if (!_g2IsPrivileged(user.role)) {
      return _aiError_("FORBIDDEN", "Mirim khusus untuk akun admin.");
    }
    return handleAskAI_(e, user, body);
  }''',
'''  if (action === "readusers" || action === "getusers") {
    return _g2HandleReadUsers(user);
  }

  if (action === "readtransactions") {
    return _g2HandleReadTransactions(e, user);
  }

  if (action === "askai") {
    if (!_g2IsPrivileged(user.role)) {
      return _aiError_("FORBIDDEN", "Mirim khusus untuk akun admin.");
    }
    return handleAskAI_(e, user, body);
  }''')

io.open(p, "w", encoding="utf-8").write(s)
print("backend: route readTransactions dipasang")
