// Converts downloaded Wikimedia park photos to small self-hosted WebP files and updates js/parks-data.js.
//   node tools/finalize-park-images.mjs <raw-dir>
// <raw-dir> holds <slug>-big.bin (featured parks, ~960px) and <slug>-s.bin (other parks, ~120px).
// Parks with a converted photo get `slug` (served from assets/parks/) and lose the hotlinked `img`;
// parks without one keep `img` as a lazy hotlink fallback. Needs: npm i --no-save sharp
import sharp from 'sharp';
import fs from 'node:fs';

const raw = process.argv[2];
if (!raw) { console.error('usage: node tools/finalize-park-images.mjs <raw-dir>'); process.exit(1); }
const slugOf = p => `${p.name} ${p.country}`.normalize('NFKD').replace(/[^\x00-\x7f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const file = 'js/parks-data.js';
const src = fs.readFileSync(file, 'utf8');
const m = src.match(/window\.EXTRAFARI_PARKS = (\[.*\]);/s);
const parks = JSON.parse(m[1]);
fs.mkdirSync('assets/parks', { recursive: true });
let self = 0, hot = 0;
for (const p of parks) {
  const slug = p.slug || slugOf(p);
  const big = `${raw}/${slug}-big.bin`, small = `${raw}/${slug}-s.bin`;
  try {
    if (fs.existsSync(big)) {
      const im = sharp(big).rotate();
      await im.clone().resize({ width: 640, withoutEnlargement: true }).webp({ quality: 72, effort: 5 }).toFile(`assets/parks/${slug}-640.webp`);
      await im.clone().resize({ width: 320, withoutEnlargement: true }).webp({ quality: 70, effort: 5 }).toFile(`assets/parks/${slug}-320.webp`);
      await im.clone().resize({ width: 120, withoutEnlargement: true }).webp({ quality: 68, effort: 5 }).toFile(`assets/parks/${slug}-s.webp`);
      p.slug = slug; delete p.img; self++;
    } else if (fs.existsSync(small)) {
      await sharp(small).rotate().resize({ width: 120, withoutEnlargement: true }).webp({ quality: 68, effort: 5 }).toFile(`assets/parks/${slug}-s.webp`);
      p.slug = slug; delete p.img; self++;
    } else if (p.img) hot++;
  } catch (e) { console.error('skip', slug, e.message); if (p.img) hot++; }
}
fs.writeFileSync(file, src.slice(0, m.index) + 'window.EXTRAFARI_PARKS = ' + JSON.stringify(parks) + ';' + src.slice(m.index + m[0].length));
console.log(`self-hosted: ${self}, still hotlinked: ${hot}`);
