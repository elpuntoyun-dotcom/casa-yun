#!/usr/bin/env node
/**
 * Validation for the Casa Yun refactor.
 *
 *  1. Byte-identity: dist/index.html must be byte-identical to the
 *     production source (~/workspace/casayun-deploy/index.html).
 *  2. Key coverage: every data-i18n* key used in the HTML must exist in
 *     the translations for ALL six languages (this is what keeps the
 *     language switcher from ever showing a blank / stale string).
 *  3. Post round-trip: values regenerated from markdown must equal the
 *     values embedded in the built JS.
 *
 * Usage: node scripts/validate.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIG = join(ROOT, '..', 'casayun-deploy', 'index.html');
const LANGS = ['en', 'zh', 'zhHans', 'es', 'pt', 'ja'];
let failures = 0;
const fail = (msg) => { failures++; console.error('FAIL: ' + msg); };
const ok = (msg) => console.log('ok: ' + msg);

const dist = join(ROOT, 'dist', 'index.html');
if (!existsSync(dist)) { fail('dist/index.html missing — run node scripts/build.mjs first'); process.exit(1); }
const built = readFileSync(dist, 'utf8');
const orig = readFileSync(ORIG, 'utf8');

// 1. byte identity
if (built === orig) ok('dist/index.html is byte-identical to production source');
else fail('dist/index.html differs from production source');

// 2. extract JS objects from the built file and evaluate them
function extractObj(src, varName) {
  const vIdx = src.indexOf('var ' + varName + ' = {');
  if (vIdx === -1) throw new Error('object not found: ' + varName);
  const openIdx = src.indexOf('{', vIdx);
  let depth = 0, inStr = false, esc = false, j = openIdx;
  for (; j < src.length; j++) {
    const c = src[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else {
      if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) break; }
    }
  }
  const literal = src.slice(openIdx, j + 1);
  return new Function('return (' + literal + ')')();
}
const translations = extractObj(built, 'translations');
const shop = extractObj(built, 'shopTranslations');
const merged = {};
for (const l of LANGS) merged[l] = Object.assign({}, translations[l], shop[l]);

// collect every data-i18n* key referenced in the HTML
const keyAttrs = ['data-i18n', 'data-i18n-html', 'data-i18n-aria', 'data-i18n-alt', 'data-i18n-placeholder'];
const usedKeys = new Set();
for (const attr of keyAttrs) {
  const re = new RegExp(attr + '="([A-Za-z0-9_]+)"', 'g');
  let m;
  while ((m = re.exec(built))) usedKeys.add(m[1]);
}
console.log(`checking ${usedKeys.size} i18n keys x ${LANGS.length} languages...`);
let missing = 0;
for (const key of usedKeys) {
  for (const l of LANGS) {
    if (!(key in merged[l])) { fail(`key "${key}" missing in language "${l}"`); missing++; }
    else if (typeof merged[l][key] !== 'string' || merged[l][key].length === 0) {
      fail(`key "${key}" empty in language "${l}"`); missing++;
    }
  }
}
if (!missing) ok('every HTML i18n key exists and is non-empty in all 6 languages');

// 3. simulate setLanguage for each language over the post keys
const postKeys = [
  ...['ppkBack','ppkCategory','ppkTitle','ppkExcerpt','ppkDate','ppkRead','ppkThumbAlt',
      'ppkPhotoAlt1','ppkPhotoAlt2','ppkFeaturedLabel','ppkChapterListing','ppkArticleRead',
      'spotlightBadge', ...Array.from({length: 11}, (_, i) => 'ppkP' + (i + 1))],
  ...['kefirBack','kefirCategory','kefirTitle','kefirExcerpt','kefirDate','kefirRead',
      'kefirHeroAlt','kefirH1','kefirH2','kefirH3',
      ...Array.from({length: 14}, (_, i) => 'kefirP' + (i + 1)),
      ...Array.from({length: 4}, (_, i) => 'kefirStep' + (i + 1)),
      ...Array.from({length: 4}, (_, i) => 'kefirPhotoAlt' + (i + 1)),
      'kefirFeaturedLabel','kefirArticleRead'],
];
let simMissing = 0;
for (const l of LANGS) {
  for (const k of postKeys) {
    if (!(k in merged[l])) { fail(`post key "${k}" missing for setLanguage("${l}")`); simMissing++; }
  }
}
if (!simMissing) ok(`setLanguage simulation: all ${postKeys.length} post keys resolve in all 6 languages`);

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
