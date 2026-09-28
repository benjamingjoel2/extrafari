# Extrafari

Marketing website for **Extrafari**, an African safari operator offering private,
tailor-made safaris across East and Southern Africa.

The site is plain HTML, CSS and JavaScript with no build step or runtime
dependencies, so it can be hosted anywhere static files are served
(GitHub Pages, Netlify, Cloudflare Pages, S3).

## Layout

The home page follows a full-bleed, module-based structure typical of luxury
safari operators: a fixed black header with a circular menu button, centred
logo and orange enquiry button; a full-screen hero with tracked wordmark and
video control; then alternating dark green, sand and dark brown modules. In
order: intro with portrait image, country carousel with tab bar, stats row,
full-bleed journeys band, experiences carousel with circular images, tabbed
"why travel with us" module, accreditation card carousel, impact block with two
images, guest reviews, a giant "READY?" call to action, newsletter sign-up and
a centred footer.

Interior pages share the same header, footer, typography and colour tokens.

## Pages

| File | Purpose |
| --- | --- |
| `index.html` | Home, structured as described above |
| `safaris.html` | Eight itineraries with region / style / duration filters (state is kept in the URL) |
| `destinations.html` | Country guides plus a month-by-month season table |
| `about.html` | Company story, values, conservation, team |
| `contact.html` | Enquiry form, contact details, FAQ |
| `404.html` | Not-found page (GitHub Pages serves it automatically) |

Shared styles live in `css/styles.css` and behaviour in `js/main.js`.

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
