// Regenerates responsive AVIF + WebP images from the originals in assets-src/img.
//   npm i --no-save sharp   (once, from anywhere)   then:   node tools/optimize-images.mjs
// Outputs assets/img/<name>-<width>.avif and .webp. Re-run after adding or replacing a photo.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'assets-src/img', OUT = 'assets/img', WIDTHS = [640, 1024];
fs.mkdirSync(OUT, { recursive: true });
let total = 0;
for (const f of fs.readdirSync(SRC).filter(f => /\.(jpe?g|png)$/i.test(f))) {
  const name = path.basename(f, path.extname(f));
  const input = sharp(path.join(SRC, f)).rotate();
  const meta = await input.metadata();
  for (const w of WIDTHS) {
    const width = Math.min(w, meta.width);
    await input.clone().resize({ width }).avif({ quality: 48, effort: 6 }).toFile(`${OUT}/${name}-${w}.avif`);
    await input.clone().resize({ width }).webp({ quality: 70, effort: 6 }).toFile(`${OUT}/${name}-${w}.webp`);
  }
}
for (const f of fs.readdirSync(OUT)) total += fs.statSync(path.join(OUT, f)).size;
console.log('done:', fs.readdirSync(OUT).length, 'files,', (total / 1024).toFixed(0), 'KB');
