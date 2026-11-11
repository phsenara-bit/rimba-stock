import io, sys

p = "Code.gs"
s = io.open(p, encoding="utf-8").read()


def rep(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        sys.exit("FAIL (%d): %r" % (n, old[:100]))
    s = s.replace(old, new)


# ── 1. Riwayat & topik dari URL ikut dibaca (sebelumnya selalu hilang) ──
rep('''  const params = (e && e.parameter) || {};
  const src = payload || {};
  const question = String(src.q || params.q || "").trim().slice(0, AI_MAX_QUESTION);''',
'''  const params = (e && e.parameter) || {};
  const src = payload || {};

  // Jalur GET (doGet -> handleAskAI_(e, user, null)) mengirim riwayat & topik
  // sebagai parameter URL, bukan payload. Tanpa parsing ini prompt selalu
  // kosong riwayat: pertanyaan lanjutan ("siapa yang input?") kehilangan
  // konteks dan model menjawab dari ringkasan umum.
  if (!Array.isArray(src.history) && params.history) {
    try {
      const parsed = JSON.parse(String(params.history));
      if (Array.isArray(parsed)) src.history = parsed;
    } catch (err) { src.history = []; }
  }
  if (!src.topic && params.topic) src.topic = String(params.topic);

  const question = String(src.q || params.q || "").trim().slice(0, AI_MAX_QUESTION);''')

# ── 2. Cache harus memisahkan konteks percakapan ──
rep('''    cacheKey = "ai_" + AI_VER + "_" + _aiHash_(username + "|" + question.toLowerCase() + "|" + today);''',
'''    // Topik & riwayat ikut jadi kunci: pertanyaan yang sama di percakapan
    // berbeda tidak boleh memakai jawaban lama yang konteksnya lain.
    cacheKey = "ai_" + AI_VER + "_" + _aiHash_(
      username + "|" + question.toLowerCase() + "|" + today +
      "|" + String(src.topic || "") +
      "|" + JSON.stringify(src.history || [])
    );''')

# ── 3. Jendela riwayat lebih panjang, bisa diatur lewat Script Property ──
rep('const AI_HISTORY_MAX_TURNS = 2;   // giliran riwayat yang ikut dikirim',
    'const AI_HISTORY_MAX_TURNS = 4;   // giliran riwayat yang ikut dikirim (override: AI_HISTORY_TURNS)')

rep('''    const turns = history.slice(-AI_HISTORY_MAX_TURNS * 2);''',
'''    const maxTurns = parseInt(_aiProp_("AI_HISTORY_TURNS", ""), 10) || AI_HISTORY_MAX_TURNS;
    const turns = history.slice(-maxTurns * 2);''')

# ── 4. Fakta: transaksi khusus barang minus ──
rep('''    lines.push("TRANSAKSI TERAKHIR YANG DICATAT (paling baru di atas) — siapa input & catatannya:\\n" +
      _aiMutasiText_(_aiMutasi_("", 10, mutMonth, mutYear)));''',
'''    lines.push("TRANSAKSI TERAKHIR SELURUH BARANG (paling baru di atas) — ini BUKAN khusus barang minus, " +
      "jangan dipakai menjawab siapa penyebab minus:\\n" +
      _aiMutasiText_(_aiMutasi_("", 10, mutMonth, mutYear)));

    // Pertanyaan lanjutan "siapa yang input / siapa penyebabnya" harus dijawab
    // dari transaksi barang yang minus, bukan dari transaksi terakhir barang lain.
    if (negative.length) {
      const negLines = [];
      for (let ni = 0; ni < Math.min(negative.length, 3); ni++) {
        const nit = negative[ni];
        negLines.push(nit.name + " (stok " + _aiNum_(nit.stock) + " " + nit.unit + "):\\n" +
          _aiMutasiText_(_aiMutasi_(nit.name, 5, mutMonth, mutYear)));
      }
      lines.push("TRANSAKSI BARANG MINUS — siapa yang input & catatan alasannya (pakai ini untuk pertanyaan 'siapa yang input/sebab minus'):\\n" +
        negLines.join("\\n"));
    }''')

# ── 5. Topik ringkasan lebih spesifik saat soal minus ──
rep('''    topic: matched.length ? matched[0].name : "Ringkasan stok",''',
'''    topic: matched.length
      ? matched[0].name
      : ((/minus|negatif/i.test(question) || /minus/i.test(String(hintTopic || ""))) ? "Barang stok MINUS" : "Ringkasan stok"),''')

# ── 6. Aturan atribusi di prompt ──
rep('''    "16. Pertanyaan 'total minus', 'berapa minus', 'yang minus', 'stok minus' → pakai baris 'Barang stok MINUS' (jumlah barang, total qty minus, total nilai minus). " +
    "'Nilai stok (aset)' adalah total nilai seluruh persediaan — itu BUKAN jawaban untuk pertanyaan minus. Jangan menyebut aset kalau yang ditanya minus.";''',
'''    "16. Pertanyaan 'total minus', 'berapa minus', 'yang minus', 'stok minus' → pakai baris 'Barang stok MINUS' (jumlah barang, total qty minus, total nilai minus). " +
    "'Nilai stok (aset)' adalah total nilai seluruh persediaan — itu BUKAN jawaban untuk pertanyaan minus. Jangan menyebut aset kalau yang ditanya minus.\\n" +
    "17. Pertanyaan 'siapa yang input'/'siapa penyebabnya' yang menyambung pembahasan minus atau barang tertentu → jawab HANYA dari blok 'TRANSAKSI BARANG MINUS' " +
    "atau transaksi barang yang sedang dibahas. JANGAN menyebut nama staf dari 'TRANSAKSI TERAKHIR SELURUH BARANG' — itu transaksi barang lain. " +
    "Kalau barang minus itu tidak punya catatan penginput/alasan, katakan catatannya belum ada untuk barang tersebut. Jangan menyimpulkan penyebabnya dari barang lain.";''')

# ── 7. Versi cache ──
rep('const AI_VER = "mirim-12";', 'const AI_VER = "mirim-13";')

io.open(p, "w", encoding="utf-8").write(s)
print("riwayat tersambung + atribusi minus")
