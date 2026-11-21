#!/usr/bin/env python3
"""Bikin admin/admin-dark.css dari stylesheet admin (inline <style> di index.html +
admin-binder.css). Jalanin ulang tiap habis nambah CSS baru:

    python3 admin/tools/gen-dark-css.py

Aturan: tiap deklarasi warna yang terang (latar/garis) atau gelap (teks) dibikin
versi gelapnya dengan HUE TETAP (hijau tetap hijau, cuma gelap), lalu ditempel di
bawah selector `html[data-theme="dark"] ...`. Warna brand/aksen yang udah
"tengah" (biru, kuning) dibiarin. Tambahan manual ada di MANUAL di bawah.
"""
import colorsys, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
P = 'html[data-theme="dark"]'

NAMED = {"white": "#ffffff", "#fff": "#ffffff"}
SURF_PROPS = ("background", "background-color", "border", "border-top", "border-bottom", "border-left",
              "border-right", "border-color", "outline", "outline-color", "border-top-color", "border-bottom-color",
              "border-left-color", "border-right-color", "box-shadow", "background-image", "caret-color")
TEXT_PROPS = ("color", "fill", "stroke", "text-decoration-color", "-webkit-text-fill-color")

def hex_rgb(h):
    h = h.lstrip("#")
    if len(h) == 3: h = "".join(c * 2 for c in h)
    if len(h) == 8: h = h[:6]
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))

def rgb_hex(r, g, b):
    return "#%02x%02x%02x" % tuple(max(0, min(255, round(x * 255))) for x in (r, g, b))

def surf(rgb):
    """warna latar/garis terang -> gelap (hue dipertahankan)"""
    h, l, s = colorsys.rgb_to_hls(*rgb)
    if l < 0.6: return None
    t = (l - 0.6) / 0.4            # 0 (L=.6) .. 1 (putih)
    nl = 0.30 - t * 0.17           # putih -> .13, abu terang -> lebih terang dikit
    if s < 0.25 or l > 0.97:       # netral / hampir putih -> permukaan navy
        return rgb_hex(*colorsys.hls_to_rgb(226 / 360, nl, 0.32))
    return rgb_hex(*colorsys.hls_to_rgb(h, nl, min(s, 0.55)))

def text(rgb):
    """teks gelap -> terang"""
    h, l, s = colorsys.rgb_to_hls(*rgb)
    if l > 0.45:
        if s < 0.3 and l < 0.62: return rgb_hex(*colorsys.hls_to_rgb(h, l + 0.14, s))  # abu "muted"
        return None
    if s < 0.45:                    # tinta navy/abu -> hampir putih kebiruan
        return rgb_hex(*colorsys.hls_to_rgb(226 / 360 if s > 0.05 else h, 0.90 - l * 0.25, min(s, 0.35)))
    return rgb_hex(*colorsys.hls_to_rgb(h, 0.72 - (l - 0.2) * 0.25, min(1, s)))  # teks berwarna (hijau/merah)

COLOR_RE = re.compile(r"#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]*\)|\bwhite\b")

def map_value(prop, val):
    is_text = prop in TEXT_PROPS
    changed = False

    def rep(m):
        nonlocal changed
        tok = m.group(0)
        if tok.startswith("rgb"):
            nums = [x.strip() for x in tok[tok.index("(") + 1:-1].replace("/", ",").split(",")]
            try:
                r, g, b = (float(x) / 255 for x in nums[:3]); a = float(nums[3]) if len(nums) > 3 else 1.0
            except ValueError:
                return tok
            dark = (r + g + b) / 3 < 0.45
            if prop == "box-shadow" and dark:
                changed = True; return "rgba(0, 0, 0, %.2f)" % min(0.7, a * 2.4 + 0.08)
            if prop == "background-image" and dark and a < 0.25:
                changed = True; return "rgba(255, 255, 255, %.3f)" % (a * 0.55)
            if a < 1 and not is_text and not dark and (r + g + b) / 3 > 0.9 and prop != "box-shadow":
                changed = True; return "rgba(23, 29, 48, %.2f)" % a   # putih transparan -> kaca gelap
            if a < 0.3: return tok
            new = text((r, g, b)) if is_text else surf((r, g, b))
            if not new: return tok
            changed = True
            nr, ng, nb = hex_rgb(new)
            return "rgba(%d, %d, %d, %s)" % (nr * 255, ng * 255, nb * 255, nums[3]) if len(nums) > 3 else new
        hx = NAMED.get(tok.lower(), tok)
        new = text(hex_rgb(hx)) if is_text else surf(hex_rgb(hx))
        if prop == "box-shadow" and new:   # cincin putih "sticker" -> cincin gelap
            changed = True; return new
        if not new: return tok
        changed = True
        return new

    out = COLOR_RE.sub(rep, val)
    return out if changed else None

def split_decls(body):
    """pisah deklarasi di ';' yang BUKAN di dalam () atau kutip (data:URI punya ';')"""
    out, buf, depth, q = [], "", 0, ""
    for ch in body:
        if q:
            buf += ch
            if ch == q: q = ""
            continue
        if ch in "\"'": q = ch
        elif ch == "(": depth += 1
        elif ch == ")": depth -= 1
        elif ch == ";" and depth == 0:
            out.append(buf); buf = ""; continue
        buf += ch
    if buf.strip(): out.append(buf)
    return out

def strip_comments(css):
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)

def parse(css):
    """generator (prelude_stack, selector, body)"""
    i, n = 0, len(css)
    stack = []
    buf = ""
    while i < n:
        c = css[i]
        if c == "{":
            prelude = buf.strip(); buf = ""
            if prelude.startswith("@media") or prelude.startswith("@supports"):
                stack.append(prelude); i += 1; continue
            if prelude.startswith("@"):  # keyframes / font-face -> lewati blok
                depth = 1; i += 1
                while i < n and depth:
                    depth += {"{": 1, "}": -1}.get(css[i], 0); i += 1
                continue
            j = css.index("}", i)
            yield list(stack), prelude, css[i + 1:j]
            i = j + 1; continue
        if c == "}":
            if stack: stack.pop()
            buf = ""; i += 1; continue
        buf += c; i += 1

def prefix(sel):
    out = []
    for s in sel.split(","):
        s = s.strip()
        if not s: continue
        if s.startswith(":root"): out.append(P + s[5:])
        elif s.startswith("html"): out.append(P + s[4:])
        else: out.append(P + " " + s)
    return ", ".join(out)

# Rule yang SENGAJA tetap seperti mode terang (kuning aktif, kartu gradient brand, dst)
KEEP = re.compile(r"\.nav-btn\.active|\.ab-chip\.active|\.ov-strip-d\.is-today|\.wa-ev:first-child \.wa-rank|\.wa-kpi\.is-main|\.safe-card|\.ov-income|\.per-hero-card|\.btn(?![-\w])(?!-ghost)")

def gen(css):
    rules = []
    for stack, sel, body in parse(strip_comments(css)):
        if not sel or sel.startswith("@") or "data-theme" in sel or "@media print" in " ".join(stack): continue
        if KEEP.search(sel): continue
        decls = []
        for d in split_decls(body):
            if ":" not in d or "url(" in d or "gradient(" in d: continue
            prop, val = d.split(":", 1)
            prop = prop.strip().lower(); val = val.strip()
            if prop.startswith("--") or (prop not in SURF_PROPS and prop not in TEXT_PROPS): continue
            if "var(" in val and not COLOR_RE.search(val): continue
            new = map_value(prop, val)
            if new: decls.append("%s: %s" % (prop, new))
        if decls:
            rule = "%s { %s; }" % (prefix(sel), "; ".join(decls))
            for m in reversed(stack): rule = "%s { %s }" % (m, rule)
            rules.append(rule)
    return rules

VARS = """
html[data-theme="dark"] {
  color-scheme: dark;
  --bg: #0e1322; --card: #171d30; --ink: #e6ebf7; --muted: #98a2bf; --line: #2a3352;
  --brand: #4c78f6; --brand-hover: #6189ff; --brand-light: rgba(91, 134, 255, .16);
  --ok: #4ade80; --ok-light: rgba(74, 222, 128, .14); --err: #f87171; --err-light: rgba(248, 113, 113, .14);
  --warn: #fbbf24; --info: #38bdf8; --ab-note: #3a3418;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, .35), 0 4px 12px rgba(0, 0, 0, .25);
  --shadow-md: 0 2px 4px rgba(0, 0, 0, .4), 0 10px 22px rgba(0, 0, 0, .35);
  --shadow-lg: 0 10px 30px rgba(0, 0, 0, .45);
  --ab-sticker: 0 0 0 3px #171d30, 0 3px 8px rgba(0, 0, 0, .4);
}
"""

MANUAL = """
/* --- manual: Argon form, tabel, inline style, elemen yang sengaja tetap terang --- */
html[data-theme="dark"] body { background-color: var(--bg); background-image: radial-gradient(rgba(255, 255, 255, .035) 1px, transparent 1.2px); color: var(--ink); }
html[data-theme="dark"] .form-control, html[data-theme="dark"] select, html[data-theme="dark"] textarea, html[data-theme="dark"] input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]) { background-color: #121829; color: var(--ink); border-color: #2f3a5c; }
html[data-theme="dark"] .form-control:focus { background-color: #141b2e; border-color: var(--brand); color: var(--ink); }
html[data-theme="dark"] .form-control::placeholder, html[data-theme="dark"] input::placeholder, html[data-theme="dark"] textarea::placeholder { color: #6f7a99; }
html[data-theme="dark"] .form-control:disabled, html[data-theme="dark"] .form-control[readonly] { background-color: #161c2e; color: var(--muted); }
html[data-theme="dark"] table, html[data-theme="dark"] .table { color: var(--ink); }
html[data-theme="dark"] .table td, html[data-theme="dark"] .table th, html[data-theme="dark"] td, html[data-theme="dark"] th { border-color: var(--line); }
html[data-theme="dark"] hr { border-color: var(--line); }
html[data-theme="dark"] a { color: var(--brand); }
html[data-theme="dark"] .hint, html[data-theme="dark"] small { color: var(--muted); }
html[data-theme="dark"] [style*="background:#fff"], html[data-theme="dark"] [style*="background: #fff"], html[data-theme="dark"] [style*="background:white"] { background: var(--card) !important; }
html[data-theme="dark"] [style*="background:#f8f9fa"], html[data-theme="dark"] [style*="background:#eef0f4"], html[data-theme="dark"] [style*="var(--bg,#f8f9fc)"], html[data-theme="dark"] [style*="var(--bg2,#f8f9fa)"] { background: #1b2238 !important; }
html[data-theme="dark"] [style*="background:#fee2e2"], html[data-theme="dark"] [style*="background:#fff5f5"] { background: rgba(248, 113, 113, .14) !important; }
html[data-theme="dark"] [style*="background:#dcfce7"], html[data-theme="dark"] [style*="background:#eafaf0"] { background: rgba(74, 222, 128, .14) !important; }
html[data-theme="dark"] [style*="background:#fef3c7"], html[data-theme="dark"] [style*="background:#fff3c4"] { background: rgba(251, 191, 36, .14) !important; }
html[data-theme="dark"] [style*="background:#eef2ff"] { background: var(--brand-light) !important; }
html[data-theme="dark"] [style*="color:#166534"], html[data-theme="dark"] [style*="color:#16a34a"] { color: #4ade80 !important; }
html[data-theme="dark"] [style*="color:#dc2626"], html[data-theme="dark"] [style*="color:#b91c1c"] { color: #f87171 !important; }
html[data-theme="dark"] [style*="color:#92400e"], html[data-theme="dark"] [style*="color:#8a5a00"] { color: #fbbf24 !important; }
html[data-theme="dark"] [style*="color:#6b7280"] { color: var(--muted) !important; }
html[data-theme="dark"] [style*="solid #e5e7eb"], html[data-theme="dark"] [style*="solid #f1f3f6"], html[data-theme="dark"] [style*="solid #fecaca"] { border-color: var(--line) !important; }
/* skeleton shimmer */
html[data-theme="dark"] .sk:not(.sk-dark), html[data-theme="dark"] .skel-line, html[data-theme="dark"] .skr-box { background: linear-gradient(90deg, #1c2338 25%, #262f4a 37%, #1c2338 63%) !important; background-size: 400% 100% !important; }
/* tetap terang / berwarna: tombol utama, nav aktif kuning, kartu gradient brand */
html[data-theme="dark"] .btn:not(.btn-ghost) { color: #ffffff; }
html[data-theme="dark"] .nav-btn.active, html[data-theme="dark"] .nav-btn.active * { color: #10245e; }
html[data-theme="dark"] .ab-chip.active, html[data-theme="dark"] .ab-chip.active span { color: #10245e; }
html[data-theme="dark"] .so-chip.active { background: var(--brand); border-color: var(--brand); color: #ffffff; }
html[data-theme="dark"] img { filter: none; }
html[data-theme="dark"] .ov-strip-d.is-today, html[data-theme="dark"] .ov-strip-d.is-today * { color: #10245e; }
html[data-theme="dark"] .wa-ev:first-child .wa-rank { color: #10245e; }
html[data-theme="dark"] .nav-badge { background: #f43f5e; color: #ffffff; }
html[data-theme="dark"] .ov-income { background-color: #2148d8; }
html[data-theme="dark"] ::-webkit-scrollbar-thumb { background: #2a3352; }
"""

def main():
    html = (ROOT / "index.html").read_text()
    inline = "\n".join(re.findall(r"<style[^>]*>(.*?)</style>", html, re.S))
    binder = (ROOT / "admin-binder.css").read_text()
    rules = gen(inline) + gen(binder)
    out = "/* AUTO-GENERATED oleh admin/tools/gen-dark-css.py -- jangan edit manual, edit generator-nya. */\n" + VARS + "\n".join(rules) + "\n" + MANUAL
    (ROOT / "admin-dark.css").write_text(out)
    print(len(rules), "rules ->", ROOT / "admin-dark.css")

if __name__ == "__main__":
    main()
