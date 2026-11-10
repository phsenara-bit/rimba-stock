import io, sys, base64

icon_b64 = base64.b64encode(io.open("assets/mirim-icon.png", "rb").read()).decode()
icon_uri = "data:image/png;base64," + icon_b64

FILES = ["ask-ai-block.html", "index.html"]

REPL = [
# ── ikon default = gambar kiriman user (data URI, ikut ke-cache service worker)
('''  var DEFAULT_ICON = "💬";''',
 '''  var DEFAULT_ICON = "%s";''' % icon_uri),

# ── subjudul
('''<div id="askAiSub">Asisten stok Rimba Alam · khusus admin</div>''',
 '''<div id="askAiSub">AI Assistant Rimba Alam</div>'''),

# ── sapaan lebih pendek
('''      t.textContent = "Hallo! Mirim di sini 👋✨ Ada yang mau ditanya soal stok? Aku bisa cek stok, kenapa minus, sampai siapa yang input.";''',
 '''      t.textContent = "Hallo! Mirim di sini 👋✨ Ada yang bisa dibantu?";'''),

# ── placeholder
('''placeholder="Halo, mau tanya apa? Misal: kenapa ayam minus?"''',
 '''placeholder="Mau tanya apa hari ini?"'''),

# ── teks bawah: ringkas, tidak menyebut satu bulan saja
('''<div class="askai-note">Mirim cuma bahas stok. Angka & penginput diambil dari catatan bulan ini.</div>''',
 '''<div class="askai-note">Khusus data stok Rimba Alam · bisa cek bulan mana pun</div>'''),

# ── quick chips dihapus dari markup
('''    + '    <div id="askAiChips">'
    + '      <button class="askai-chip" data-q="Barang apa yang stoknya kritis?">Stok kritis</button>'
    + '      <button class="askai-chip" data-q="Nilai stok bulan ini berapa?">Nilai aset</button>'
    + '      <button class="askai-chip" data-q="Barang apa saja yang stoknya minus?">Yang minus</button>'
    + '      <button class="askai-chip" data-q="Siapa yang terakhir input dan apa catatannya?">Siapa yang input</button>'
    + '      <button class="askai-chip" data-q="Ringkas kondisi stok bulan lalu">Bulan lalu</button>'
    + '    </div>'
''', ''''''),

# ── ikon tombol: pakai gambar, bukan emoji
('''    btn.innerHTML = '<span id="askAiBtnIcon" style="display:inline-flex;align-items:center;justify-content:center;font-size:18px;line-height:1;">' + DEFAULT_ICON + '</span>';''',
 '''    var _ic = getIcon();
    btn.innerHTML = '<span id="askAiBtnIcon" style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:url(\\'' + _ic.replace(/'/g, "%27") + '\\') center/cover no-repeat;"></span>';'''),
]

for f in FILES:
    s = io.open(f, encoding="utf-8").read()
    for old, new in REPL:
        n = s.count(old)
        if n != 1:
            sys.exit("FAIL %s: %d untuk %r" % (f, n, old[:70]))
        s = s.replace(old, new)
    io.open(f, "w", encoding="utf-8").write(s)
    print("patched", f)