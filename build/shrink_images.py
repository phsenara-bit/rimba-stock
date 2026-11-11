import io, re, base64, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
IMG = os.path.join(HERE, "tmp_img")

s = io.open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
orig = len(s)


def b64_of(name):
    with open(os.path.join(IMG, name), "rb") as f:
        return base64.b64encode(f.read()).decode()


# 1. Logo login: 775px -> 280px (ditampilkan 140px, jadi ini 2x retina)
logo_b64 = b64_of("logo_280.png")
pat_logo = re.compile(r'(<img src="data:image/png;base64,)[A-Za-z0-9+/=]+(" alt="Rimba Alam Logo")')
n = len(pat_logo.findall(s))
if n != 1:
    sys.exit("FAIL logo (%d)" % n)
s = pat_logo.sub(lambda m: m.group(1) + logo_b64 + m.group(2), s)
print("logo -> 280px")

# 2. Ikon Mirim: 320px -> 96px (ditampilkan 28-40px)
for var, name in (("ICON_LIGHT", "ICON_LIGHT_96.png"), ("ICON_DARK", "ICON_DARK_96.png")):
    b = b64_of(name)
    pat = re.compile(r'(var ' + var + r' = "data:image/png;base64,)[A-Za-z0-9+/=]+(")')
    n = len(pat.findall(s))
    if n != 1:
        sys.exit("FAIL %s (%d)" % (var, n))
    s = pat.sub(lambda m, b=b: m.group(1) + b + m.group(2), s)
    print(var, "-> 96px")

io.open(os.path.join(ROOT, "index.html"), "w", encoding="utf-8").write(s)
print("ukuran: %d -> %d byte (%.2f MB)" % (orig, len(s), len(s) / 1024.0 / 1024.0))
