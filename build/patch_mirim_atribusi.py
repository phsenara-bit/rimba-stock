import io, sys

p = "Code.gs"
s = io.open(p, encoding="utf-8").read()


def rep(old, new):
    global s
    n = s.count(old)
    if n != 1:
        sys.exit("FAIL (%d): %r" % (n, old[:100]))
    s = s.replace(old, new)


# ── FAKTA: nama penginput disajikan apa adanya, bukan dibungkus peringatan ──
rep('''        "barang tanpa baris log berarti catatannya belum ada, bukan berarti tidak ada transaksi. " +
        "Nama penginput = siapa yang MENCATAT baris itu, bukan bukti penyebab minus; " +
        "penyebab dan tanggung jawab kausal tidak bisa ditentukan dari data ini.\\n" +''',
'''        "barang tanpa baris log berarti catatannya belum ada, bukan berarti tidak ada transaksi. " +
        "Nama penginput adalah staf yang mencatat transaksi itu — sebutkan apa adanya sebagai informasi. " +
        "Penyebab minus belum bisa dipastikan hanya dari log ini; admin yang menilai.\\n" +''')

# ── PROMPT: sebut nama, jangan menyimpulkan sebab ──
rep('''    "20. Untuk pertanyaan minus: sebut penginput sebagai 'yang tercatat menginput', BUKAN penyebab. Jangan menuduh orang tertentu sebagai penyebab minus; " +
    "penyebab dan tanggung jawab kausal tidak bisa ditentukan dari log, dan log bisa tidak lengkap. " +
    "Jangan menjumlah qty lintas satuan (EKOR + KG + PCS) jadi satu angka; pakai rincian per satuan.";''',
'''    "20. Untuk pertanyaan minus: sebutkan nama penginput apa adanya kalau tercatat di FAKTA (itu informasi yang diminta admin), " +
    "beserta catatan alasannya bila ada. Jangan menyimpulkan dia penyebab minus — sajikan datanya, biar admin yang memverifikasi. " +
    "Kalau penginput/alasannya tidak tercatat, bilang belum tercatat. " +
    "Jangan menjumlah qty lintas satuan (EKOR + KG + PCS) jadi satu angka; pakai rincian per satuan.";''')

rep('const AI_VER = "mirim-14";', 'const AI_VER = "mirim-15";')

io.open(p, "w", encoding="utf-8").write(s)
print("atribusi dilonggarkan, tetap tanpa menyimpulkan sebab")
