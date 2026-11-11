// ═════════════════════ BAGIAN 3: ASISTEN "MIRIM" (TANYA STOK) ═════════════════════
// Mirim hanya menjawab soal data stok Rimba Alam, dan hanya untuk akun admin.
// Semua fungsi berawalan _ai agar tidak bentrok dengan kode v3.2.
//
// Konfigurasi lewat Script Properties (Project Settings > Script Properties):
//   AI_PROVIDER     = gemini | openai   (default: gemini)
//   AI_KEY          = API key (WAJIB)
//   AI_MODEL        = nama model        (default: gemini-3.5-flash-lite / gpt-4o-mini)
//   AI_BASE_URL     = opsional, untuk provider openai-compatible (mis. https://api-plan.vikey.ai/v1)
//   AI_DAILY_LIMIT  = batas pertanyaan per admin per hari (default: 60)
//
// Prinsip: ANGKA DIHITUNG DI SINI, model hanya merangkai kalimat.

const AI_HISTORY_MAX_TURNS = 2;   // giliran riwayat yang ikut dikirim
const AI_CACHE_SECONDS = 600;     // jawaban sama dalam 10 menit tidak memanggil model
const AI_MAX_QUESTION = 300;
const AI_MUTASI_SCAN = 400;       // baris log mutasi terakhir yang dibaca
const AI_MUTASI_ROWS = 12;        // baris mutasi per barang yang dikirim ke model
const AI_VER = "mirim-12";         // naikkan saat prompt/format fakta berubah → cache lama gugur

const AI_MONTHS = {
  januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
  juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, agu: 8, agt: 8, ags: 8,
  sep: 9, sept: 9, okt: 10, nov: 11, des: 12, dec: 12
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

  if (/bulan\s+(ini|sekarang|berjalan)|this month|current month/.test(q)) {
    return { month: curM, year: curY, explicit: true };
  }

  if (/bulan\s+(lalu|kemarin)|last month|previous month/.test(q)) {
    const m = curM === 1 ? 12 : curM - 1;
    const y = curM === 1 ? curY - 1 : curY;
    return { month: m, year: y, explicit: true };
  }

  const re = /\b(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|agu|agt|ags|sep|sept|okt|nov|des)\b/g;
  const hits = q.match(re);
  if (hits && hits.length) {
    const m = AI_MONTHS[hits[0]];
    if (m) {
      const ym = q.match(/\b(20\d{2})\b/);
      const y = ym ? parseInt(ym[1], 10) : curY;
      return { month: m, year: y, explicit: true };
    }
  }

  return { month: curM, year: curY, explicit: false };
}

function _aiProp_(name, fallback) {
  try {
    const v = PropertiesService.getScriptProperties().getProperty(name);
    return v && String(v).trim() ? String(v).trim() : fallback;
  } catch (err) {
    return fallback;
  }
}

function _aiJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function _aiError_(code, message) {
  return _aiJson_({ success: false, code: code, message: message });
}

// Mirim khusus admin (admin / superadmin / owner). Dicek dua kali: di router
// dan di pintu masuk ini, supaya tidak bisa dilewati lewat jalur mana pun.
function _aiIsAllowed_(user) {
  if (!user || !user.role) return false;
  return _g2IsPrivileged(user.role);
}

// Status Mirim untuk diagnosa: hanya boolean + nama model + error terakhir
// yang sudah dipotong. Tidak pernah memuat kunci atau data stok.
function _aiStatusPayload_() {
  const provider = String(_aiProp_("AI_PROVIDER", "gemini")).toLowerCase();
  let lastError = "";
  let lastErrorAt = "";
  try {
    const p = PropertiesService.getScriptProperties();
    lastError = String(p.getProperty("AI_LAST_ERROR") || "");
    lastErrorAt = String(p.getProperty("AI_LAST_ERROR_AT") || "");
  } catch (err) {}
  return {
    success: true,
    mirim: true,
    configured: !!_aiProp_("AI_KEY", ""),
    provider: provider,
    model: _aiProp_("AI_MODEL", provider === "gemini" ? "gemini-3.5-flash-lite" : "gpt-4o-mini"),
    lastError: lastError.slice(0, 220),
    lastErrorAt: lastErrorAt,
    lastOkAt: (function () {
      try { return String(PropertiesService.getScriptProperties().getProperty("AI_LAST_OK_AT") || ""); }
      catch (e) { return ""; }
    })()
  };
}

function _aiRememberError_(msg) {
  try {
    const p = PropertiesService.getScriptProperties();
    p.setProperty("AI_LAST_ERROR", String(msg || "").slice(0, 220));
    p.setProperty("AI_LAST_ERROR_AT", Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss"));
  } catch (err) {}
}

// ── Pintu masuk ────────────────────────────────────────────────────
function handleAskAI_(e, user, payload) {
  if (!_aiIsAllowed_(user)) {
    return _aiError_("FORBIDDEN", "Mirim khusus untuk akun admin.");
  }

  const params = (e && e.parameter) || {};
  const src = payload || {};
  const question = String(src.q || params.q || "").trim().slice(0, AI_MAX_QUESTION);
  if (!question) return _aiError_("EMPTY", "Pertanyaan kosong.");

  if (!_aiProp_("AI_KEY", "")) {
    _aiRememberError_("NOT_CONFIGURED: AI_KEY kosong di Script Properties");
    return _aiError_("NOT_CONFIGURED", "Mirim belum aktif: kunci AI belum dipasang di server.");
  }

  const username = (user && user.username) || "unknown";

  // Batas harian per admin
  const limit = parseInt(_aiProp_("AI_DAILY_LIMIT", "60"), 10) || 60;
  const today = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyyMMdd");
  const quotaKey = "ai_q_" + today + "_" + username;
  let used = 0;
  try {
    used = parseInt(PropertiesService.getScriptProperties().getProperty(quotaKey) || "0", 10) || 0;
  } catch (err) { used = 0; }
  if (used >= limit) {
    return _aiError_("QUOTA", "Batas " + limit + " pertanyaan per hari sudah tercapai. Coba lagi besok.");
  }

  // Cache: pertanyaan identik dalam 10 menit
  let cache = null;
  let cacheKey = "";
  try {
    cache = CacheService.getScriptCache();
    cacheKey = "ai_" + AI_VER + "_" + _aiHash_(username + "|" + question.toLowerCase() + "|" + today);
    const hit = cache.get(cacheKey);
    if (hit) {
      const parsed = JSON.parse(hit);
      parsed.cached = true;
      return _aiJson_(parsed);
    }
  } catch (err) { cache = null; }

  let out;
  try {
    const facts = _aiFacts_(question, src.topic);
    const prompt = _aiPrompt_(facts, question, src.history, src.topic);
    const answer = _aiCall_(prompt);
    out = {
      success: true,
      answer: answer,
      topic: facts.topic,
      meta: {
        sheet: facts.sheetName,
        day: facts.dayElapsed,
        items: facts.matchedItems,
        mode: facts.mode,
        used: used + 1,
        limit: limit
      }
    };
  } catch (err) {
    // Detail hanya ke log, jangan bocor ke klien
    console.error("[askAI] " + (err && err.stack ? err.stack : err));
    _aiRememberError_(err && err.message ? err.message : String(err));
    return _aiError_("FAILED", "Mirim sedang tidak bisa menjawab. Coba lagi sebentar lagi.");
  }

  try {
    if (cache && cacheKey) cache.put(cacheKey, JSON.stringify(out), AI_CACHE_SECONDS);
    PropertiesService.getScriptProperties().setProperty(quotaKey, String(used + 1));
    PropertiesService.getScriptProperties().deleteProperty("AI_LAST_ERROR");
  } catch (err) { /* kuota gagal dicatat: jangan gagalkan jawaban */ }

  return _aiJson_(out);
}

function _aiHash_(s) {
  // Simple deterministic hash (FNV-1a 32-bit) untuk kunci cache
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h.toString(36);
}

// ── Data mentah: pakai ulang pembaca sheet milik aplikasi ───────────
function _aiSheetData_(params) {
  const res = handleReadMonthlySheetData({ parameter: params || {} });
  const obj = JSON.parse(res.getContent());
  if (!obj || !obj.success) {
    throw new Error((obj && obj.message) || "Data spreadsheet tidak terbaca");
  }
  return obj;
}

// ── Log mutasi (siapa yang input + catatan/alasan) ─────────────────
// Kolom MUTASI_APP: 1 ID, 2 Waktu, 3 Divisi, 4 Nama Staf, 5 ID Barang,
// 6 Nama Barang, 7 Satuan, 8 Tipe, 9 Qty, 10 Catatan, 11 Harga, 12 Total.
function _aiNormName_(s) {
  return String(s || "").toLowerCase()
    .replace(/@[^a-z0-9]*/g, " ")
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Nama di MUTASI_APP sering tidak persis sama dengan nama di tab bulanan
// (mis. "Minyak Goreng" vs "Minyak Goreng @2000ml"), jadi dicocokkan longgar.
function _aiSameItem_(a, b) {
  const x = _aiNormName_(a);
  const y = _aiNormName_(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.indexOf(y) === 0 || y.indexOf(x) === 0) return true;
  const xw = x.split(" ").slice(0, 2).join(" ");
  const yw = y.split(" ").slice(0, 2).join(" ");
  return xw === yw && xw.length >= 4;
}

function _aiMutasi_(itemName, limit, month, year) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss || typeof ss.getSheetByName !== "function") return [];
    const sh = ss.getSheetByName(SHEET_LOG_NAME);
    if (!sh) return [];
    const last = sh.getLastRow();
    if (last < 2) return [];
    const start = Math.max(2, last - AI_MUTASI_SCAN + 1);
    const rows = sh.getRange(start, 1, last - start + 1, 12).getValues();
    const want = String(itemName || "").trim().toLowerCase();
    const out = [];
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i] || [];
      const name = String(r[5] || "").trim();
      if (!name) continue;
      if (want && !_aiSameItem_(name, itemName)) continue;
      if (month && year) {
        const w = String(r[1] || "").slice(0, 10);           // "yyyy-MM-dd"
        const prefix = year + "-" + (month < 10 ? "0" + month : String(month));
        if (w.indexOf(prefix) !== 0) continue;
      }
      const qty = parseFloat(String(r[8] || "0").replace(/,/g, ".")) || 0;
      out.push({
        waktu: String(r[1] || ""),
        tipe: String(r[7] || "").trim().toUpperCase(),
        qty: qty,
        catatan: String(r[9] || "").trim(),
        staf: String(r[3] || "").trim(),
        satuan: String(r[6] || "").trim(),
        barang: name
      });
      if (out.length >= (limit || AI_MUTASI_ROWS)) break;
    }
    return out;
  } catch (err) {
    console.warn("[askAI] log mutasi tidak terbaca: " + (err && err.message ? err.message : err));
    return [];
  }
}

function _aiWaktu_(raw) {
  const s = String(raw || "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return s.slice(0, 16) || "-";
  const bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return parseInt(m[3], 10) + " " + (bulan[parseInt(m[2], 10) - 1] || m[2]) + " " + m[4] + ":" + m[5];
}

function _aiMutasiText_(rows) {
  if (!rows || !rows.length) return "Tidak ada catatan transaksi yang bisa dibaca untuk ini.";
  const lines = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const qtyTxt = _aiNum_(Math.abs(r.qty)) + (r.satuan ? " " + r.satuan : "");
    const siapa = r.staf && r.staf !== "-" ? r.staf : "TIDAK TERCATAT";
    let line = _aiWaktu_(r.waktu) + " | " + (r.barang || "-") + " | " + r.tipe + " " + qtyTxt + " | diinput oleh: " + siapa;
    line += " | catatan: " + (r.catatan && r.catatan !== "-" ? r.catatan : "TIDAK ADA CATATAN ALASAN");
    lines.push(line);
  }
  return lines.join("\n");
}

// ── Penyusun fakta ─────────────────────────────────────────────────
const AI_STOPWORDS = {
  yang: 1, apa: 1, apakah: 1, berapa: 1, kapan: 1, kenapa: 1, mengapa: 1, bagaimana: 1,
  untuk: 1, dari: 1, dengan: 1, bulan: 1, ini: 1, itu: 1, ada: 1, tidak: 1, dan: 1,
  atau: 1, bisa: 1, kok: 1, jadi: 1, saja: 1, masih: 1, sudah: 1, akan: 1, kita: 1,
  stok: 1, stock: 1, sisa: 1, jumlah: 1, total: 1, sekarang: 1, hari: 1, per: 1,
  siapa: 1, input: 1, masuk: 1, keluar: 1, barang: 1, mirim: 1, tanya: 1,
  // kata perintah/pertanyaan — bukan nama barang, jangan dipakai mencocokkan
  out: 1, cari: 1, carikan: 1, lalu: 1, brpa: 1, data: 1, semua: 1, sebutkan: 1,
  divisi: 1, kategori: 1, perbandingan: 1, banding: 1, selisih: 1, riwayat: 1,
  catatan: 1, paling: 1, banyak: 1, sedikit: 1, tertinggi: 1, terendah: 1,
  nya: 1, nilai: 1, harga: 1, kasih: 1, tunjuk: 1, tunjukkan: 1, tampilkan: 1,
  // nama bulan sudah dibaca periode, jangan ikut mencocokkan nama barang
  januari: 1, februari: 1, maret: 1, april: 1, mei: 1, juni: 1, juli: 1,
  agustus: 1, september: 1, oktober: 1, november: 1, desember: 1,
  jan: 1, feb: 1, mar: 1, apr: 1, jun: 1, jul: 1, agu: 1, agt: 1, ags: 1,
  sep: 1, sept: 1, okt: 1, nov: 1, des: 1, dec: 1,
  tanggal: 1, tgl: 1, periode: 1, kemarin: 1, sekarang: 1
};

function _aiTokens_(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(function (t) { return t.length >= 3 && !AI_STOPWORDS[t]; });
}

function _aiFindItems_(data, question, refItems) {
  const toks = _aiTokens_(question);
  if (!toks.length) return [];

  // Hanya kata yang benar-benar muncul di nama barang yang dipakai menakar
  // kecocokan. Tanpa ini, kata satuan/keterangan seperti "karung" (nama di
  // sheet: "Beras 1 Krng =50kg") atau "sisanya" membuat barang yang jelas
  // disebut jadi tidak ditemukan sama sekali.
  // Kata dianggap "nama barang" kalau muncul di daftar acuan. Untuk pertanyaan
  // soal bulan lalu, acuannya katalog bulan berjalan — supaya "ayam cut 4" tetap
  // dikenali sebagai nama utuh walau bulan itu belum punya barangnya.
  const ref = (refItems && refItems.length) ? refItems : data.items;
  const nameToks = [];
  for (let t = 0; t < toks.length; t++) {
    for (let i = 0; i < ref.length; i++) {
      if (String(ref[i].name || "").toLowerCase().indexOf(toks[t]) !== -1) {
        nameToks.push(toks[t]);
        break;
      }
    }
  }
  const used = nameToks.length ? nameToks : toks;

  const normQ = used.join(" ");
  const scored = [];
  for (let i = 0; i < data.items.length; i++) {
    const it = data.items[i];
    const name = String(it.name || "").toLowerCase();
    const normName = name.replace(/[^a-z0-9]+/g, " ").trim();
    let hit = 0;
    for (let t = 0; t < used.length; t++) {
      if (name.indexOf(used[t]) !== -1) hit++;
    }
    if (!hit) continue;
    scored.push({
      item: it,
      score: hit,
      // frasa utuh ada di nama (mis. "ayam cut" di "Ayam Cut 4") = paling yakin
      strong: normName.indexOf(normQ) !== -1,
      nameLen: normName.length
    });
  }

  // Kalau pertanyaan menyebut 2 kata atau lebih, barang harus cocok minimal 2.
  // Tanpa ini "ayam cut 4" ikut menjaring "Ayam Kampung" hanya karena "ayam".
  const minHit = used.length >= 2 ? 2 : 1;
  const pool = scored.filter(function (s) { return s.strong || s.score >= minHit; });
  if (!pool.length) return [];

  pool.sort(function (a, b) {
    if (a.strong !== b.strong) return a.strong ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    if (a.nameLen !== b.nameLen) return a.nameLen - b.nameLen;   // nama terpendek = paling spesifik
    return Math.abs(a.item.stock) - Math.abs(b.item.stock);
  });
  return pool.slice(0, 3).map(function (s) { return s.item; });
}

// Pertanyaan yang minta daftar/katalog, bukan sekadar angka ringkasan.
function _aiWantsCatalog_(question) {
  return /(sebutkan|sebut aja|daftar|list|katalog|semua barang|semua item|barang apa saja|apa saja|nama barang|jumlah barang|ada barang apa)/i
    .test(String(question || ""));
}

function _aiNum_(n) {
  const v = Math.round(Number(n || 0) * 1000) / 1000;
  return String(v).replace(".", ",");
}

function _aiRupiah_(n) {
  return "Rp" + String(Math.round(Number(n || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Diagnosa deterministik per barang
function _aiDiagnose_(item, dayElapsed) {
  const hist = item.dailyHistory || {};
  const days = Object.keys(hist).map(Number).sort(function (a, b) { return a - b; });

  let running = Number(item.stokAwal || 0);
  let firstNegative = null;
  const negativeTrail = [];
  const buyDays = [];
  const outValues = [];
  let outAfterLastBuy = 0;
  let lastBuyDay = null;

  for (let d = 1; d <= (dayElapsed || 31); d++) {
    const cell = hist[d];
    if (!cell) continue;
    const vin = Number(cell.in || 0);
    const vout = Number(cell.out || 0);
    if (vin > 0) { buyDays.push(d + "(" + _aiNum_(vin) + ")"); lastBuyDay = d; }
    if (vout > 0) outValues.push(vout);
    running = running + vin - vout;
    if (running < 0) {
      if (firstNegative === null) firstNegative = d;
      negativeTrail.push("tgl" + d + "=" + _aiNum_(running));
    }
  }
  if (lastBuyDay !== null) {
    for (let k = 0; k < days.length; k++) {
      if (days[k] > lastBuyDay) outAfterLastBuy += Number((hist[days[k]] || {}).out || 0);
    }
  }

  // Deteksi qty OUT yang jauh di atas kebiasaan (indikasi salah input)
  let outlier = "";
  if (outValues.length >= 3) {
    const sorted = outValues.slice().sort(function (a, b) { return a - b; });
    const median = sorted[Math.floor(sorted.length / 2)];
    const thr = median * 3;
    const sus = [];
    for (let d = 1; d <= (dayElapsed || 31); d++) {
      const cell = hist[d];
      if (cell && Number(cell.out || 0) > thr) sus.push("tgl" + d + " qty " + _aiNum_(cell.out));
    }
    if (sus.length) outlier = sus.join(", ") + " (rata-rata normal sekitar " + _aiNum_(median) + ")";
  }

  const avgOut = dayElapsed > 0 ? Number(item.outQtyMonth || 0) / dayElapsed : 0;
  const lines = [];
  lines.push("Stok awal: " + _aiNum_(item.stokAwal) + " " + item.unit);
  lines.push("Total IN bulan: " + _aiNum_(item.inQtyMonth) + " | Total OUT bulan: " + _aiNum_(item.outQtyMonth));
  lines.push("Stok akhir: " + _aiNum_(item.stock) + " " + item.unit);
  lines.push("Rata-rata OUT: " + _aiNum_(avgOut) + " " + item.unit + "/hari (sampai tanggal " + (dayElapsed || "-") + ")");
  lines.push("Tanggal ada pembelian (IN): " + (buyDays.length ? buyDays.join(", ") : "TIDAK ADA pembelian bulan ini"));
  if (firstNegative !== null) lines.push("Mulai minus pada: tanggal " + firstNegative + " (" + negativeTrail[0] + ")");
  if (lastBuyDay !== null) lines.push("OUT setelah pembelian terakhir (tgl " + lastBuyDay + "): " + _aiNum_(outAfterLastBuy) + " " + item.unit);
  if (outlier) lines.push("Qty OUT tidak wajar: " + outlier);
  if (item.stock < 0) lines.push("Status: MINUS " + _aiNum_(item.stock) + " " + item.unit + " (perlu koreksi/opname)");

  return { text: lines.join("\n"), firstNegative: firstNegative, buyDays: buyDays, avgOut: avgOut };
}

// ── Rentang tanggal & perbandingan antar periode ───────────────────
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

// Semua periode yang disebut, urut kemunculan di kalimat (maks 3).
// "bulan ini" dan "bulan lalu" dua-duanya terdeteksi, supaya pertanyaan
// "bulan ini dan bulan lalu" benar-benar membandingkan dua periode — bukan
// dianggap satu periode dan diam-diam dijawab dengan data bulan lalu.
function _aiMonthsInQuestion_(question) {
  const now = new Date();
  const tz = "Asia/Jakarta";
  const curY = parseInt(Utilities.formatDate(now, tz, "yyyy"), 10);
  const curM = parseInt(Utilities.formatDate(now, tz, "MM"), 10);
  const q = String(question || "").toLowerCase();
  const ym = q.match(/\b(20\d{2})\b/);
  const y = ym ? parseInt(ym[1], 10) : curY;

  const prevM = curM === 1 ? 12 : curM - 1;
  const prevY = curM === 1 ? curY - 1 : curY;
  const THIS = /^(bulan\s+ini|bulan\s+sekarang|periode\s+ini|bulan\s+berjalan)$/;
  const PREV = /^(bulan\s+lalu|bulan\s+kemarin)$/;

  const out = [];
  const push = function (m, yy) {
    if (!m) return;
    if (out.some(function (x) { return x.month === m && x.year === yy; })) return;
    out.push({ month: m, year: yy, explicit: true });
  };

  const re = /\b(bulan\s+ini|bulan\s+sekarang|periode\s+ini|bulan\s+berjalan|bulan\s+lalu|bulan\s+kemarin|januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|agu|agt|ags|sep|sept|okt|nov|des|dec)\b/g;
  let m;
  while ((m = re.exec(q)) !== null) {
    const w = m[1];
    if (THIS.test(w)) push(curM, curY);
    else if (PREV.test(w)) push(prevM, prevY);
    else push(AI_MONTHS[w], y);
    if (out.length >= 3) break;
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
    built.push({ label: lp.label, rangeLabel: rl, rows: rs.rows, totalOut: rs.totalOut, totalIn: rs.totalIn, missing: false, to: to, data: lp.data });
  }

  // Kalau pengguna menyebut barang tertentu, tampilkan angka barang ITU di
  // setiap periode. Daftar "5 terbesar" belum tentu memuat barangnya, dan
  // tanpa blok ini model menjawab "tidak ada data" untuk barang yang ada.
  // Cari barangnya di SEMUA periode, bukan cuma periode pertama: barang bisa
  // saja tidak ada di bulan berjalan tapi ada di bulan lalu (atau sebaliknya).
  const refAll = [];
  for (let ri = 0; ri < built.length; ri++) {
    if (!built[ri].data) continue;
    for (let rj = 0; rj < built[ri].data.items.length; rj++) refAll.push(built[ri].data.items[rj]);
  }

  const asked = [];
  for (let bi = 0; bi < built.length; bi++) {
    if (!built[bi].data) continue;
    const found = _aiFindItems_(built[bi].data, question, refAll);
    for (let fi = 0; fi < found.length; fi++) {
      if (!asked.some(function (x) { return x.name === found[fi].name; })) asked.push(found[fi]);
    }
    if (asked.length >= 2) break;
  }
  {
    if (asked.length) {
      const detail = ["BARANG YANG DITANYA (angka per periode):"];
      for (let i = 0; i < Math.min(asked.length, 2); i++) {
        const it = asked[i];
        const per = [];
        for (let k = 0; k < built.length; k++) {
          const b = built[k];
          if (!b.data) { per.push(b.label + ": tab bulan itu belum ada"); continue; }
          let found = null;
          for (let y = 0; y < b.data.items.length; y++) {
            if (b.data.items[y].name === it.name) { found = b.data.items[y]; break; }
          }
          if (!found) { per.push(b.label + ": barang tidak ada di tab bulan itu"); continue; }
          const rr = _aiRangeRows_(b.data, rg.from, b.to || rg.to);
          let rrow = null;
          for (let x = 0; x < rr.rows.length; x++) if (rr.rows[x].name === it.name) { rrow = rr.rows[x]; break; }
          per.push(b.label + ": OUT " + _aiNum_(rrow ? rrow.out : 0) + " " + it.unit +
            " | IN " + _aiNum_(rrow ? rrow.inQty : 0) + " " + it.unit +
            " | stok akhir " + _aiNum_(found.stock) + " " + it.unit);
        }
        detail.push(it.name + " → " + per.join(" ; "));
      }
      blocks.push(detail.join("\n"));
    }
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

function _aiFacts_(question, hintTopic) {
  const now = new Date();
  const tz = "Asia/Jakarta";
  const curY = parseInt(Utilities.formatDate(now, tz, "yyyy"), 10);
  const curM = parseInt(Utilities.formatDate(now, tz, "MM"), 10);
  const curD = parseInt(Utilities.formatDate(now, tz, "dd"), 10);

  // Rentang tanggal atau lebih dari satu bulan → tetap topik stok.
  // Jangan jatuh ke mode ringkasan satu bulan, karena model lalu mengira
  // pertanyaannya di luar konteks dan menolak menjawab.
  const qRange = _aiDayRange_(question);
  const qMonths = _aiMonthsInQuestion_(question);
  if (qRange || qMonths.length >= 2) {
    return _aiRangeFacts_(question, qRange, qMonths);
  }

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
      text: "PERIODE DIMINTA: " + periodLabel + ".\n" +
        "Tidak ada tab stok untuk bulan tersebut di spreadsheet. Data yang tersedia hanya bulan " +
        _aiMonthLabel_(curM, curY) + " dan bulan-bulan lain yang tabnya sudah ada.\n" +
        "Sampaikan terus terang bahwa data " + periodLabel + " belum ada."
    };
  }

  data = isCurrent ? _aiSheetData_() : _aiSheetData_({ sheet: sheetForPeriod.getName() });

  const isPast = (period.year < curY) || (period.year === curY && period.month < curM);
  const dayElapsed = isCurrent
    ? (data.dayToDate || curD)
    : (isPast ? _aiDaysInMonth_(period.year, period.month) : 0);

  // Pertanyaan lanjutan sering tidak menyebut nama barang ("kapan mulai minus?").
  // Urutan: cari dari pertanyaan dulu; kalau kosong, pakai topik yang sedang dibahas.
  // Katalog bulan berjalan dipakai sebagai acuan nama barang, dan untuk
  // memberi catatan kalau barangnya cuma ada di bulan ini.
  let curData = null;
  if (!isCurrent) {
    try { curData = _aiSheetData_(); } catch (e) { curData = null; }
  }
  const refItems = curData ? curData.items : null;

  let matched = _aiFindItems_(data, question, refItems);
  if (!matched.length && hintTopic) matched = _aiFindItems_(data, String(hintTopic), refItems);

  let crossMonthNote = "";
  if (!matched.length && !isCurrent) {
    try {
      const curMatch = curData ? _aiFindItems_(curData, question) : [];
      if (curMatch.length) {
        crossMonthNote = "\nCATATAN: barang " + curMatch.map(function (x) { return x.name; }).join(", ") +
          " TIDAK ADA di tab " + periodLabel + ", tetapi ADA di bulan berjalan (" +
          _aiMonthLabel_(curM, curY) + ") dengan stok " +
          curMatch.map(function (x) { return _aiNum_(x.stock) + " " + x.unit; }).join(", ") +
          ". Sebutkan apa adanya: barangnya ada, tapi datanya untuk " + periodLabel + " memang belum tercatat.";
      }
    } catch (e) { /* tanpa catatan */ }
  }

  const mutMonth = isCurrent ? 0 : period.month;
  const mutYear = isCurrent ? 0 : period.year;

  const out = {
    sheetName: data.sheetName,
    dayElapsed: dayElapsed,
    mode: matched.length ? "item" : "ringkasan",
    topic: matched.length ? matched[0].name : "Ringkasan stok",
    matchedItems: matched.length,
    period: periodLabel,
    isCurrent: isCurrent,
    today: curD + " " + _aiMonthLabel_(curM, curY),
    text: ""
  };

  if (matched.length) {
    const blocks = [];
    for (let i = 0; i < matched.length; i++) {
      const it = matched[i];
      const dg = _aiDiagnose_(it, dayElapsed);
      const mut = _aiMutasi_(it.name, AI_MUTASI_ROWS, mutMonth, mutYear);
      blocks.push(
        "PERIODE DATA: " + periodLabel + " (HARI INI: " + curD + " " + _aiMonthLabel_(curM, curY) + ")\n" +
        "BARANG: " + it.name + " | divisi " + it.division + " | satuan " + it.unit +
        " | harga " + _aiRupiah_(it.price) +
        "\n" + dg.text +
        "\nTRANSAKSI TERAKHIR (paling baru di atas) — siapa input & catatan alasannya:\n" + _aiMutasiText_(mut)
      );
    }
    // Nama mirip: sering jadi sumber salah input
    const first = matched[0];
    const base = String(first.name).toLowerCase().split(" ")[0];
    const similar = data.items
      .filter(function (x) { return x.name !== first.name && String(x.name).toLowerCase().indexOf(base) !== -1; })
      .slice(0, 5)
      .map(function (x) { return x.name + " (" + _aiNum_(x.stock) + " " + x.unit + ")"; });
    if (similar.length) blocks.push("NAMA MIRIP di sheet (cek salah baris): " + similar.join(", "));

    out.text = blocks.join("\n\n");
  } else {
    const stats = data.stats || {};
    const negative = data.items.filter(function (x) { return Number(x.stock) < 0; });
    // "berapa total minus" butuh angka yang bisa dijumlah, bukan cuma jumlah barang.
    let negQty = 0, negValue = 0;
    for (let nz = 0; nz < negative.length; nz++) {
      const nq = Math.abs(Number(negative[nz].stock) || 0);
      negQty += nq;
      negValue += nq * (Number(negative[nz].price) || 0);
    }
    const low = data.items.slice().sort(function (a, b) { return Number(a.stock) - Number(b.stock); }).slice(0, 5);
    const high = data.items.slice().sort(function (a, b) { return Number(b.stock) - Number(a.stock); }).slice(0, 5);

    const perDiv = {};
    for (let i = 0; i < data.items.length; i++) {
      const it = data.items[i];
      const d = it.division || "LAINNYA";
      if (!perDiv[d]) perDiv[d] = { count: 0, nilai: 0, minus: 0 };
      perDiv[d].count++;
      perDiv[d].nilai += Number(it.stock) * Number(it.price);
      if (Number(it.stock) < 0) perDiv[d].minus++;
    }

    const lines = [];
    const istilah = isCurrent ? "bulan ini" : "periode " + periodLabel;
    lines.push("PERIODE DATA: " + periodLabel + " (HARI INI: " + curD + " " + _aiMonthLabel_(curM, curY) + ")");
    lines.push("Sheet: " + data.sheetName + " | data sampai tanggal " + dayElapsed + (isCurrent ? "" : " (bulan penuh/selesai)"));
    lines.push("Jumlah barang: " + (stats.totalItems || data.items.length));
    lines.push("Nilai stok (aset): " + _aiRupiah_(stats.totalNilaiStokAset));
    lines.push("Nilai masuk " + istilah + ": " + _aiRupiah_(stats.totalRupiahMasuk) + " | nilai keluar: " + _aiRupiah_(stats.totalRupiahKeluar));
    lines.push("Barang stok MINUS (stok di bawah 0): " + negative.length + " barang" +
      " | total qty minus " + _aiNum_(negQty) +
      " | total nilai minus " + _aiRupiah_(negValue) +
      (negative.length ? " | " + negative.slice(0, 5).map(function (x) { return x.name + " " + _aiNum_(x.stock) + " " + x.unit; }).join(", ") : ""));
    lines.push("5 stok TERENDAH (paling sedikit): " + low.map(function (x) { return x.name + " " + _aiNum_(x.stock) + " " + x.unit; }).join(", "));
    lines.push("5 stok TERBANYAK (paling banyak): " + high.map(function (x) { return x.name + " " + _aiNum_(x.stock) + " " + x.unit; }).join(", "));
    for (const k in perDiv) {
      lines.push("Divisi " + k + ": " + perDiv[k].count + " barang, nilai " + _aiRupiah_(perDiv[k].nilai) + ", minus " + perDiv[k].minus);
    }
    lines.push("TRANSAKSI TERAKHIR YANG DICATAT (paling baru di atas) — siapa input & catatannya:\n" +
      _aiMutasiText_(_aiMutasi_("", 10, mutMonth, mutYear)));

    // Pertanyaan "sebutkan/daftar/apa saja" butuh nama barangnya, bukan cuma
    // ringkasan angka. Daftar nama saja supaya prompt tetap ringan.
    if (_aiWantsCatalog_(question)) {
      const byDiv = {};
      for (let i = 0; i < data.items.length; i++) {
        const it = data.items[i];
        const d = it.division || "LAINNYA";
        if (!byDiv[d]) byDiv[d] = [];
        byDiv[d].push(it.name + " (" + _aiNum_(it.stock) + " " + it.unit + ", " + _aiRupiah_(it.price) + "/" + it.unit + ")");
      }
      const parts = [];
      for (const k in byDiv) {
        parts.push("Divisi " + k + " (" + byDiv[k].length + "): " + byDiv[k].join("; "));
      }
      lines.push("DAFTAR BARANG LENGKAP (nama, stok, harga):\n" + parts.join("\n"));
    }

    out.text = lines.join("\n");
  }

  if (crossMonthNote) out.text = out.text + crossMonthNote;

  return out;
}

// ── Prompt ─────────────────────────────────────────────────────────
function _aiPrompt_(facts, question, history, lastTopic) {
  const sys =
    "Kamu Mirim, asisten stok restoran Rimba Alam. " +
    "Gaya bicara: hangat dan ceria seperti agen staf yang sedang melayani, TANPA sapaan pembuka. " +
    "Pakai bahasa Indonesia santai tapi sopan. Boleh 1-2 emoji yang relevan (jangan berlebihan, jangan tiap kalimat). " +
    "Jawaban maksimal 4 kalimat pendek.\n" +
    "LARANGAN PEMBUKA: jangan pernah memulai jawaban dengan 'Halo', 'Hai', 'Hai kak', 'Halo Mirim di sini', 'Aduh', 'Maaf banget ya', " +
    "atau sapaan/basa-basi apa pun. Kalimat PERTAMA harus sudah berisi jawabannya. Contoh benar: 'Stok terbanyak bulan ini Ayam Kampung, 38 EKOR.'\n" +
    "Jangan menutup dengan menawarkan daftar bantuan alternatif ('kalau mau, aku bisa infoin ...'). Cukup jawab yang ditanya.\n" +
    "ATURAN KETAT:\n" +
    "1. Kamu menjawab SEMUA pertanyaan yang jawabannya ada di FAKTA atau bisa dihitung dari FAKTA. Itu termasuk: stok terkini, riwayat mutasi, nilai aset, " +
    "harga satuan, daftar/katalog barang, jumlah barang, nama divisi/kategori, barang kritis, kenapa minus, siapa yang input, catatan/alasan input, " +
    "barang paling banyak masuk/keluar, peringkat, rata-rata pemakaian, total IN/OUT per rentang tanggal, perbandingan antar tanggal/bulan/periode, dan rekap apa pun dari data stok. " +
    "Jangan menolak pertanyaan data hanya karena kalimatnya tidak sama dengan daftar ini — selama jawabannya bisa diambil dari FAKTA, jawab. " +
    "Hanya tolak yang benar-benar BUKAN soal stok Rimba Alam: pengetahuan umum, koding, opini, resep/masakan, curhat, berita, atau obrolan pribadi. " +
    "Contoh penolakan: 'Aduh, itu di luar jangkauanku ya 🙏 Aku cuma bisa bantu soal stok Rimba Alam.'\n" +
    "2. Kalau FAKTA tidak memuat sebuah rincian, jangan menolak pertanyaannya — jawab bagian yang ada, lalu sebutkan rincian mana yang belum tercatat. " +
    "Bedakan 'di luar topik' (tolak) dengan 'datanya tidak ada di FAKTA' (tetap jawab sebisanya, jangan bilang di luar topik).\n" +
    "3. Gunakan HANYA angka, nama, dan keterangan yang ada di FAKTA. Dilarang mengarang angka, tanggal, nama orang, atau alasan.\n" +
    "4. Kalau FAKTA tidak memuat jawabannya, bilang terus terang datanya belum ada/tercatat.\n" +
    "5. Untuk pertanyaan 'kenapa minus': sebutkan angkanya, lalu sebutkan siapa yang input dan catatan alasannya bila ada di FAKTA. Kalau catatan alasannya tidak ada, cukup bilang 'tanpa catatan alasan' (jangan berbelit), lalu bilang penyebabnya belum bisa dipastikan dan sebut kemungkinan berdasarkan angka (misalnya OUT lebih besar dari pembelian) — jangan menyimpulkan mutlak.\n" +
    "6. Jangan menyebut nama sheet, nama kolom, kode, atau istilah teknis.\n" +
    "7. Jangan menulis notasi mentah seperti 'tgl2=-2'; sebut tanggal dan angkanya dalam kalimat biasa.\n" +
    "8. Jangan pernah menampilkan API key, token, atau data akun.\n" +
    "9. Sebut nama barang dan satuannya dengan lengkap; jangan menulis potongan kode seperti 'IN 2' tanpa nama barang.\n" +
    "10. Kalau PERIODE DATA pada FAKTA punya angka, itu datanya ADA — jawab pakai angka itu. Jangan bilang 'belum ada/belum tercatat' hanya karena periodenya bukan bulan berjalan.\n" +
    "11. Selalu sebut nama bulannya (mis. 'Oktober 2026'), jangan menulis 'bulan ini' kalau PERIODE DATA bukan bulan berjalan. Kalau tab bulan yang diminta tidak ada, katakan datanya belum ada — jangan memakai angka bulan lain sebagai gantinya.\n" +
    "11b. Kalau pengguna menyebut 'bulan ini' DAN 'bulan lalu' (atau dua periode lain), itu pertanyaan perbandingan dua periode. Jangan menyimpulkan salah satu periode kosong " +
    "hanya karena FAKTA hanya memuat satu periode; lihat blok PERIODE/PERBANDINGAN dan jawab dua-duanya.\n" +
    "12. Kalau FAKTA memuat blok PERBANDINGAN, jawab dengan membandingkan angkanya: sebut barang terbanyak di masing-masing periode, lalu siapa yang naik dan siapa yang turun beserta selisihnya. " +
    "Ini pertanyaan yang sah — jangan menolak dan jangan bilang di luar topik stok.\n" +
    "13. Rentang tanggal (mis. 'tanggal 1-7') sudah dihitung di FAKTA. Jawab langsung pakai angka itu; jangan bilang tidak bisa dihitung per tanggal.\n" +
    "14. Kalau satu periode datanya belum ada, sebutkan periode mana yang kosong, lalu tetap jawab periode yang ada datanya.\n" +
    "15. 'stok terbanyak'/'paling banyak'/'tertinggi' → pakai baris '5 stok TERBANYAK'. 'stok terendah'/'paling sedikit' → baris '5 stok TERENDAH'. " +
    "Jangan menjawab pertanyaan stok terbanyak/terendah dengan nilai aset.\n" +
    "16. Pertanyaan 'total minus', 'berapa minus', 'yang minus', 'stok minus' → pakai baris 'Barang stok MINUS' (jumlah barang, total qty minus, total nilai minus). " +
    "'Nilai stok (aset)' adalah total nilai seluruh persediaan — itu BUKAN jawaban untuk pertanyaan minus. Jangan menyebut aset kalau yang ditanya minus.";

  let histBlock = "";
  if (Array.isArray(history) && history.length) {
    const turns = history.slice(-AI_HISTORY_MAX_TURNS * 2);
    const lines = [];
    for (let i = 0; i < turns.length; i++) {
      const t = turns[i] || {};
      const role = t.role === "model" || t.role === "assistant" ? "Mirim" : "Admin";
      const txt = String(t.text || t.content || "").slice(0, 400);
      if (txt) lines.push(role + ": " + txt);
    }
    if (lines.length) histBlock = "\n\nRIWAYAT (hanya untuk konteks, jangan diulang):\n" + lines.join("\n");
  }

  const topicBlock = (lastTopic ? "\nTopik yang sedang dibahas: " + String(lastTopic).slice(0, 80) : "") +
    (facts.today ? "\nHARI INI: " + facts.today : "") +
    (facts.period ? "\nPERIODE DATA pada FAKTA: " + facts.period : "") +
    (facts.period ? "\n(\"bulan ini/periode ini\" = PERIODE DATA di atas, bukan otomatis bulan berjalan.)" : "");

  const periodNote = facts.period
    ? (facts.isCurrent === false
      ? "\n\nCATATAN PERIODE: pengguna menanyakan " + facts.period + " (bisa lewat kalimat 'bulan lalu' / nama bulan). " +
        "FAKTA di atas SUDAH data " + facts.period + " dan angkanya ada — jawab pakai itu, sebut '" + facts.period + "', " +
        "jangan bilang datanya belum ada. 'Bulan lalu' dihitung dari HARI INI, bukan dari periode data."
      : "\n\nCATATAN PERIODE: data di atas adalah bulan berjalan (" + facts.period + ").")
    : "";

  const noteBlock = (facts && facts.note) ? "\n\n" + facts.note : "";

  return sys + topicBlock + histBlock + "\n\nFAKTA:\n" + facts.text + periodNote + noteBlock + "\n\nPERTANYAAN: " + question;
}

// ── Panggilan ke provider ──────────────────────────────────────────
function _aiCall_(prompt) {
  const provider = String(_aiProp_("AI_PROVIDER", "gemini")).toLowerCase();
  const key = _aiProp_("AI_KEY", "");
  if (!key) throw new Error("AI_KEY belum diisi di Script Properties");

  if (provider === "gemini") {
    const model = _aiProp_("AI_MODEL", "gemini-3.5-flash-lite");
    const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent";
    const res = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      headers: { "x-goog-api-key": key },
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.45, maxOutputTokens: 300 }
      }),
      muteHttpExceptions: true
    });
    const code = res.getResponseCode();
    const body = res.getContentText();
    if (code !== 200) throw new Error("Gemini HTTP " + code + ": " + body.slice(0, 200));
    const j = JSON.parse(body);
    const cand = (j.candidates && j.candidates[0]) || null;
    const parts = cand && cand.content && cand.content.parts;
    const text = parts && parts.length ? parts.map(function (p) { return p.text || ""; }).join("") : "";
    if (!text) throw new Error("Gemini mengembalikan jawaban kosong");
    return text.trim();
  }

  // Provider OpenAI-compatible (OpenAI, vikey, 9router, dll)
  const base = String(_aiProp_("AI_BASE_URL", "https://api.openai.com/v1")).replace(/\/+$/, "");
  const model = _aiProp_("AI_MODEL", "gpt-4o-mini");
  const res = UrlFetchApp.fetch(base + "/chat/completions", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + key },
    payload: JSON.stringify({
      model: model,
      temperature: 0.45,
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }]
    }),
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  const body = res.getContentText();
  if (code !== 200) throw new Error("AI HTTP " + code + ": " + body.slice(0, 200));
  const j = JSON.parse(body);
  const msg = j.choices && j.choices[0] && j.choices[0].message;
  const text = msg && msg.content ? String(msg.content) : "";
  if (!text) throw new Error("Provider mengembalikan jawaban kosong");
  return text.trim();
}

// ── Diagnostik & setelan (hanya bisa dijalankan pemilik script) ────
// Dipakai untuk memastikan Mirim benar-benar aktif, tanpa membuka data ke publik.
function _aiSelfTest_() {
  const provider = String(_aiProp_("AI_PROVIDER", "gemini")).toLowerCase();
  const key = _aiProp_("AI_KEY", "");
  const model = _aiProp_("AI_MODEL", provider === "gemini" ? "gemini-3.5-flash-lite" : "gpt-4o-mini");
  const out = {
    version: "mirim-1",
    provider: provider,
    keySet: !!key,
    keyTail: key ? key.slice(-6) : "",
    model: model,
    callOk: false,
    callError: "",
    reply: "",
    sheetOk: false,
    sheetError: "",
    items: 0,
    mutasiRows: 0
  };
  try {
    out.reply = String(_aiCall_("Balas satu kata: OK")).slice(0, 60);
    out.callOk = true;
    try {
      PropertiesService.getScriptProperties().setProperty(
        "AI_LAST_OK_AT",
        Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss")
      );
    } catch (e) {}
  } catch (err) {
    out.callError = String(err && err.message ? err.message : err).slice(0, 300);
    _aiRememberError_(out.callError);
  }
  try {
    const d = _aiSheetData_();
    out.sheetOk = true;
    out.items = (d.items || []).length;
    out.sheet = d.sheetName || "";
  } catch (err) {
    out.sheetError = String(err && err.message ? err.message : err).slice(0, 300);
  }
  try { out.mutasiRows = _aiMutasi_("", 3).length; } catch (err) {}
  return out;
}

// setAIKey({key, provider, model}) → pasang setelan dari editor/API, lalu tes.
function setAIKey(cfg) {
  const c = cfg || {};
  const p = PropertiesService.getScriptProperties();
  if (c.key) {
    p.setProperty("AI_PROVIDER", String(c.provider || "gemini").toLowerCase());
    p.setProperty("AI_KEY", String(c.key));
    if (c.model) p.setProperty("AI_MODEL", String(c.model));
  }
  if (c.model && !c.key) p.setProperty("AI_MODEL", String(c.model));
  return _aiSelfTest_();
}

function aiSelfTest() {
  return _aiSelfTest_();
}
