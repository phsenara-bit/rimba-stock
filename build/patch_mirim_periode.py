import io, sys

p = "Code.gs"
s = io.open(p, encoding="utf-8").read()

def rep(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        sys.exit("FAIL (%d): %r" % (n, old[:110]))
    s = s.replace(old, new)

# ══ 1. Deteksi "bulan ini" juga, bukan cuma "bulan lalu" ═══════════════
rep('''// Semua bulan yang disebut, urut kemunculan (maks 3). "bulan lalu" ikut.
function _aiMonthsInQuestion_(question) {
  const now = new Date();
  const tz = "Asia/Jakarta";
  const curY = parseInt(Utilities.formatDate(now, tz, "yyyy"), 10);
  const curM = parseInt(Utilities.formatDate(now, tz, "MM"), 10);
  const q = String(question || "").toLowerCase();
  const ym = q.match(/\\b(20\\d{2})\\b/);
  const y = ym ? parseInt(ym[1], 10) : curY;

  const out = [];
  const re = /\\b(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|agu|agt|ags|sep|sept|okt|nov|des)\\b/g;
  let m;
  while ((m = re.exec(q)) !== null) {
    const mm = AI_MONTHS[m[1]];
    if (!mm) continue;
    if (out.some(function (x) { return x.month === mm; })) continue;
    out.push({ month: mm, year: y, explicit: true });
    if (out.length >= 3) break;
  }

  if (/bulan\\s+(lalu|kemarin)/.test(q)) {
    const pm = curM === 1 ? 12 : curM - 1;
    const py = curM === 1 ? curY - 1 : curY;
    if (!out.some(function (x) { return x.month === pm && x.year === py; })) {
      out.push({ month: pm, year: py, explicit: true });
    }
  }
  return out;
}''',
'''// Semua periode yang disebut, urut kemunculan di kalimat (maks 3).
// "bulan ini" dan "bulan lalu" dua-duanya terdeteksi, supaya pertanyaan
// "bulan ini dan bulan lalu" benar-benar membandingkan dua periode — bukan
// dianggap satu periode dan diam-diam dijawab dengan data bulan lalu.
function _aiMonthsInQuestion_(question) {
  const now = new Date();
  const tz = "Asia/Jakarta";
  const curY = parseInt(Utilities.formatDate(now, tz, "yyyy"), 10);
  const curM = parseInt(Utilities.formatDate(now, tz, "MM"), 10);
  const q = String(question || "").toLowerCase();
  const ym = q.match(/\\b(20\\d{2})\\b/);
  const y = ym ? parseInt(ym[1], 10) : curY;

  const prevM = curM === 1 ? 12 : curM - 1;
  const prevY = curM === 1 ? curY - 1 : curY;
  const THIS = /^(bulan\\s+ini|bulan\\s+sekarang|periode\\s+ini|bulan\\s+berjalan)$/;
  const PREV = /^(bulan\\s+lalu|bulan\\s+kemarin)$/;

  const out = [];
  const push = function (m, yy) {
    if (!m) return;
    if (out.some(function (x) { return x.month === m && x.year === yy; })) return;
    out.push({ month: m, year: yy, explicit: true });
  };

  const re = /\\b(bulan\\s+ini|bulan\\s+sekarang|periode\\s+ini|bulan\\s+berjalan|bulan\\s+lalu|bulan\\s+kemarin|januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|agu|agt|ags|sep|sept|okt|nov|des|dec)\\b/g;
  let m;
  while ((m = re.exec(q)) !== null) {
    const w = m[1];
    if (THIS.test(w)) push(curM, curY);
    else if (PREV.test(w)) push(prevM, prevY);
    else push(AI_MONTHS[w], y);
    if (out.length >= 3) break;
  }
  return out;
}''')

# ══ 2. Perbaiki singkatan "dec" yang salah (10 → 12) ════════════════════
rep("sep: 9, sept: 9, okt: 10, nov: 11, des: 12, dec: 10",
    "sep: 9, sept: 9, okt: 10, nov: 11, des: 12, dec: 12")

# ══ 3. "bulan ini" eksplisit di _aiTargetMonth_ ══════════════════════════
rep('''  if (/bulan\\s+(lalu|kemarin)|last month|previous month/.test(q)) {''',
'''  if (/bulan\\s+(ini|sekarang|berjalan)|this month|current month/.test(q)) {
    return { month: curM, year: curY, explicit: true };
  }

  if (/bulan\\s+(lalu|kemarin)|last month|previous month/.test(q)) {''')

io.open(p, "w", encoding="utf-8").write(s)
print("deteksi periode diperbaiki")
