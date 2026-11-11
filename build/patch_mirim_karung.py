import io, sys

p = "Code.gs"
s = io.open(p, encoding="utf-8").read()


def rep(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        sys.exit("FAIL (%d): %r" % (n, old[:110]))
    s = s.replace(old, new)


# ══ 1. Kecocokan hanya diukur dari kata yang benar-benar ada di nama barang ══
rep('''function _aiFindItems_(data, question) {
  const toks = _aiTokens_(question);
  if (!toks.length) return [];

  const normQ = toks.join(" ");''',
'''function _aiFindItems_(data, question) {
  const toks = _aiTokens_(question);
  if (!toks.length) return [];

  // Hanya kata yang benar-benar muncul di nama barang yang dipakai menakar
  // kecocokan. Tanpa ini, kata satuan/keterangan seperti "karung" (nama di
  // sheet: "Beras 1 Krng =50kg") atau "sisanya" membuat barang yang jelas
  // disebut jadi tidak ditemukan sama sekali.
  const nameToks = [];
  for (let t = 0; t < toks.length; t++) {
    for (let i = 0; i < data.items.length; i++) {
      if (String(data.items[i].name || "").toLowerCase().indexOf(toks[t]) !== -1) {
        nameToks.push(toks[t]);
        break;
      }
    }
  }
  const used = nameToks.length ? nameToks : toks;

  const normQ = used.join(" ");''')

rep('''    let hit = 0;
    for (let t = 0; t < toks.length; t++) {
      if (name.indexOf(toks[t]) !== -1) hit++;
    }''',
'''    let hit = 0;
    for (let t = 0; t < used.length; t++) {
      if (name.indexOf(used[t]) !== -1) hit++;
    }''')

rep('''  const minHit = toks.length >= 2 ? 2 : 1;''',
    '''  const minHit = used.length >= 2 ? 2 : 1;''')

# ══ 2. Mode perbandingan: sebutkan angka barang yang ditanya ═════════════
rep('''    built.push({ label: lp.label, rangeLabel: rl, rows: rs.rows, totalOut: rs.totalOut, totalIn: rs.totalIn, missing: false, to: to });''',
    '''    built.push({ label: lp.label, rangeLabel: rl, rows: rs.rows, totalOut: rs.totalOut, totalIn: rs.totalIn, missing: false, to: to, data: lp.data });''')

rep('''  // ── Blok perbandingan (kalau lebih dari satu periode) ──''',
'''  // Kalau pengguna menyebut barang tertentu, tampilkan angka barang ITU di
  // setiap periode. Daftar "5 terbesar" belum tentu memuat barangnya, dan
  // tanpa blok ini model menjawab "tidak ada data" untuk barang yang ada.
  const firstData = built.filter(function (b) { return b.data; })[0];
  if (firstData) {
    const asked = _aiFindItems_(firstData.data, question);
    if (asked.length) {
      const detail = ["BARANG YANG DITANYA (angka per periode):"];
      for (let i = 0; i < Math.min(asked.length, 2); i++) {
        const it = asked[i];
        const per = [];
        for (let k = 0; k < built.length; k++) {
          const b = built[k];
          if (!b.data) { per.push(b.label + ": belum ada tab untuk bulan ini"); continue; }
          const rr = _aiRangeRows_(b.data, rg.from, b.to || rg.to);
          let rrow = null;
          for (let x = 0; x < rr.rows.length; x++) if (rr.rows[x].name === it.name) { rrow = rr.rows[x]; break; }
          let endStock = null;
          for (let y = 0; y < b.data.items.length; y++) {
            if (b.data.items[y].name === it.name) { endStock = b.data.items[y].stock; break; }
          }
          per.push(b.label + ": OUT " + _aiNum_(rrow ? rrow.out : 0) + " " + it.unit +
            " | IN " + _aiNum_(rrow ? rrow.inQty : 0) + " " + it.unit +
            (endStock === null ? "" : " | stok akhir " + _aiNum_(endStock) + " " + it.unit));
        }
        detail.push(it.name + " → " + per.join(" ; "));
      }
      blocks.push(detail.join("\\n"));
    }
  }

  // ── Blok perbandingan (kalau lebih dari satu periode) ──''')

io.open(p, "w", encoding="utf-8").write(s)
print("pencocokan barang + detail perbandingan diperbaiki")
