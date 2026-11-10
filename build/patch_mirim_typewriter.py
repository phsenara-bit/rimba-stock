import io, sys

FILES = ["ask-ai-block.html", "index.html"]

REPL = [
# ── CSS: kursor ketik + baris status tunggu
("""    ".askai-dots span:nth-child(3){animation-delay:.3s;}",""",
 """    ".askai-dots span:nth-child(3){animation-delay:.3s;}",
    ".askai-wait{display:flex;align-items:center;gap:8px;color:var(--on-surface-variant,#64748b);font-size:.8rem;}",
    ".askai-wait .askai-dots{font-size:0;}",
    ".askai-msg.model.askai-typing::after{content:'▍';margin-left:2px;opacity:.55;animation:askaiCaret .9s steps(1) infinite;}",
    "@keyframes askaiCaret{0%,49%{opacity:.55;}50%,100%{opacity:0;}}","""),

# ── state: tambah penanda animasi
("""  var state = { log: [], topic: "", busy: false, gen: 0 };""",
 """  var state = { log: [], topic: "", busy: false, gen: 0, animIdx: -1, animTimer: null, waitTimer: null };
  var TYPE_TOTAL_MS = 1400;      // durasi ketik total (jawaban panjang tetap cepat)
  var TYPE_MIN_MS = 450;"""),

# ── bubble: indikator tunggu dengan teks berganti
("""  function bubble(role, text) {
    ensureUI();
    var thread = document.getElementById("askAiThread");
    var d = document.createElement("div");
    d.className = "askai-msg " + role;
    if (role === "typing") {
      d.className = "askai-msg model";
      d.innerHTML = '<span class="askai-dots"><span></span><span></span><span></span></span>';
      d.id = "askAiTyping";
    } else {
      d.textContent = text;
    }
    thread.appendChild(d);
    thread.scrollTop = thread.scrollHeight;
    return d;
  }""",
 """  var WAIT_STEPS = [
    "Mirim cek data stok dulu ya \\ud83d\\udd0d",
    "Lagi baca catatan inputnya \\ud83d\\udcdd",
    "Sebentar, nyusun jawabannya \\u2728"
  ];

  function bubble(role, text) {
    ensureUI();
    var thread = document.getElementById("askAiThread");
    var d = document.createElement("div");
    d.className = "askai-msg " + role;
    if (role === "typing") {
      d.className = "askai-msg model";
      d.id = "askAiTyping";
      d.innerHTML = '<span class="askai-wait">' +
        '<span class="askai-dots"><span></span><span></span><span></span></span>' +
        '<span id="askAiWaitText">' + WAIT_STEPS[0] + '</span></span>';
      startWaitNudge();
    } else {
      d.textContent = text;
    }
    thread.appendChild(d);
    thread.scrollTop = thread.scrollHeight;
    return d;
  }

  // Teks status berganti tiap ~1 detik: bikin terasa responsif, bukan diam.
  function startWaitNudge() {
    stopWaitNudge();
    var i = 1;
    state.waitTimer = setInterval(function () {
      var el = document.getElementById("askAiWaitText");
      if (!el) { stopWaitNudge(); return; }
      el.textContent = WAIT_STEPS[i % WAIT_STEPS.length];
      i++;
    }, 1100);
  }

  function stopWaitNudge() {
    if (state.waitTimer) { clearInterval(state.waitTimer); state.waitTimer = null; }
  }

  // Efek ketik: teks muncul bertahap. Tap/klik bubble = langsung tampil semua.
  function stopAnim() {
    if (state.animTimer) { clearTimeout(state.animTimer); state.animTimer = null; }
  }

  function typeMessage(el, full) {
    stopAnim();
    var n = full.length;
    if (!n) { el.textContent = ""; return; }
    var duration = Math.max(TYPE_MIN_MS, Math.min(TYPE_TOTAL_MS, n * 14));
    var perTick = Math.max(1, Math.ceil(n / (duration / 30)));   // ~30ms/tick
    var i = 0;
    el.textContent = "";
    el.classList.add("askai-typing");
    el.setAttribute("data-full", full);
    el.__full = full;

    function tick() {
      var live = document.getElementById("askAiThread");
      if (!live || !live.contains(el)) { stopAnim(); return; }
      i += perTick;
      if (i >= n) {
        el.textContent = full;
        el.classList.remove("askai-typing");
        el.removeAttribute("data-full");
        el.__full = "";
        stopAnim();
        var th = document.getElementById("askAiThread");
        if (th) th.scrollTop = th.scrollHeight;
        return;
      }
      el.textContent = full.slice(0, i);
      var th2 = document.getElementById("askAiThread");
      if (th2) th2.scrollTop = th2.scrollHeight;
      state.animTimer = setTimeout(tick, 30);
    }
    state.animTimer = setTimeout(tick, 120);
  }

  function finishAnimNow() {
    var el = document.querySelector(".askai-msg.model.askai-typing");
    if (!el) return false;
    stopAnim();
    if (el.__full) el.textContent = el.__full;
    el.__full = "";
    el.classList.remove("askai-typing");
    return true;
  }"""),

# ── clearTyping: matikan juga teks status
("""  function clearTyping() {
    var t = document.getElementById("askAiTyping");
    if (t && t.parentNode) t.parentNode.removeChild(t);
  }""",
 """  function clearTyping() {
    stopWaitNudge();
    var t = document.getElementById("askAiTyping");
    if (t && t.parentNode) t.parentNode.removeChild(t);
  }"""),

# ── renderThread: pesan model terakhir diketik bertahap
("""    state.log.forEach(function (m) {
      var d = document.createElement("div");
      d.className = "askai-msg " + (m.role === "user" ? "user" : m.role === "sys" ? "sys" : "model");
      d.textContent = m.text;
      thread.appendChild(d);
    });
    thread.scrollTop = thread.scrollHeight;
  }""",
 """    var lastModel = -1;
    for (var k = state.log.length - 1; k >= 0; k--) {
      if (state.log[k].role === "model") { lastModel = k; break; }
    }
    state.log.forEach(function (m, idx) {
      var d = document.createElement("div");
      d.className = "askai-msg " + (m.role === "user" ? "user" : m.role === "sys" ? "sys" : "model");
      if (idx === state.animIdx && m.role === "model") {
        d.textContent = "";
        thread.appendChild(d);
        typeMessage(d, String(m.text || ""));
      } else {
        d.textContent = m.text;
        thread.appendChild(d);
      }
    });
    state.animIdx = -1;
    thread.scrollTop = thread.scrollHeight;
  }"""),

# ── saat jawaban masuk: tandai untuk animasi
("""        if (data && data.success && data.answer) {
          if (data.topic) state.topic = data.topic;
          state.log.push({ role: "model", text: data.answer, topic: data.topic || "" });""",
 """        if (data && data.success && data.answer) {
          if (data.topic) state.topic = data.topic;
          state.animIdx = state.log.length;      // pesan ini diketik bertahap
          state.log.push({ role: "model", text: data.answer, topic: data.topic || "" });"""),

# ── reset: bersihkan animasi & status
("""  function reset() {
    state.gen++;                 // jawaban lama yang masih di jalan jadi tidak dipakai
    state.log = [];
    state.topic = "";
    state.busy = false;""",
 """  function reset() {
    state.gen++;                 // jawaban lama yang masih di jalan jadi tidak dipakai
    stopAnim();
    stopWaitNudge();
    state.animIdx = -1;
    state.log = [];
    state.topic = "";
    state.busy = false;"""),

# ── tap bubble = tampilkan penuh
("""    document.getElementById("askAiClose").addEventListener("click", close);""",
 """    document.getElementById("askAiThread").addEventListener("click", function () {
      finishAnimNow();
    });
    document.getElementById("askAiClose").addEventListener("click", close);"""),
]

for f in FILES:
    s = io.open(f, encoding="utf-8").read()
    for old, new in REPL:
        n = s.count(old)
        if n != 1:
            sys.exit("FAIL %s: %d kemunculan untuk %r" % (f, n, old[:80]))
        s = s.replace(old, new)
    io.open(f, "w", encoding="utf-8").write(s)
    print("patched", f)