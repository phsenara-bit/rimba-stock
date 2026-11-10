import io, sys

p = "Code.gs"
s = io.open(p, encoding="utf-8").read()

def rep(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        sys.exit("FAIL (%d): %r" % (n, old[:100]))
    s = s.replace(old, new)

# ── versi cache naik supaya jawaban lama (yang nolak) tidak dipakai lagi ──
rep('const AI_VER = "mirim-8";', 'const AI_VER = "mirim-9";')

# ── 1. helper rentang tanggal + multi-bulan ─────────────────────────────
NEW_FUNCS = r'''// ── Rentang tanggal & perbandingan antar periode ───────────────────
// Pertanyaan seperti "barang keluar terbanyak tanggal 1-7 Oktober dan
// November" itu MASIH topik stok. Rentang tanggal dan lebih dari satu bulan
// dihitung di sini, bukan diserahkan ke model — model hanya merangkai kalimat.
function _aiDayRange_(question) {
  const q = String(question || "").toLowerCase().replace(/[\u2013\u2014]/g, "-");
  const m = q.match(/\b(?:tanggal|tgl\.?|dari)?\s*(\d{1,2})\s*(?:-|sampai|s\/d|sd|hingga)\s*(\d{1,2})\b/);
  if (!m) return null;
  let a = parseInt(m[1], 10);
  let b = parseInt(m[2], 10);
  if (!(a >= 1 && a <= 31) || !(b >= 1 && b <= 31)) return null;
  if (a > b) { const t = a; a = b; b = t; }
  return { from: a, to: b };
}

// Semua bulan yang disebut, urut kemunculan (maks 3). "bulan lalu" ikut.
function _aiMonthsInQuestion_(question) {
  const now = new Date();
  const tz = "Asia/Jakarta";
  const curY = parseInt(Utilities.formatDate(now, tz, "yyyy"), 10);
  const curM = parseInt(Utilities.formatDate(now, tz, "MM"), 10);
  const q = String(question || "").toLowerCase();
  const ym = q.match(/\b(20\d{2})\b/);
  const y = ym ? parseInt(ym[1], 10) : curY;

  const out = [];
  const re = /\b(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|agu|agt|ags|sep|sept|okt|nov|des)\b/g;
  let m;
  while ((m = re.exec(q)) !== null) {
    const mm = AI_MONTHS[m[1]];
    if (!mm) continue;
    if (out.some(function (x) { return x.month === mm; })) continue;
    out.push({ month: mm, year: y, explicit: true });
    if (out.length >= 3) break;
  }

  if (/bulan\s+(lalu|kemarin)/.test(q)) {
    const pm = curM === 1 ? 12 : curM - 1;
    const py = curM === 1 ? curY - 1 : curY;
    if (!out.some(function (x) { return x.month === pm && x.year === py; })) {
      out.push({ month: pm, year: py, explicit: true });
    }
  }
  return out;
}

// Hari yang datanya sudah ada untuk bulan itu (bulan berjalan ikut tanggal hari ini)
function _aiMonthDays_(p, isCurrent, data, curD) {
  const total = _aiDaysInMonth_(p.year, p.month);
  if (isCurrent) {
    const av = parseInt((data && data.dayToDate) || curD, 10) || curD;
    return Math.min(total, av);
  }
  return total;
}

// Agregat IN/OUT untuk satu rentang tanggal di satu bulan
function _aiRangeRows_(data, from, to) {
  const items = (data && data.items) || [];
  const a = Math.max(1, parseInt(from, 10) || 1);
  const b = Math.max(a, parseInt(to, 10) || a);
  let totalOut = 0;
  let totalIn = 0;
  const rows = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const h = it.dailyHistory || {};
    let o = 0;
    let n = 0;
    for (let d = a; d <= b; d++) {
      const c = h[d];
      if (!c) continue;
      o += Number(c.out || 0);
      n += Number(c.in || 0);
    }
    if (o === 0 && n === 0) continue;
    rows.push({
      name: it.name, unit: it.unit, division: it.division,
      out: Math.round(o * 1000) / 1000, inQty: Math.round(n * 1000) / 1000
    });
    totalOut += o;
    totalIn += n;
  }
  rows.sort(function (x, y) { return y.out - x.out; });
  return {
    from: a, to: b,
    totalOut: Math.round(totalOut * 1000) / 1000,
    totalIn: Math.round(totalIn * 1000) / 1000,
    rows: rows
  };
}

function _aiLoadPeriod_(p, curM, curY) {
  const isCurrent = (p.month === curM && p.year === curY);
  if (isCurrent) {
    const d = _aiSheetData_();
    return { period: p, isCurrent: true, data: d, label: _aiMonthLabel_(p.month, p.year) };
  }
  let sh = null;
  try { sh = _findMonthlySheet_(SpreadsheetApp.getActiveSpreadsheet(), p.year, p.month); } catch (e) { sh = null; }
  if (!sh) return { period: p, isCurrent: false, data: null, label: _aiMonthLabel_(p.month, p.year) };
  const d = _aiSheetData_({ sheet: sh.getName() });
  return { period: p, isCurrent: false, data: d, label: _aiMonthLabel_(p.month, p.year) };
}

// Fakta untuk pertanyaan rentang tanggal dan/atau beberapa bulan sekaligus.
function _aiRangeFacts_(question, range, months, topN) {
  const now = new Date();
  const tz = "Asia/Jakarta";
  const curY = parseInt(Utilities.formatDate(now, tz, "yyyy"), 10);
  const curM = parseInt(Utilities.formatDate(now, tz, "MM"), 10);
  const curD = parseInt(Utilities.formatDate(now, tz, "dd"), 10);

  const n = topN || 5;
  const rg = range && range.from ? range : { from: 1, to: 31 };
  const list = (months && months.length) ? months.slice(0, 3) : [{ month: curM, year: curY, explicit: false }];

  const blocks = [];
  const built = [];

  for (let i = 0; i < list.length; i++) {
    const lp = _aiLoadPeriod_(list[i], curM, curY);
    if (!lp.data) {
      blocks.push("PERIODE tanggal " + rg.from + "-" + rg.to + " " + lp.label +
        ": TIDAK ADA tab stok untuk bulan ini — datanya memang belum ada.");
      built.push({ label: lp.label, rows: [], totalOut: 0, totalIn: 0, missing: true });
      continue;
    }
    const avail = _aiMonthDays_(list[i], lp.isCurrent, lp.data, curD);
    const to = Math.min(rg.to, avail);
    const rs = _aiRangeRows_(lp.data, rg.from, to);
    const rl = "tanggal " + rs.from + "-" + to + " " + lp.label;
    const lines = [];
    lines.push("PERIODE: " + rl + (to < rg.to ? " (data baru sampai tanggal " + avail + ")" : ""));
    lines.push("Total OUT: " + _aiNum_(rs.totalOut) + " satuan | Total IN: " + _aiNum_(rs.totalIn) + " satuan");
    lines.push("Barang keluar terbanyak (" + Math.min(n, rs.rows.length) + " teratas): " +
      (rs.rows.length
        ? rs.rows.slice(0, n).map(function (r) { return r.name + " " + _aiNum_(r.out) + " " + r.unit; }).join(", ")
        : "tidak ada mutasi keluar"));
    blocks.push(lines.join("\n"));
    built.push({ label: lp.label, rangeLabel: rl, rows: rs.rows, totalOut: rs.totalOut, totalIn: rs.totalIn, missing: false, to: to });
  }

  // ── Blok perbandingan (kalau lebih dari satu periode) ──
  if (built.length >= 2) {
    const A = built[0];
    const B = built[1];
    const cl = [];
    cl.push("PERBANDINGAN: " + A.label + " vs " + B.label + " (rentang sama, tanggal " + rg.from + "-" + rg.to + ")");

    const diff = Math.round((B.totalOut - A.totalOut) * 1000) / 1000;
    cl.push("Total OUT: " + _aiNum_(A.totalOut) + " → " + _aiNum_(B.totalOut) +
      " (" + (diff >= 0 ? "+" : "-") + _aiNum_(Math.abs(diff)) + " satuan)");

    if (A.rows.length) cl.push("Peringkat 1 keluar " + A.label + ": " + A.rows[0].name + " " + _aiNum_(A.rows[0].out) + " " + A.rows[0].unit);
    if (B.rows.length) cl.push("Peringkat 1 keluar " + B.label + ": " + B.rows[0].name + " " + _aiNum_(B.rows[0].out) + " " + B.rows[0].unit);

    const ma = {};
    const mb = {};
    for (let i = 0; i < A.rows.length; i++) ma[A.rows[i].name] = A.rows[i].out;
    for (let i = 0; i < B.rows.length; i++) mb[B.rows[i].name] = B.rows[i].out;

    const naik = [];
    const turun = [];
    const baru = [];
    const hilang = [];
    for (const k in mb) {
      if (!(k in ma)) {
        if (mb[k] > 0) baru.push({ name: k, v: mb[k] });
      } else {
        const d = Math.round((mb[k] - ma[k]) * 1000) / 1000;
        if (d > 0) naik.push({ name: k, v: d });
        else if (d < 0) turun.push({ name: k, v: d });
      }
    }
    for (const k in ma) if (!(k in mb) && ma[k] > 0) hilang.push({ name: k, v: ma[k] });

    naik.sort(function (x, y) { return y.v - x.v; });
    turun.sort(function (x, y) { return x.v - y.v; });
    baru.sort(function (x, y) { return y.v - x.v; });
    hilang.sort(function (x, y) { return y.v - x.v; });

    if (naik.length) cl.push("Naik: " + naik.slice(0, 5).map(function (r) { return r.name + " +" + _aiNum_(r.v); }).join(", "));
    if (turun.length) cl.push("Turun: " + turun.slice(0, 5).map(function (r) { return r.name + " " + _aiNum_(r.v); }).join(", "));
    if (baru.length) cl.push("Baru keluar " + B.label + " (tidak ada " + A.label + "): " + baru.slice(0, 5).map(function (r) { return r.name + " " + _aiNum_(r.v); }).join(", "));
    if (hilang.length) cl.push("Tidak keluar lagi " + B.label + ": " + hilang.slice(0, 5).map(function (r) { return r.name + " " + _aiNum_(r.v); }).join(", "));
    blocks.push(cl.join("\n"));
  }

  const periodLabel = built.length >= 2
    ? ("tanggal " + rg.from + "-" + rg.to + " " + built[0].label + " vs " + built[1].label)
    : ("tanggal " + rg.from + "-" + rg.to + " " + (built[0] ? built[0].label : _aiMonthLabel_(curM, curY)));

  return {
    sheetName: built.map(function (b) { return b.label; }).join(" vs "),
    dayElapsed: rg.to,
    mode: built.length >= 2 ? "banding" : "rentang",
    topic: "Rentang tanggal " + rg.from + "-" + rg.to,
    matchedItems: 0,
    period: periodLabel,
    isCurrent: false,
    today: curD + " " + _aiMonthLabel_(curM, curY),
    note: "Pengguna menanyakan rentang tanggal / perbandingan antar periode. Ini MASIH topik stok dan angkanya SUDAH dihitung di FAKTA. " +
      "Jangan menolak, jangan bilang di luar topik, dan jangan bilang tidak bisa per tanggal. Jawab pakai angka di blok PERIODE/PERBANDINGAN.",
    text: blocks.join("\n\n")
  };
}

'''

rep("function _aiFacts_(question, hintTopic) {", NEW_FUNCS + "function _aiFacts_(question, hintTopic) {")

# ── 2. cabang awal di _aiFacts_ ─────────────────────────────────────────
rep('''  const curD = parseInt(Utilities.formatDate(now, tz, "dd"), 10);

  const period = _aiTargetMonth_(question);''',
'''  const curD = parseInt(Utilities.formatDate(now, tz, "dd"), 10);

  // Rentang tanggal atau lebih dari satu bulan → tetap topik stok.
  // Jangan jatuh ke mode ringkasan satu bulan, karena model lalu mengira
  // pertanyaannya di luar konteks dan menolak menjawab.
  const qRange = _aiDayRange_(question);
  const qMonths = _aiMonthsInQuestion_(question);
  if (qRange || qMonths.length >= 2) {
    return _aiRangeFacts_(question, qRange, qMonths);
  }

  const period = _aiTargetMonth_(question);''')

# ── 3. prompt: izin eksplisit untuk perbandingan + catatan periode ──────
rep('''    "1. Kamu HANYA menjawab soal data stok Rimba Alam: jumlah stok, kenapa minus, tanggal mulai minus, nilai stok, barang kritis, siapa yang input, dan catatan/alasan input. " +''',
'''    "1. Kamu HANYA menjawab soal data stok Rimba Alam: jumlah stok, kenapa minus, tanggal mulai minus, nilai stok, barang kritis, siapa yang input, catatan/alasan input, " +
    "barang paling banyak keluar/masuk, peringkat barang, total IN/OUT per rentang tanggal (mis. tanggal 1-7), dan perbandingan antar periode atau antar bulan. " +''')

rep('''    "11. Selalu sebut nama bulannya (mis. 'Oktober 2026'), jangan menulis 'bulan ini' kalau PERIODE DATA bukan bulan berjalan. Kalau tab bulan yang diminta tidak ada, katakan datanya belum ada — jangan memakai angka bulan lain sebagai gantinya.";''',
'''    "11. Selalu sebut nama bulannya (mis. 'Oktober 2026'), jangan menulis 'bulan ini' kalau PERIODE DATA bukan bulan berjalan. Kalau tab bulan yang diminta tidak ada, katakan datanya belum ada — jangan memakai angka bulan lain sebagai gantinya.\\n" +
    "12. Kalau FAKTA memuat blok PERBANDINGAN, jawab dengan membandingkan angkanya: sebut barang terbanyak di masing-masing periode, lalu siapa yang naik dan siapa yang turun beserta selisihnya. " +
    "Ini pertanyaan yang sah — jangan menolak dan jangan bilang di luar topik stok.\\n" +
    "13. Rentang tanggal (mis. 'tanggal 1-7') sudah dihitung di FAKTA. Jawab langsung pakai angka itu; jangan bilang tidak bisa dihitung per tanggal.\\n" +
    "14. Kalau satu periode datanya belum ada, sebutkan periode mana yang kosong, lalu tetap jawab periode yang ada datanya.";''')

rep('''  return sys + topicBlock + histBlock + "\\n\\nFAKTA:\\n" + facts.text + periodNote + "\\n\\nPERTANYAAN: " + question;''',
'''  const noteBlock = (facts && facts.note) ? "\\n\\n" + facts.note : "";

  return sys + topicBlock + histBlock + "\\n\\nFAKTA:\\n" + facts.text + periodNote + noteBlock + "\\n\\nPERTANYAAN: " + question;''')

io.open(p, "w", encoding="utf-8").write(s)
print("Code.gs dipatch: helper rentang tanggal + multi-periode, prompt v9")
