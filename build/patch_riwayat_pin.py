import io, re, sys

# ══════════════════════════════════════════════════════════════════════
# BAGIAN 1 — backend: normalisasi tanggal/jam dari sheet
# ══════════════════════════════════════════════════════════════════════
p = "Code.gs"
s = io.open(p, encoding="utf-8").read()

OLD_HELPER_ANCHOR = "function _g2HandleReadTransactions(e, user) {"
HELPER = '''// Kolom "Waktu Input" di sheet sering berubah jadi objek Date (Sheets
// meng-autoparse "2026-11-11 09:02:00"). Kalau dibiarkan, String(Date) jadi
// "Wed Nov 11 2026 ..." sehingga filter tanggal di app tidak pernah cocok dan
// riwayat tampak kosong walau beranda menampilkan transaksinya.
function _g2DateIso_(v) {
  try {
    if (v && typeof v === "object" && typeof v.getTime === "function" && !isNaN(v.getTime())) {
      return Utilities.formatDate(v, "Asia/Jakarta", "yyyy-MM-dd");
    }
  } catch (e) { /* lanjut ke teks */ }
  const t = _g2Str(v);
  if (!t) return "";
  let m = t.match(/(\\d{4})-(\\d{2})-(\\d{2})/);
  if (m) return m[1] + "-" + m[2] + "-" + m[3];
  m = t.match(/(\\d{1,2})[\\/\\-](\\d{1,2})[\\/\\-](\\d{4})/);
  if (m) {
    return m[3] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2);
  }
  try {
    const d = new Date(t);
    if (!isNaN(d.getTime())) return Utilities.formatDate(d, "Asia/Jakarta", "yyyy-MM-dd");
  } catch (e) {}
  return "";
}

function _g2TimeHms_(v) {
  try {
    if (v && typeof v === "object" && typeof v.getTime === "function" && !isNaN(v.getTime())) {
      return Utilities.formatDate(v, "Asia/Jakarta", "HH:mm:ss");
    }
  } catch (e) {}
  const t = _g2Str(v);
  const m = t.match(/(\\d{1,2}):(\\d{2})(?::(\\d{2}))?/);
  if (m) return ("0" + m[1]).slice(-2) + ":" + m[2] + ":" + (m[3] || "00");
  return "";
}

'''
if s.count(OLD_HELPER_ANCHOR) != 1:
    sys.exit("anchor handler tidak unik")
s = s.replace(OLD_HELPER_ANCHOR, HELPER + OLD_HELPER_ANCHOR)

OLD_DATE = '''          const when = _g2Str(r[1]);'''
NEW_DATE = '''          const whenRaw = r[1];
          const whenDate = _g2DateIso_(whenRaw);
          const whenTime = _g2TimeHms_(whenRaw);'''
if s.count(OLD_DATE) != 1:
    sys.exit("anchor when tidak unik")
s = s.replace(OLD_DATE, NEW_DATE)

OLD_MAP = '''            date: when.slice(0, 10),
            time: when.slice(11, 19),'''
NEW_MAP = '''            date: whenDate,
            time: whenTime,'''
if s.count(OLD_MAP) != 1:
    sys.exit("anchor mapping tidak unik")
s = s.replace(OLD_MAP, NEW_MAP)

# buang transaksi yang tanggalnya tidak bisa dibaca — lebih baik hilang dari
# riwayat daripada masuk dengan tanggal ngawur dan merusak filter
OLD_FILTER = '''          if (!id) continue;'''
NEW_FILTER = '''          if (!id) continue;
          if (!whenDate) continue;   // tanggal tak terbaca: jangan masuk riwayat'''
if s.count(OLD_FILTER) != 1:
    sys.exit("anchor filter tidak unik")
s = s.replace(OLD_FILTER, NEW_FILTER)

io.open(p, "w", encoding="utf-8").write(s)
print("Code.gs: tanggal/jam dinormalisasi")

# ══════════════════════════════════════════════════════════════════════
# BAGIAN 2 — frontend: PIN di-await, tanggal "hari ini" pakai waktu lokal
# ══════════════════════════════════════════════════════════════════════
p = "index.html"
s = io.open(p, encoding="utf-8").read()

OLD_PIN = '''  function submitChangePin(e) {
    if (e && e.preventDefault) e.preventDefault();'''
NEW_PIN = '''  async function submitChangePin(e) {
    if (e && e.preventDefault) e.preventDefault();'''
if s.count(OLD_PIN) != 1:
    sys.exit("anchor submitChangePin tidak unik")
s = s.replace(OLD_PIN, NEW_PIN)

OLD_CALL = '''    let res;
    if (_changePinTargetUser) {
      res = AuthService.setEmployeePin(_changePinTargetUser, newPin);
    } else {
      res = AuthService.changeMyPin(oldPin, newPin);
    }'''
NEW_CALL = '''    // Keduanya async: tanpa await, hasilnya Promise dan res.success selalu
    // undefined → muncul toast merah tanpa teks padahal PIN sudah berubah.
    let res;
    try {
      if (_changePinTargetUser) {
        res = await AuthService.setEmployeePin(_changePinTargetUser, newPin);
      } else {
        res = await AuthService.changeMyPin(oldPin, newPin);
      }
    } catch (err) {
      showToast("Gagal mengubah PIN: " + (err && err.message ? err.message : err), "error");
      return false;
    }'''
if s.count(OLD_CALL) != 1:
    sys.exit("anchor panggilan PIN tidak unik")
s = s.replace(OLD_CALL, NEW_CALL)

# tanggal lokal, bukan UTC: antara 00:00-07:00 WIB, UTC masih kemarin
OLD_TODAY = '''  const _todayIso = new Date().toISOString().split("T")[0];'''
NEW_TODAY = '''  // Tanggal hari ini menurut waktu LOKAL. toISOString() memakai UTC, jadi
  // antara 00:00-07:00 WIB nilainya masih tanggal kemarin dan transaksi pagi
  // tidak muncul di filter "Hari Ini".
  function _localIsoDate(d) {
    const x = d || new Date();
    return x.getFullYear() + "-" + ("0" + (x.getMonth() + 1)).slice(-2) + "-" + ("0" + x.getDate()).slice(-2);
  }
  const _todayIso = _localIsoDate();'''
if s.count(OLD_TODAY) != 1:
    sys.exit("anchor _todayIso tidak unik")
s = s.replace(OLD_TODAY, NEW_TODAY)

OLD_RH = '''  function renderHistory() {
    const todayStr = new Date().toISOString().split("T")[0];'''
NEW_RH = '''  function renderHistory() {
    const todayStr = _localIsoDate();'''
if s.count(OLD_RH) != 1:
    sys.exit("anchor renderHistory tidak unik")
s = s.replace(OLD_RH, NEW_RH)

OLD_PRESET = '''  function setHistoryDatePreset(preset) {
    const today = new Date();
    const todayIso = today.toISOString().split("T")[0];'''
NEW_PRESET = '''  function setHistoryDatePreset(preset) {
    const today = new Date();
    const todayIso = _localIsoDate(today);'''
if s.count(OLD_PRESET) != 1:
    sys.exit("anchor preset tidak unik")
s = s.replace(OLD_PRESET, NEW_PRESET)

OLD_PAST = '''      const past = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
      historyStartDate = past.toISOString().split("T")[0];'''
NEW_PAST = '''      const past = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
      historyStartDate = _localIsoDate(past);'''
if s.count(OLD_PAST) != 1:
    sys.exit("anchor past tidak unik")
s = s.replace(OLD_PAST, NEW_PAST)

io.open(p, "w", encoding="utf-8").write(s)
print("index.html: PIN di-await + tanggal lokal")
