import io, sys

p = "Code.gs"
s = io.open(p, encoding="utf-8").read()


def rep(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        sys.exit("FAIL (%d): %r" % (n, old[:100]))
    s = s.replace(old, new)


# ── 1. Fakta: angka minus yang bisa dijumlah, plus daftar stok terbanyak ──
rep('''    const stats = data.stats || {};
    const negative = data.items.filter(function (x) { return Number(x.stock) < 0; });
    const low = data.items.slice().sort(function (a, b) { return Number(a.stock) - Number(b.stock); }).slice(0, 5);''',
'''    const stats = data.stats || {};
    const negative = data.items.filter(function (x) { return Number(x.stock) < 0; });
    // "berapa total minus" butuh angka yang bisa dijumlah, bukan cuma jumlah barang.
    let negQty = 0, negValue = 0;
    for (let nz = 0; nz < negative.length; nz++) {
      const nq = Math.abs(Number(negative[nz].stock) || 0);
      negQty += nq;
      negValue += nq * (Number(negative[nz].price) || 0);
    }
    const low = data.items.slice().sort(function (a, b) { return Number(a.stock) - Number(b.stock); }).slice(0, 5);
    const high = data.items.slice().sort(function (a, b) { return Number(b.stock) - Number(a.stock); }).slice(0, 5);''')

rep('''    lines.push("Barang stok MINUS: " + negative.length +
      (negative.length ? " (" + negative.slice(0, 5).map(function (x) { return x.name + " " + _aiNum_(x.stock); }).join(", ") + ")" : ""));
    lines.push("5 stok terendah: " + low.map(function (x) { return x.name + " " + _aiNum_(x.stock) + " " + x.unit; }).join(", "));''',
'''    lines.push("Barang stok MINUS (stok di bawah 0): " + negative.length + " barang" +
      " | total qty minus " + _aiNum_(negQty) +
      " | total nilai minus " + _aiRupiah_(negValue) +
      (negative.length ? " | " + negative.slice(0, 5).map(function (x) { return x.name + " " + _aiNum_(x.stock) + " " + x.unit; }).join(", ") : ""));
    lines.push("5 stok TERENDAH (paling sedikit): " + low.map(function (x) { return x.name + " " + _aiNum_(x.stock) + " " + x.unit; }).join(", "));
    lines.push("5 stok TERBANYAK (paling banyak): " + high.map(function (x) { return x.name + " " + _aiNum_(x.stock) + " " + x.unit; }).join(", "));''')

# ── 2. Prompt: tanpa sapaan pembuka, dan jangan tertukar aset/minus ──
rep('''    "Gaya bicara: ramah, hangat, ceria, hidup seperti rekan kerja yang helpful. " +
    "Pakai bahasa Indonesia santai tapi sopan. Boleh 1-2 emoji yang relevan (jangan berlebihan, jangan tiap kalimat). " +
    "Jawaban maksimal 4 kalimat pendek, langsung ke inti, tanpa pembukaan panjang.\\n" +''',
'''    "Gaya bicara: hangat dan ceria seperti agen staf yang sedang melayani, TANPA sapaan pembuka. " +
    "Pakai bahasa Indonesia santai tapi sopan. Boleh 1-2 emoji yang relevan (jangan berlebihan, jangan tiap kalimat). " +
    "Jawaban maksimal 4 kalimat pendek.\\n" +
    "LARANGAN PEMBUKA: jangan pernah memulai jawaban dengan 'Halo', 'Hai', 'Hai kak', 'Halo Mirim di sini', 'Aduh', 'Maaf banget ya', " +
    "atau sapaan/basa-basi apa pun. Kalimat PERTAMA harus sudah berisi jawabannya. Contoh benar: 'Stok terbanyak bulan ini Ayam Kampung, 38 EKOR.'\\n" +
    "Jangan menutup dengan menawarkan daftar bantuan alternatif ('kalau mau, aku bisa infoin ...'). Cukup jawab yang ditanya.\\n" +''')

rep('''    "14. Kalau satu periode datanya belum ada, sebutkan periode mana yang kosong, lalu tetap jawab periode yang ada datanya.";''',
'''    "14. Kalau satu periode datanya belum ada, sebutkan periode mana yang kosong, lalu tetap jawab periode yang ada datanya.\\n" +
    "15. 'stok terbanyak'/'paling banyak'/'tertinggi' → pakai baris '5 stok TERBANYAK'. 'stok terendah'/'paling sedikit' → baris '5 stok TERENDAH'. " +
    "Jangan menjawab pertanyaan stok terbanyak/terendah dengan nilai aset.\\n" +
    "16. Pertanyaan 'total minus', 'berapa minus', 'yang minus', 'stok minus' → pakai baris 'Barang stok MINUS' (jumlah barang, total qty minus, total nilai minus). " +
    "'Nilai stok (aset)' adalah total nilai seluruh persediaan — itu BUKAN jawaban untuk pertanyaan minus. Jangan menyebut aset kalau yang ditanya minus.";''')

# ── 3. Versi cache: prompt & fakta berubah → jawaban lama harus gugur ──
rep('const AI_VER = "mirim-11";', 'const AI_VER = "mirim-12";')

io.open(p, "w", encoding="utf-8").write(s)
print("fakta terbanyak/minus + prompt tanpa sapaan")
