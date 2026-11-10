import io, sys

FILES = ["ask-ai-block.html", "index.html"]

REPL = [
# judul & subjudul
("""'        <div id="askAiTitle">Tanya Stok</div>'""",
 """'        <div id="askAiTitle">Tanya Mirim</div>'"""),
("""'        <div id="askAiSub">Jawaban dari data sheet bulan ini</div>'""",
 """'        <div id="askAiSub">Asisten stok Rimba Alam · khusus admin</div>'"""),
# placeholder
("""placeholder="Tanya stok, misal: kenapa ayam minus?\"""",
 """placeholder="Halo, mau tanya apa? Misal: kenapa ayam minus?\""""),
# catatan bawah
("""'    <div class="askai-note">Angka diambil dari sheet. Kalau ada kejanggalan, cek manual.</div>'""",
 """'    <div class="askai-note">Mirim cuma bahas stok. Angka & penginput diambil dari catatan bulan ini.</div>'"""),
# chip tambahan
("""    + '      <button class="askai-chip" data-q="Barang apa saja yang stoknya minus?">Yang minus</button>'""",
 """    + '      <button class="askai-chip" data-q="Barang apa saja yang stoknya minus?">Yang minus</button>'
    + '      <button class="askai-chip" data-q="Siapa yang terakhir input dan apa catatannya?">Siapa yang input</button>'"""),
# sapaan
("""      t.textContent = "Halo! Tanya apa saja soal stok bulan ini — kenapa minus, kapan mulai minus, nilai aset, atau barang yang perlu dibeli.";""",
 """      t.textContent = "Hallo! Mirim di sini 👋✨ Ada yang mau ditanya soal stok? Aku bisa cek stok, kenapa minus, sampai siapa yang input.";"""),
# judul tombol
("""    btn.title = "Tanya Stok";""",
 """    btn.title = "Tanya Mirim";"""),
# pesan error
("""    if (code === "EMPTY") return "Pertanyaannya kosong.";
    return "Asisten belum aktif di server. Pastikan Code.gs versi baru sudah di-deploy.";""",
 """    if (code === "EMPTY") return "Pertanyaannya kosong.";
    if (code === "FORBIDDEN") return "Mirim khusus admin. Akun kamu belum punya akses.";
    if (code === "NOT_CONFIGURED") return "Mirim belum aktif: kunci AI belum dipasang di server.";
    if (code === "FAILED") return "Mirim lagi nggak bisa jawab. Coba lagi sebentar ya 🙏";
    return "Mirim belum bisa dihubungi. Coba lagi sebentar ya.";"""),
# gerbang akses admin
("""  function open() {
    if (!(window.AuthService && window.AuthService.getCurrentUser && window.AuthService.getCurrentUser())) {
      if (window.App && window.App.showToast) window.App.showToast("Login dulu untuk memakai asisten.", "error");
      return;
    }""",
 """  // Mirim khusus admin. Server juga menolak akun non-admin, ini hanya lapisan UI.
  function canUseMirim() {
    try {
      if (window.AuthService && typeof window.AuthService.isAdmin === "function") {
        return !!window.AuthService.isAdmin();
      }
      var u = (window.AuthService && window.AuthService.getCurrentUser) ? window.AuthService.getCurrentUser() : null;
      return !!(u && (u.role === "admin" || u.role === "superadmin" || u.role === "owner"));
    } catch (e) { return false; }
  }

  function open() {
    if (!canUseMirim()) {
      var me = (window.AuthService && window.AuthService.getCurrentUser) ? window.AuthService.getCurrentUser() : null;
      if (window.App && window.App.showToast) {
        window.App.showToast(me ? "Mirim khusus admin. Akun kamu belum punya akses." : "Login dulu untuk memakai Mirim.", "error");
      }
      return;
    }"""),
# tombol hanya untuk admin
("""  function injectButton() {
    if (document.getElementById("btnAskAi")) return true;""",
 """  function injectButton() {
    if (!canUseMirim()) return false;
    if (document.getElementById("btnAskAi")) return true;"""),
# tutup = bersihkan sisa teks di kotak input
("""  function close() {
    var dlg = document.getElementById("askAiDialog");
    if (dlg) dlg.classList.remove("show");
    reset();                      // tutup = percakapan dihapus
  }""",
 """  function close() {
    var dlg = document.getElementById("askAiDialog");
    if (dlg) dlg.classList.remove("show");
    var ta = document.getElementById("askAiInput");
    if (ta) { ta.value = ""; ta.style.height = "auto"; }   // sisa teks yang belum terkirim ikut dibuang
    reset();                      // tutup = percakapan dihapus
  }"""),
# boot: tombol ikut status admin (login/logout/ganti akun)
("""  function boot() {
    injectButton();
    ensureUI();
    renderIcon();""",
 """  function syncButton() {
    var btn = document.getElementById("btnAskAi");
    if (!canUseMirim()) {
      if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
      return;
    }
    if (!btn) injectButton();
  }

  function boot() {
    ensureUI();
    syncButton();
    renderIcon();
    setInterval(syncButton, 1500);   // ikut berubah saat login/logout atau ganti akun"""),
]

for f in FILES:
    s = io.open(f, encoding="utf-8").read()
    for old, new in REPL:
        n = s.count(old)
        if n != 1:
            sys.exit("FAIL %s: %d kemunculan untuk: %r" % (f, n, old[:70]))
        s = s.replace(old, new)
    io.open(f, "w", encoding="utf-8").write(s)
    print("patched", f)