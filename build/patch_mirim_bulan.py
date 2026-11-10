import io, sys

p = "Code.gs"
s = io.open(p, encoding="utf-8").read()

def rep(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        sys.exit("FAIL (%d): %r" % (n, old[:90]))
    s = s.replace(old, new)

# ── 1. konstanta bulan + versi cache naik
rep('''const AI_VER = "mirim-3";         // naikkan saat prompt/format fakta berubah → cache lama gugur''',
    '''const AI_VER = "mirim-4";         // naikkan saat prompt/format fakta berubah → cache lama gugur

const AI_MONTHS = {
  januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
  juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, agu: 8, agt: 8, ags: 8,
  sep: 9, sept: 9, okt: 10, nov: 11, des: 12, dec: 10
};
const AI_MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function _aiMonthLabel_(m, y) {
  return (AI_MONTH_NAMES[(m || 1) - 1] || "-") + " " + y;
}

function _aiDaysInMonth_(y, m) {
  return new Date(y, m, 0).getDate();
}

// Bulan apa yang ditanyakan? Default: bulan berjalan.
function _aiTargetMonth_(question) {
  const now = new Date();
  const tz = "Asia/Jakarta";
  const curY = parseInt(Utilities.formatDate(now, tz, "yyyy"), 10);
  const curM = parseInt(Utilities.formatDate(now, tz, "MM"), 10);
  const q = String(question || "").toLowerCase();

  if (/bulan\\s+(lalu|kemarin)|last month|previous month/.test(q)) {
    const m = curM === 1 ? 12 : curM - 1;
    const y = curM === 1 ? curY - 1 : curY;
    return { month: m, year: y, explicit: true };
  }

  const re = /\\b(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|agu|agt|ags|sep|sept|okt|nov|des)\\b/g;
  const hits = q.match(re);
  if (hits && hits.length) {
    const m = AI_MONTHS[hits[0]];
    if (m) {
      const ym = q.match(/\\b(20\\d{2})\\b/);
      const y = ym ? parseInt(ym[1], 10) : curY;
      return { month: m, year: y, explicit: true };
    }
  }

  return { month: curM, year: curY, explicit: false };
}''')

# ── 2. _aiSheetData_ menerima parameter tab
rep('''function _aiSheetData_() {
  const res = handleReadMonthlySheetData({ parameter: {} });''',
    '''function _aiSheetData_(params) {
  const res = handleReadMonthlySheetData({ parameter: params || {} });''')

# ── 3. _aiMutasi_ bisa difilter per bulan
rep('''function _aiMutasi_(itemName, limit) {''',
    '''function _aiMutasi_(itemName, limit, month, year) {''')

rep('''      const qty = parseFloat(String(r[8] || "0").replace(/,/g, ".")) || 0;''',
    '''      if (month && year) {
        const w = String(r[1] || "").slice(0, 10);           // "yyyy-MM-dd"
        const prefix = year + "-" + (month < 10 ? "0" + month : String(month));
        if (w.indexOf(prefix) !== 0) continue;
      }
      const qty = parseFloat(String(r[8] || "0").replace(/,/g, ".")) || 0;''')

# ── 4. _aiFacts_: pilih periode, jujur kalau tab bulan itu tidak ada
rep('''function _aiFacts_(question, hintTopic) {
  const data = _aiSheetData_();
  const dayElapsed = data.dayToDate || new Date().getDate();''',
    '''function _aiFacts_(question, hintTopic) {
  const now = new Date();
  const tz = "Asia/Jakarta";
  const curY = parseInt(Utilities.formatDate(now, tz, "yyyy"), 10);
  const curM = parseInt(Utilities.formatDate(now, tz, "MM"), 10);
  const curD = parseInt(Utilities.formatDate(now, tz, "dd"), 10);

  const period = _aiTargetMonth_(question);
  const isCurrent = (period.month === curM && period.year === curY);
  let data = null;
  let sheetForPeriod = null;

  if (!isCurrent) {
    try {
      sheetForPeriod = _findMonthlySheet_(SpreadsheetApp.getActiveSpreadsheet(), period.year, period.month);
    } catch (err) { sheetForPeriod = null; }
  }

  const periodLabel = _aiMonthLabel_(period.month, period.year);

  if (!isCurrent && !sheetForPeriod) {
    return {
      sheetName: periodLabel,
      dayElapsed: 0,
      mode: "kosong",
      topic: "Periode " + periodLabel,
      matchedItems: 0,
      period: periodLabel,
      text: "PERIODE DIMINTA: " + periodLabel + ".\\n" +
        "Tidak ada tab stok untuk bulan tersebut di spreadsheet. Data yang tersedia hanya bulan " +
        _aiMonthLabel_(curM, curY) + " dan bulan-bulan lain yang tabnya sudah ada.\\n" +
        "Sampaikan terus terang bahwa data " + periodLabel + " belum ada."
    };
  }

  data = isCurrent ? _aiSheetData_() : _aiSheetData_({ sheet: sheetForPeriod.getName() });

  const isPast = (period.year < curY) || (period.year === curY && period.month < curM);
  const dayElapsed = isCurrent
    ? (data.dayToDate || curD)
    : (isPast ? _aiDaysInMonth_(period.year, period.month) : 0);''')

rep('''  const out = {
    sheetName: data.sheetName,
    dayElapsed: dayElapsed,
    mode: matched.length ? "item" : "ringkasan",
    topic: matched.length ? matched[0].name : "Ringkasan stok",
    matchedItems: matched.length,
    text: ""
  };''',
    '''  const mutMonth = isCurrent ? 0 : period.month;
  const mutYear = isCurrent ? 0 : period.year;

  const out = {
    sheetName: data.sheetName,
    dayElapsed: dayElapsed,
    mode: matched.length ? "item" : "ringkasan",
    topic: matched.length ? matched[0].name : "Ringkasan stok",
    matchedItems: matched.length,
    period: periodLabel,
    text: ""
  };''')

# pemakaian _aiMutasi_ di dua tempat + label periode di fakta
rep('''      const mut = _aiMutasi_(it.name, AI_MUTASI_ROWS);''',
    '''      const mut = _aiMutasi_(it.name, AI_MUTASI_ROWS, mutMonth, mutYear);''')

rep('''    lines.push("Sheet: " + data.sheetName + " | data sampai tanggal " + dayElapsed);''',
    '''    lines.push("Sheet: " + data.sheetName + " | data sampai tanggal " + dayElapsed + (isCurrent ? "" : " (bulan penuh)"));''')

rep('''    lines.push("TRANSAKSI TERAKHIR YANG DICATAT (paling baru di atas) — siapa input & catatannya:\\n" +
      _aiMutasiText_(_aiMutasi_("", 10)));''',
    '''    lines.push("TRANSAKSI TERAKHIR YANG DICATAT (paling baru di atas) — siapa input & catatannya:\\n" +
      _aiMutasiText_(_aiMutasi_("", 10, mutMonth, mutYear)));''')

# ── 5. prompt: periode + aturan bulan tanpa data
rep('''  const topicBlock = lastTopic ? "\\nTopik yang sedang dibahas: " + String(lastTopic).slice(0, 80) : "";''',
    '''  const topicBlock = (lastTopic ? "\\nTopik yang sedang dibahas: " + String(lastTopic).slice(0, 80) : "") +
    (facts.period ? "\\nPERIODE DATA: " + facts.period : "");''')

rep('''"9. Sebut nama barang dan satuannya dengan lengkap; jangan menulis potongan kode seperti 'IN 2' tanpa nama barang.";''',
    '''"9. Sebut nama barang dan satuannya dengan lengkap; jangan menulis potongan kode seperti 'IN 2' tanpa nama barang.\\n" +
    "10. Kalau FAKTA menyebut periode lain (bulan lalu/bulan tertentu), sebut periodenya dengan jelas supaya tidak dikira data bulan ini. Kalau tab bulan itu tidak ada, katakan datanya belum ada — jangan memakai angka bulan lain sebagai gantinya.";''')

io.open(p, "w", encoding="utf-8").write(s)
print("patched Code.gs")