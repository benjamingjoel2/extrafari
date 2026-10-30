#!/usr/bin/env node
// Static-site localizer (dependency-free). Builds French, German and Spanish copies of the
// English site from translation dictionaries, so every locale is pre-rendered HTML:
//
//   node scripts/i18n.mjs build     write <out>/fr/, <out>/de/, <out>/es/ from <out>/ (English)
//   node scripts/i18n.mjs extract   list every translatable string to i18n/strings.json
//   node scripts/i18n.mjs check     like build, but exit 1 if any string is missing a translation
//
// Settings live in i18n/config.json. Translations live in i18n/{fr,de,es}.json as
// { "English text": "translation" }. Text is matched after collapsing whitespace.
// What is translated: HTML text, <title>, alt/title/aria-label/placeholder attributes, meta
// descriptions and share text, and string literals in the JavaScript files listed in config.
// Internal links are pointed at the same page in the same language; a language selector
// replaces each <!--i18n:selector--> marker; hreflang alternates and a canonical are added.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync, rmSync, copyFileSync } from 'node:fs';
import { join, dirname, relative, extname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CFG = JSON.parse(readFileSync(join(ROOT, 'i18n/config.json'), 'utf8'));
const OUT = join(ROOT, CFG.out || 'dist');
const LOCALES = CFG.locales || ['fr', 'de', 'es'];
const DEFAULT = CFG.default || 'en';
const LABELS = { en: 'EN', fr: 'FR', de: 'DE', es: 'ES' };
const NAMES = { en: 'English', fr: 'Français', de: 'Deutsch', es: 'Español' };
const mode = process.argv[2] || 'build';

const norm = (s) => s.replace(/\s+/g, ' ').trim();
const hasWords = (s) => /\p{L}{2}/u.test(s);
const keep = new Set((CFG.keep || []).map(norm));

function loadDict(l) {
  const f = join(ROOT, 'i18n', `${l}.json`);
  const d = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {};
  const m = new Map();
  for (const [k, v] of Object.entries(d)) m.set(norm(k), v);
  return m;
}

// ---------------------------------------------------------------- translation core
function makeT(dict, missing) {
  return function T(s, where) {
    const k = norm(s);
    if (!k || !hasWords(k) || keep.has(k)) return s;
    if (dict && dict.has(k)) {
      const lead = s.match(/^\s*/)[0];
      const trail = s.match(/\s*$/)[0];
      return lead + dict.get(k) + trail;
    }
    missing.add(k + (where ? `\u0000${where}` : ''));
    return s;
  };
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: '\u00a0' };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e] ?? m));
const encText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\u00a0/g, '&nbsp;');
const encAttr = (s) => encText(s).replace(/"/g, '&quot;');

const TEXT_ATTRS = new Set(['alt', 'title', 'aria-label', 'placeholder', 'data-i18n']);
const META_KEYS = /^(description|og:title|og:description|og:image:alt|twitter:title|twitter:description|og:site_name)$/;

// Translate an HTML fragment. ctx: { T, link(url, attr, tag) } ; jsInline(code) for inline scripts.
function htmlPass(src, ctx) {
  const re = /<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>|<[a-zA-Z!/][^>]*>|[^<]+|</g;
  let out = '';
  let m;
  while ((m = re.exec(src))) {
    const tok = m[0];
    if (tok.startsWith('<!--')) { out += tok; continue; }
    if (/^<script\b/i.test(tok)) {
      const open = tok.match(/^<script\b[^>]*>/i)[0];
      const body = tok.slice(open.length, tok.length - tok.match(/<\/script\s*>$/i)[0].length);
      const tagOut = tagPass(open, ctx);
      const jid = (open.match(/\bid="([^"]+)"/) || [])[1];
      if (jid && ctx.json && (CFG.jsonScripts || []).includes(jid)) out += tagOut + ctx.json(body) + '</script>';
      else if (/type="application\/(ld\+)?json"/i.test(open) || /src=/i.test(open) || !ctx.jsInline) out += tagOut + body + '</script>';
      else out += tagOut + ctx.jsInline(body) + '</script>';
      continue;
    }
    if (/^<style\b/i.test(tok)) { out += tok; continue; }
    if (tok[0] === '<' && tok.length > 1) { out += tagPass(tok, ctx); continue; }
    // text
    if (!hasWords(tok)) { out += tok; continue; }
    const dec = decode(tok);
    const tr = ctx.T(dec, 'text');
    out += tr === dec ? tok : encText(tr);
  }
  return out;
}

function tagPass(tag, ctx) {
  if (/^<\//.test(tag) || /^<!/.test(tag)) return tag;
  const name = tag.match(/^<([a-zA-Z0-9-]+)/)[1].toLowerCase();
  const isMeta = name === 'meta';
  const metaKey = isMeta ? (tag.match(/\b(?:name|property)="([^"]+)"/) || [])[1] : null;
  return tag.replace(/(\s)([a-zA-Z_:][-a-zA-Z0-9_:.]*)=("([^"]*)"|'([^']*)')/g, (all, sp, attr, q, dv, sv) => {
    const a = attr.toLowerCase();
    const v = dv ?? sv;
    const qc = dv !== undefined ? '"' : "'";
    if (TEXT_ATTRS.has(a) || (isMeta && a === 'content' && metaKey && META_KEYS.test(metaKey)) || (name === 'input' && a === 'value' && /type="(submit|button)"/.test(tag))) {
      const dec = decode(v);
      const tr = ctx.T(dec, `attr:${a}`);
      return tr === dec ? all : `${sp}${attr}=${qc}${encAttr(tr)}${qc}`;
    }
    if ((a === 'href' || a === 'action' || a === 'src' || a === 'srcset' || a === 'imagesrcset' || a === 'poster' || a === 'data-src') && ctx.link) {
      const nv = ctx.link(v, a, name, tag);
      return nv === v ? all : `${sp}${attr}=${qc}${nv}${qc}`;
    }
    if (a === 'lang' && name === 'html' && ctx.lang) return `${sp}${attr}=${qc}${ctx.lang}${qc}`;
    if (ctx.attrHook) { const r = ctx.attrHook(a, v, name, tag); if (r !== undefined && r !== v) return `${sp}${attr}=${qc}${r}${qc}`; }
    return all;
  });
}

// ---------------------------------------------------------------- JavaScript string literals
// Walks JS source, translating string and template literals through T. Regex literals and
// comments are skipped. Template literals: the static chunks are treated as HTML fragments.
function jsPass(src, ctx) {
  let out = '';
  let i = 0;
  let lastSig = '';
  const n = src.length;
  const regexAllowedAfter = /[(,=:[!&|?{};+\-*%<>~^]$|^$|\b(return|typeof|case|do|else|in|of|new|delete|void|throw)$/;
  function readTemplate() {
    // src[i] === '`'
    let j = i + 1;
    let chunk = '';
    let res = '`';
    const flush = () => { res += templChunk(chunk); chunk = ''; };
    while (j < n) {
      const c = src[j];
      if (c === '\\') { chunk += src.slice(j, j + 2); j += 2; continue; }
      if (c === '`') { flush(); res += '`'; j++; break; }
      if (c === '$' && src[j + 1] === '{') {
        flush();
        // find matching brace, recursively handling nested strings/templates
        let depth = 1; let k = j + 2; const start = k;
        while (k < n && depth) {
          const d = src[k];
          if (d === '{') depth++;
          else if (d === '}') { depth--; if (!depth) break; }
          else if (d === '`' || d === '"' || d === "'") { k = skipString(k); continue; }
          k++;
        }
        res += '${' + jsPass(src.slice(start, k), ctx) + '}';
        j = k + 1;
        continue;
      }
      chunk += c; j++;
    }
    i = j;
    return res;
  }
  function skipString(k) {
    const q = src[k]; let j = k + 1;
    while (j < n) {
      if (src[j] === '\\') { j += 2; continue; }
      if (q === '`' && src[j] === '$' && src[j + 1] === '{') { let depth = 1; j += 2; while (j < n && depth) { if (src[j] === '{') depth++; else if (src[j] === '}') depth--; else if (src[j] === '`' || src[j] === '"' || src[j] === "'") { j = skipString(j); continue; } j++; } continue; }
      if (src[j] === q) return j + 1;
      j++;
    }
    return j;
  }
  function templChunk(raw) {
    if (!hasWords(raw)) return raw;
    const unesc = raw.replace(/\\`/g, '`');
    let r;
    if (/[<>]/.test(unesc)) r = htmlPass(unesc, ctx);
    else { const t = ctx.T(unesc, 'js'); r = t; }
    return r === unesc ? raw : r.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  }
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { const e = src.indexOf('\n', i); const j = e < 0 ? n : e; out += src.slice(i, j); i = j; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); const j = e < 0 ? n : e + 2; out += src.slice(i, j); i = j; continue; }
    if (c === '/' && regexAllowedAfter.test(lastSig)) {
      // regex literal
      let j = i + 1; let inClass = false;
      while (j < n) { const d = src[j]; if (d === '\\') { j += 2; continue; } if (d === '[') inClass = true; else if (d === ']') inClass = false; else if (d === '/' && !inClass) break; else if (d === '\n') break; j++; }
      j++; while (j < n && /[a-z]/i.test(src[j])) j++;
      out += src.slice(i, j); i = j; lastSig = 'x'; continue;
    }
    if (c === '"' || c === "'") {
      const j = skipString(i);
      const lit = src.slice(i + 1, j - 1);
      out += c + strLit(lit, c) + c;
      i = j; lastSig = 'x'; continue;
    }
    if (c === '`') { out += readTemplate(); lastSig = 'x'; continue; }
    out += c;
    if (!/\s/.test(c)) {
      if (/[A-Za-z0-9_$]/.test(c)) { lastSig = (/[A-Za-z0-9_$]$/.test(lastSig) ? lastSig : '') + c; }
      else lastSig = c;
    }
    i++;
  }
  return out;
  function strLit(lit, q) {
    if (!hasWords(lit)) return lit;
    const val = lit.replace(/\\(u\{[0-9a-f]+\}|u[0-9a-f]{4}|x[0-9a-f]{2}|.)/gis, (m, e) => {
      if (e[0] === 'u') return String.fromCodePoint(parseInt(e.replace(/[u{}]/g, ''), 16));
      if (e[0] === 'x') return String.fromCharCode(parseInt(e.slice(1), 16));
      return { n: '\n', t: '\t', r: '\r', '0': '\0' }[e] ?? e;
    });
    let tr;
    if (/<[a-z/][^>]*>/i.test(val)) tr = htmlPass(val, ctx);
    else tr = ctx.T(val, 'js');
    if (tr === val) return lit;
    return tr.replace(/\\/g, '\\\\').replace(new RegExp(q, 'g'), '\\' + q).replace(/\n/g, '\\n').replace(/<\/script/gi, '<\\/script');
  }
}

// ---------------------------------------------------------------- files and URLs
function walk(dir, base = dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const rel = relative(base, p).split('\\').join('/');
    if ([...LOCALES].some((l) => rel === l || rel.startsWith(l + '/'))) continue;
    if ((CFG.ignore || []).some((g) => rel === g || rel.startsWith(g.replace(/\*$/, '')))) continue;
    if (statSync(p).isDirectory()) out.push(...walk(p, base));
    else out.push(rel);
  }
  return out;
}

const PAGE_EXT = /\.html?$/;
const isAsset = (path) => /\.(css|js|mjs|json|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|xml|txt|pdf|mp4|webm|map)$/i.test(path.split(/[?#]/)[0]) || (CFG.assetPrefixes || []).some((p) => path.startsWith(p));

// page URL path (as served) for a file rel path
function urlFor(rel) {
  if (rel.endsWith('/index.html')) return '/' + rel.slice(0, -'index.html'.length);
  if (rel === 'index.html') return '/';
  if (CFG.cleanUrls && rel.endsWith('.html')) return '/' + rel.slice(0, -5);
  return '/' + rel;
}
const locPath = (l, path) => (l === DEFAULT ? path : `/${l}${path === '/' ? '/' : path}`);

function selectorHtml(cur, pageUrlFor) {
  const items = [DEFAULT, ...LOCALES].map((l) => {
    const href = pageUrlFor(l);
    const curAttr = l === cur ? ' aria-current="true"' : '';
    return `<a class="lang-switch__link" href="${href}" hreflang="${l}" lang="${l}"${curAttr}><span aria-hidden="true">${LABELS[l]}</span><span class="lang-switch__sr">${NAMES[l]}</span></a>`;
  });
  return `<nav class="lang-switch" aria-label="${{ en: 'Language', fr: 'Langue', de: 'Sprache', es: 'Idioma' }[cur]}">${items.join('<span class="lang-switch__sep" aria-hidden="true">·</span>')}</nav>`;
}

function expandJs(files) {
  const out = [];
  for (const pat of CFG.jsFiles || []) {
    if (!pat.includes('*')) { out.push(pat); continue; }
    const re = new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$');
    out.push(...files.filter((f) => re.test(f) && !/\.(fr|de|es)\.m?js$/.test(f)));
  }
  return out;
}


// Data files of the form `window.X = <JSON>;` (config "jsData": { "js/file.js": ["keepKey", ...] }):
// translated as JSON so that keys listed there (names, slugs, credits) stay as they are.
function jsDataPass(src, keepKeys, T) {
  const m = src.match(/^([\s\S]*?=\s*)([\[{][\s\S]*[\]}])(\s*;?\s*)$/);
  if (!m) return null;
  let data;
  try { data = JSON.parse(m[2]); } catch { return null; }
  const walkJ = (v) => {
    if (typeof v === 'string') return /^(https?:|\/|mailto:)/.test(v) || /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v) ? v : T(v, 'json');
    if (Array.isArray(v)) return v.map(walkJ);
    if (v && typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v)) o[k] = keepKeys.includes(k) ? x : walkJ(x); return o; }
    return v;
  };
  return m[1] + JSON.stringify(walkJ(data)) + m[3];
}

function build() {
  const files = walk(OUT);
  const htmlFiles = files.filter((f) => PAGE_EXT.test(f) && !(CFG.skipPages || []).includes(f));
  const jsFiles = new Set(expandJs(files));
  const site = (CFG.siteUrl || '').replace(/\/$/, '');
  const allMissing = {};
  const relMode = !!CFG.relative;

  // English pages also get hreflang + selector. Read every source first: the English files are rewritten in place.
  const variants = [DEFAULT, ...LOCALES];
  const SRC = new Map(htmlFiles.map((rel) => [rel, readFileSync(join(OUT, rel), 'utf8')]));
  const JSSRC = new Map([...jsFiles].map((rel) => [rel, readFileSync(join(OUT, rel), 'utf8')]));
  for (const l of variants) {
    const dict = l === DEFAULT ? null : loadDict(l);
    const missing = new Set();
    const T = l === DEFAULT ? (s) => s : makeT(dict, missing);
    const jsOut = new Map();
    const jsName = (rel) => (l === DEFAULT ? rel : rel.replace(/(\.m?js)$/, `.${l}$1`));
    if (l !== DEFAULT) {
      for (const rel of jsFiles) {
        const src = JSSRC.get(rel);
        const ctx = { T, link: null };
        const keepKeys = (CFG.jsData || {})[rel];
        writeFileSync(join(OUT, jsName(rel)), (keepKeys && jsDataPass(src, keepKeys, T)) || jsPass(src, ctx));
        jsOut.set(rel, jsName(rel));
      }
    }
    for (const rel of htmlFiles) {
      const src = SRC.get(rel);
      const depth = rel.split('/').length - 1;
      const pageUrl = urlFor(rel);
      const ctx = {
        T,
        lang: CFG.htmlLang?.[l] || l,
        jsInline: l === DEFAULT ? null : (code) => jsPass(code, { T, link: null }),
        json: (body) => {
          if (l === DEFAULT) return body;
          const walkJ = (v) => {
            if (typeof v === 'string') {
              if (/^\/(?!\/)/.test(v) && !isAsset(v.split(/[?#]/)[0])) return `/${l}${v}`;
              if (/^(https?:|mailto:)/.test(v) || /^[\w.-]+@[\w.-]+$/.test(v)) return v;
              if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v)) return v; // slugs and codes, never copy
              return /<[a-z/][^>]*>/i.test(v) ? htmlPass(v, { T, link: null }) : T(v, 'json');
            }
            if (Array.isArray(v)) return v.map(walkJ);
            if (v && typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v)) o[k] = (CFG.jsonKeepKeys || []).includes(k) ? x : walkJ(x); return o; }
            return v;
          };
          return JSON.stringify(walkJ(JSON.parse(body))).replace(/</g, '\\u003c');
        },
        link(v, attr, tag) {
          if (l === DEFAULT) return v;
          if (attr === 'srcset' || attr === 'imagesrcset') return relMode ? v.split(',').map((p) => { const t = p.trim(); return /^(https?:|\/|data:)/.test(t) ? p : p.replace(t, '../' + t); }).join(',') : v;
          if (/^(https?:|mailto:|tel:|#|data:|javascript:|\/\/)/.test(v) || v === '') return v;
          const [pathPart, rest0 = ''] = v.split(/(?=[?#])/);
          // query values that are visible copy (config "translateQuery": ["country"]) follow the page language
          const rest = (CFG.translateQuery || []).length ? rest0.replace(/([?&])([^=&#]+)=([^&#]*)/g, (m, sep, k, val) => ((CFG.translateQuery || []).includes(k) ? `${sep}${k}=${encodeURIComponent(T(decodeURIComponent(val.replace(/\+/g, ' ')), 'query'))}` : m)) : rest0;
          if (v.startsWith('/')) {
            if (isAsset(pathPart) || (CFG.noLocale || []).some((p) => pathPart.startsWith(p))) return v;
            return `/${l}${pathPart === '/' ? '/' : pathPart}${rest}`;
          }
          // relative URL (sites without a build step): locale files live one directory deeper
          let target = pathPart;
          if (jsOut.has(target) && attr === 'src') target = jsOut.get(target);
          if (!PAGE_EXT.test(target) && !(CFG.relPages || []).includes(target)) return '../'.repeat(1) + target + rest;
          return target + rest;
        },
      };
      let out = htmlPass(src, ctx);
      // localized script bundles for absolute-path sites
      if (l !== DEFAULT) {
        for (const [from, to] of jsOut) out = out.split(`/${from}"`).join(`/${to}"`).split(`"${from}"`).join(`"${relMode ? to : to}"`);
      }
      // language selector
      const urlForLocale = (x) => (relMode ? (x === l ? rel.split('/').pop() : (x === DEFAULT ? '../' : (l === DEFAULT ? `${x}/` : `../${x}/`)) + rel) : locPath(x, pageUrl));
      out = out.replace(/<!--i18n:selector(?::([a-z-]+))?-->/g, (mm, variant) => selectorHtml(l, urlForLocale).replace('class="lang-switch"', `class="lang-switch${variant ? ' lang-switch--' + variant : ''}"`));
      // hreflang + canonical
      if (site && !(CFG.noAlternates || []).includes(rel)) {
        const abs = (x) => site + locPath(x, pageUrl);
        const alts = variants.map((x) => `<link rel="alternate" hreflang="${x}" href="${abs(x)}">`).join('\n') + `\n<link rel="alternate" hreflang="x-default" href="${abs(DEFAULT)}">`;
        out = out.replace(/<link rel="canonical"[^>]*>\n?/g, '');
        out = out.replace(/<\/head>/i, `<link rel="canonical" href="${abs(l)}">\n${alts}\n</head>`);
        if (l !== DEFAULT) out = out.replace(/(<meta property="og:url" content=")[^"]*"/, `$1${abs(l)}"`);
      }
      if (l !== DEFAULT) out = out.replace(/(<meta property="og:locale" content=")[^"]*"/, `$1${CFG.ogLocale?.[l] || l}"`);
      const dest = l === DEFAULT ? join(OUT, rel) : join(OUT, l, rel);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, out);
    }
    if (l !== DEFAULT) allMissing[l] = [...missing];
  }
  // sitemap
  const sm = join(OUT, 'sitemap.xml');
  if (existsSync(sm) && site) {
    let x = readFileSync(sm, 'utf8');
    const locs = [...x.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const extra = locs.flatMap((u) => LOCALES.map((l) => u.replace(site, site + '/' + l))).map((u) => `  <url><loc>${u}</loc></url>`).join('\n');
    if (!x.includes(`${site}/${LOCALES[0]}/`)) x = x.replace('</urlset>', extra + '\n</urlset>');
    writeFileSync(sm, x);
  }
  return allMissing;
}

function extract() {
  const files = walk(OUT);
  const seen = new Map();
  const add = (s, where, file) => { const k = norm(s); if (!k || !hasWords(k) || keep.has(k)) return s; if (!seen.has(k)) seen.set(k, { where, file }); return s; };
  for (const rel of files.filter((f) => PAGE_EXT.test(f) && !(CFG.skipPages || []).includes(f))) {
    const T = (s, w) => add(s, w, rel);
    const jsonX = (body) => { const w = (v) => { if (typeof v === 'string') { if (!/^(\/|https?:|mailto:)/.test(v) && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v)) T(v, 'json'); } else if (Array.isArray(v)) v.forEach(w); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!(CFG.jsonKeepKeys || []).includes(k)) w(x); }; w(JSON.parse(body)); return body; };
    htmlPass(readFileSync(join(OUT, rel), 'utf8'), { T, link: null, json: jsonX, jsInline: (c) => jsPass(c, { T }) });
  }
  for (const rel of expandJs(files)) {
    const T = (s, w) => add(s, w, rel);
    const src = readFileSync(join(OUT, rel), 'utf8');
    const keepKeys = (CFG.jsData || {})[rel];
    if (!(keepKeys && jsDataPass(src, keepKeys, T))) jsPass(src, { T });
  }
  const list = [...seen].map(([k, v]) => ({ en: k, where: v.where, file: v.file }));
  mkdirSync(join(ROOT, 'i18n'), { recursive: true });
  writeFileSync(join(ROOT, 'i18n/strings.json'), JSON.stringify(list, null, 1));
  console.log(`i18n: ${list.length} strings written to i18n/strings.json`);
}

if (mode === 'extract') extract();
else {
  for (const l of LOCALES) rmSync(join(OUT, l), { recursive: true, force: true });
  const missing = build();
  let total = 0;
  for (const [l, list] of Object.entries(missing)) {
    const shown = list.filter((x) => !/\u0000js$/.test(x));
    total += shown.length;
    if (shown.length) console.log(`i18n: ${l} is missing ${shown.length} translation(s), e.g. ${shown.slice(0, 3).map((x) => JSON.stringify(x.split('\u0000')[0])).join(', ')}`);
  }
  console.log(`i18n: built ${LOCALES.join(', ')} from ${CFG.out || 'dist'}/`);
  if (mode === 'check' && total) process.exit(1);
}
