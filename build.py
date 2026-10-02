#!/usr/bin/env python3
"""Assemble the static site: wraps each page body in src/pages with the shared
head, header and footer from src/partials and writes the result to the repo root.

    python3 build.py
"""
import pathlib

ROOT = pathlib.Path(__file__).parent
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
              "Extrafari is an owner-run African safari operator with teams in Nairobi, Arusha and Cape Town. Meet the planners and guides behind every trip.", []),
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
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{desc}">
  <meta property="og:type" content="website">
  <meta name="theme-color" content="#000000">
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Manrope:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
"""

def main():
    header = (ROOT / "src/partials/header.html").read_text()
    footer = (ROOT / "src/partials/footer.html").read_text()
    for name, (title, desc, scripts) in PAGES.items():
        body = (ROOT / f"src/pages/{name}.html").read_text()
        extra = "".join(f'  <script src="{s}" defer></script>\n' for s in scripts)
        html = HEAD.format(title=title, desc=desc) + header + "\n" + body + "\n" + footer + extra + "</body>\n</html>\n"
        (ROOT / f"{name}.html").write_text(html)
        print("built", f"{name}.html")

if __name__ == "__main__":
    main()
