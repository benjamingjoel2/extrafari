# Extrafari

Marketing website for **Extrafari**, an African safari operator offering private,
tailor-made safaris across East and Southern Africa.

The site is plain HTML, CSS and JavaScript with no build step or runtime
dependencies, so it can be hosted anywhere static files are served
(GitHub Pages, Netlify, Cloudflare Pages, S3).

## Style

The visual design follows a premium automotive-brand look: a thin near-black
top bar with small tracked uppercase navigation; a full-bleed hero slider with a
wide, bold, uppercase headline, a circular-chevron call to action, red progress
rings on the slide dots and a pause control; a white editorial story carousel;
a two-column grid of full-bleed image tiles; a black stats band; guest reviews;
a grey newsletter band and a dark, centred footer. Red is the only accent.

Type is Archivo (Google Fonts), set at an expanded width for headlines and
navigation. Colours and sizes live in the `:root` block of `css/styles.css`.

The home page is built from these modules, in order: hero slider (`.hero`),
story carousel (`#stories`), tile grid (`#experiences`), stats band (`.band`),
reviews (`.reviews`), a closing call-to-action tile and, on every page, the
newsletter band and footer.

## Pages

| File | Purpose |
| --- | --- |
| `index.html` | Home: hero slider, stories, image tiles, stats, reviews |
| `safaris.html` | Eight itineraries with region / style / duration filters (state is kept in the URL) |
| `destinations.html` | Country guides plus a month-by-month season table |
| `parks.html` | Searchable directory of every national park in Africa, with featured top picks and park selection for enquiries |
| `about.html` | Company story, values, conservation, team |
| `contact.html` | Enquiry form, contact details, FAQ |
| `404.html` | Not-found page (GitHub Pages serves it automatically) |

Shared styles live in `css/styles.css` and behaviour in `js/main.js`. The parks
directory uses `js/parks-data.js` (the dataset) and `js/parks.js` (search,
filters and selection).

## Editing pages

The root HTML files are generated. Edit the page bodies in `src/pages/` and the
shared header and footer in `src/partials/`, then rebuild:

```sh
python3 build.py
```

Page titles, descriptions and per-page scripts are listed in `build.py`.

## National parks directory

`js/parks-data.js` holds 388 national parks across 54 countries. The base list
comes from Wikipedia's list of national parks in Africa (CC BY-SA), with a few
real parks added that the list omits, and Extrafari editorial notes on the 33
featured parks (description, best time, wildlife). Each entry has `name`,
`country`, `region`, `area` (km²), `est` (year), and `operates` (true for the
eight countries where Extrafari runs its own safaris).

On `parks.html` visitors can search by park, country, region or wildlife, filter
by region, country or Extrafari-operated countries, and add parks to a
selection. The selection is kept in `sessionStorage` and handed to
`contact.html?parks=...`, where it appears as chips, a hidden `parks` field and
a pre-filled message.

## Running locally

Open `index.html` directly, or serve the folder:

```sh
npx serve .
# or
python3 -m http.server 8000
```

## Newsletter form

The newsletter form on the home page validates on the client and shows a
confirmation. Add `data-endpoint` to `#newsletter-form` in `index.html` to POST
sign-ups to a mailing-list service.

## Enquiry form

The form validates on the client and, by default, opens the visitor's email
client with the enquiry pre-filled (a `mailto:` link to `hello@extrafari.com`).

To submit to a real endpoint instead (Formspree, Netlify Forms, your own API),
add a `data-endpoint` attribute to the form in `contact.html`:

```html
<form class="form" id="enquiry-form" data-endpoint="https://formspree.io/f/your-id" novalidate>
```

The script then POSTs the form as `multipart/form-data` and expects a 2xx
response. A hidden honeypot field (`website`) is included for basic spam
filtering.

## Deploying to GitHub Pages

1. Push to the default branch.
2. In the repository settings, open **Pages** and set the source to
   **Deploy from a branch**, branch `main`, folder `/ (root)`.
3. The `.nojekyll` file is already present so assets are served as-is.

## Placeholders to replace

- Contact email, phone number and office addresses in `contact.html` and the
  footer of every page.
- Team names on `about.html`.
- Prices, itineraries and testimonials, which are illustrative.
- The scenic backgrounds are CSS gradients with silhouettes (the `.scene--*`
  rules in `css/styles.css`). Replace them with photography by setting a
  `background-image` on each `.scene--*::before` rule, or drop `<img>` tags
  into the `.scene` containers.
- The hero has a play/pause control ready for a background video: add a
  `<video>` inside `.hero__bg` and the button will drive it.
- The accreditation cards name typical industry bodies as examples; replace
  them with Extrafari's actual memberships and logos.
- The guest rating and reviews are illustrative.
