#!/usr/bin/env python3
"""Assemble the static site.

Wraps each page body in src/pages with the shared head, header and footer from src/partials, turns every
`.scene scene--<photo>` container into a responsive, lazy-loaded <picture> (AVIF + WebP, two widths), preloads the
first-screen hero image and the font, and writes the HTML files to the repo root, plus sitemap.xml and robots.txt.

    python3 build.py
Images come from `node tools/optimize-images.mjs` (see that file).
"""
import pathlib, re, struct, subprocess, os, sys

ROOT = pathlib.Path(__file__).parent
SITE = "https://extrafari.tourground.com"
IMG = ROOT / "assets/img"
SRC_IMG = ROOT / "assets-src/img"

PAGES = {
    "index": ("Extrafari | Tailor-made African Safaris",
              "Extrafari designs private, expertly guided safaris across East and Southern Africa. Great Migration, Okavango Delta, gorilla trekking and more.", []),
    "safaris": ("Safaris | Extrafari",
                "Browse Extrafari's signature safaris across Kenya, Tanzania, Botswana, South Africa, Namibia, Zambia, Uganda and Rwanda.", []),
    "destinations": ("Destinations | Extrafari",
                     "Where to go on safari and when: Kenya, Tanzania, Botswana, South Africa, Namibia, Zambia, Uganda and Rwanda, with a month-by-month season guide.", []),
    "parks": ("National parks of Africa | Extrafari",
              "Search every national park in Africa by name, country or region, see Extrafari's top picks, and add parks to a safari enquiry.", ["js/parks-data.js", "js/parks.js"]),
    "about": ("About | Extrafari",
              "Extrafari is an owner-run African safari operator with teams in Nairobi, Arusha and Cape Town. We plan and operate every trip ourselves.", []),
    "credits": ("Photo credits | Extrafari",
                "Photographers and licences for the imagery used on the Extrafari website.", ["js/credits.js"]),
    "privacy": ("Privacy policy | Extrafari",
                "How Extrafari collects, uses and protects the details you share when planning a safari.", []),
    "terms": ("Booking terms | Extrafari",
              "The booking terms for a tailor-made Extrafari safari: enquiries, deposits, changes, cancellations, insurance and liability.", []),
    "cookies": ("Cookie policy | Extrafari",
                "What the Extrafari website stores in your browser.", []),
    "contact": ("Plan your safari | Extrafari",
                "Send Extrafari a safari enquiry and receive a tailored proposal within three working days.", []),
}

HEAD = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <meta name="description" content="{desc}">
  <link rel="canonical" href="{url}">
  <meta property="og:site_name" content="Extrafari">
  <meta property="og:type" content="website">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{desc}">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="{site}/assets/og.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#181818">
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
  <link rel="preload" href="assets/fonts/archivo-subset.woff2" as="font" type="font/woff2" crossorigin>
{preload}  <link rel="stylesheet" href="css/styles.css">
{jsonld}</head>
<body>
"""

EMAIL = "extrafari@tourground.com"
# Business address: Kofisi Riverside, Nairobi (premium coworking, owner-approved arrangement).
JSONLD = ('  <script type="application/ld+json">{"@context":"https://schema.org","@type":"TravelAgency","name":"Extrafari",'
          '"url":"' + SITE + '/","email":"' + EMAIL + '","address":{"@type":"PostalAddress","streetAddress":"Kofisi Riverside, 104 Riverside Drive",'
          '"addressLocality":"Nairobi","addressCountry":"KE"},"areaServed":["Kenya","Tanzania","Botswana","South Africa","Namibia","Zambia","Uganda","Rwanda"]}</script>\n')

TOKEN = r"(?<![\w-])"
TAG = re.compile(r"<(\w+)((?:\s[^>]*)?)>")
CLASS = re.compile(r'class="([^"]*)"')

SIZES_BY_OWN_CLASS = [
    ("story__media", "(max-width: 860px) 100vw, 493px"),
    ("card__media", "(max-width: 639px) 100vw, 580px"),
    ("dest__art", "(max-width: 899px) 100vw, 470px"),
    ("split__art", "(max-width: 899px) 100vw, 560px"),
]

def jpeg_size(path):
    d = path.read_bytes(); i = 2
    while i < len(d) and d[i] == 0xFF:
        m = d[i + 1]; n = struct.unpack(">H", d[i + 2:i + 4])[0]
        if m in (0xC0, 0xC2):
            h, w = struct.unpack(">HH", d[i + 5:i + 9]); return w, h
        i += 2 + n
    return 1024, 683

def photos():
    return {p.name[:-len("-1024.avif")] for p in IMG.glob("*-1024.avif")}

def picture(name, sizes, eager):
    w, h = jpeg_size(SRC_IMG / f"{name}.jpg")
    w1 = min(1024, w); h1 = round(h * w1 / w)
    a = f"assets/img/{name}"
    attrs = 'loading="eager" fetchpriority="high"' if eager else 'loading="lazy" decoding="async"'
    return (f'<picture><source type="image/avif" srcset="{a}-640.avif 640w, {a}-1024.avif 1024w" sizes="{sizes}">'
            f'<img src="{a}-1024.webp" srcset="{a}-640.webp 640w, {a}-1024.webp 1024w" sizes="{sizes}" alt="" width="{w1}" height="{h1}" {attrs}></picture>')

def inject_pictures(html, names):
    """Insert a <picture> as the first child of every photo scene. Returns (html, preload_tag_or_empty)."""
    out, pos, ctx, first_hero_done, preload = [], 0, None, False, ""
    for m in TAG.finditer(html):
        tag, attrs = m.group(1), m.group(2)
        cm = CLASS.search(attrs); cls = cm.group(1) if cm else ""
        if tag == "section": ctx = None
        if re.search(TOKEN + r"hero-slide(?![\w_-])", cls):
            ctx = ("100vw", "is-active" in cls.split())
        elif re.search(TOKEN + r"tile(?![\w_-])", cls):
            ctx = ("100vw" if "tile--wide" in cls else "(max-width: 760px) 100vw, 50vw", False)
        if not re.search(TOKEN + r"scene(?![\w-])", cls): continue
        name = next((n for n in re.findall(r"scene--([a-z0-9]+)", cls) if n in names), None)
        if not name: continue
        sizes = next((s for k, s in SIZES_BY_OWN_CLASS if k in cls.split()), None)
        eager = False
        if sizes is None:
            sizes, eager = ctx if ctx else ("(max-width: 760px) 100vw, 50vw", False)
        if eager and not first_hero_done:
            first_hero_done = True
            a = f"assets/img/{name}"
            preload = (f'  <link rel="preload" as="image" type="image/avif" fetchpriority="high" '
                       f'imagesrcset="{a}-640.avif 640w, {a}-1024.avif 1024w" imagesizes="100vw">\n')
        else:
            eager = False
        out.append(html[pos:m.end()]); out.append(picture(name, sizes, eager)); pos = m.end()
    out.append(html[pos:])
    return "".join(out), preload

def main():
    header = (ROOT / "src/partials/header.html").read_text()
    footer = (ROOT / "src/partials/footer.html").read_text()
    names = photos()
    urls = []
    for name, (title, desc, scripts) in PAGES.items():
        body = (ROOT / f"src/pages/{name}.html").read_text()
        page = header + "\n" + body + "\n" + footer
        page, preload = inject_pictures(page, names)
        url = SITE + "/" + ("" if name == "index" else f"{name}.html")
        urls.append(url)
        extra = "".join(f'  <script src="{s}" defer></script>\n' for s in scripts)
        jsonld = JSONLD if name == "index" else ""
        html = HEAD.format(title=title, desc=desc, url=url, site=SITE, preload=preload, jsonld=jsonld) + page + extra + "</body>\n</html>\n"
        (ROOT / f"{name}.html").write_text(html)
        print("built", f"{name}.html", "(preload hero)" if preload else "")
    (ROOT / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f"  <url><loc>{u}</loc></url>\n" for u in urls) + "</urlset>\n")
    (ROOT / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {SITE}/sitemap.xml\n")

def localize():
    """French, German and Spanish copies of every page (scripts/i18n.mjs, dictionaries in i18n/)."""
    mode = "check" if os.environ.get("I18N_STRICT") else "build"
    r = subprocess.run(["node", str(ROOT / "scripts/i18n.mjs"), mode])
    if r.returncode:
        sys.exit(r.returncode)

if __name__ == "__main__":
    main()
    localize()
