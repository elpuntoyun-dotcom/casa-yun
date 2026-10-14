#!/usr/bin/env node
/**
 * Casa Yun static site builder — zero dependencies.
 *
 * Source of truth for editable content:  content/posts/<slug>.<lang>.md
 *   (2 posts x 6 languages: en, zh, zhHans, es, pt, ja)
 *
 * What this build does:
 *  1. Reads src/template.html (page skeleton with 4 placeholders).
 *  2. Injects the frozen first-paint HTML partials (src/partials/*.html).
 *     These are byte-verbatim copies from the original index.html — the
 *     hardcoded default-language text you see before JS runs. They are
 *     intentionally NOT regenerated from markdown (visual freeze).
 *  3. Regenerates the `translations` / `shopTranslations` JS objects'
 *     ppk- and kefir-related entries from the markdown files. This is the live
 *     six-language system that setLanguage() applies on every page load.
 *  4. Copies assets/, CNAME, sitemap.xml, Google verification file,
 *     and public/* (Decap CMS admin) into dist/.
 *
 * Contract for editors (Decap CMS or by hand):
 *  - Front matter fields map 1:1 to translation keys (see POSTS below).
 *  - Body blocks MUST keep the exact order and kind (paragraph / ## heading
 *    / ![alt](src) figure). Text may change freely; structure may not.
 *  - `**bold**` becomes <strong>bold</strong> (used by the kefir steps).
 *  - The build aborts if block count/kind mismatches the schema.
 *
 * Usage:  node scripts/build.mjs   (outputs to dist/)
 */

import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = ['en', 'zh', 'zhHans', 'es', 'pt', 'ja'];

// ---------------------------------------------------------------------------
// Content model: which markdown field / body block feeds which JS key.
// `obj` names the JS object holding the keys ('shop' = shopTranslations).
// ---------------------------------------------------------------------------
const POSTS = {
  'ppk-old-age': {
    fm: { title: 'ppkTitle', category: 'ppkCategory', excerpt: 'ppkExcerpt',
          back_label: 'ppkBack', date_display: 'ppkDate', read_label: 'ppkRead',
          hero_alt: 'ppkThumbAlt', photo_alt_1: 'ppkPhotoAlt1',
          featured_label: 'ppkFeaturedLabel', chapter_listing: 'ppkChapterListing',
          article_read: 'ppkArticleRead' },
    // body schema: [kind, jsKey] — kind: p | h2 | figure
    // figure alt text feeds the altKey; image src is structural (see partials).
    blocks: [
      ['p', 'ppkP1'], ['p', 'ppkP2'], ['p', 'ppkP3'], ['p', 'ppkP4'],
      ['p', 'ppkP5'], ['p', 'ppkP6'], ['p', 'ppkP7'], ['p', 'ppkP8'],
      ['figure', 'ppkPhotoAlt2'],
      ['p', 'ppkP9'], ['p', 'ppkP10'], ['p', 'ppkP11'],
    ],
  },
  'toward-the-goal': {
    fm: { title: 'goalTitle', category: 'goalCategory', excerpt: 'goalExcerpt',
          back_label: 'goalBack', date_display: 'goalDate', read_label: 'goalRead',
          hero_alt: 'goalHeroAlt', photo_alt_1: 'goalPhotoAlt1',
          featured_label: 'goalFeaturedLabel', article_read: 'goalArticleRead',
          chapter_listing: 'goalChapterListing' },
    blocks: [
      ['p', 'goalP1'], ['p', 'goalP2'], ['p', 'goalP3'], ['p', 'goalP4'], ['p', 'goalP5'],
      ['h2', 'goalH1'],
      ['p', 'goalP6'], ['p', 'goalP7'],
      ['h2', 'goalH2'],
      ['p', 'goalP8'], ['p', 'goalP9'], ['p', 'goalP10'],
      ['h2', 'goalH3'],
      ['p', 'goalP11'], ['p', 'goalP12'], ['p', 'goalP13'],
      ['figure', 'goalPhotoAlt1'],
      ['p', 'goalP14'],
    ],
  },
  'soul-scissors': {
    fm: { title: 'scisTitle', subtitle: 'scisSubtitle', category: 'scisCategory', excerpt: 'scisExcerpt',
          back_label: 'scisBack', date_display: 'scisDate', read_label: 'scisRead',
          hero_alt: 'scisHeroAlt', photo_alt_1: 'scisPhotoAlt1',
          featured_label: 'scisFeaturedLabel', article_read: 'scisArticleRead',
          chapter_listing: 'scisChapterListing' },
    blocks: [
      ['p', 'scisP1'], ['p', 'scisP2'], ['p', 'scisP3'], ['p', 'scisP4'],
      ['p', 'scisP5'], ['p', 'scisP6'], ['p', 'scisP7'], ['p', 'scisP8'],
      ['p', 'scisP9'], ['p', 'scisP10'], ['p', 'scisP11'], ['p', 'scisP12'],
      ['p', 'scisP13'],
      ['figure', 'scisPhotoAlt1'],
      ['p', 'scisP14'],
    ],
  },
  'away-from-the-house': {
    fm: { title: 'houseTitle', category: 'houseCategory', excerpt: 'houseExcerpt',
          back_label: 'houseBack', date_display: 'houseDate', read_label: 'houseRead',
          hero_alt: 'houseHeroAlt', photo_alt_1: 'housePhotoAlt1',
          featured_label: 'houseFeaturedLabel', article_read: 'houseArticleRead',
          chapter_listing: 'houseChapterListing' },
    blocks: [
      ['p', 'houseP1'], ['p', 'houseP2'], ['p', 'houseP3'], ['p', 'houseP4'],
      ['p', 'houseP5'], ['p', 'houseP6'], ['p', 'houseP7'], ['p', 'houseP8'],
      ['figure', 'housePhotoAlt1'],
      ['p', 'houseP9'], ['p', 'houseP10'], ['p', 'houseP11'], ['p', 'houseP12'],
    ],
  },
  'kefir': {
    fm: { title: 'kefirTitle', category: 'kefirCategory', excerpt: 'kefirExcerpt',
          back_label: 'kefirBack', date_display: 'kefirDate', read_label: 'kefirRead',
          hero_alt: 'kefirHeroAlt', spotlight_badge: 'spotlightBadge' },
    fmShop: { featured_label: 'kefirFeaturedLabel', article_read: 'kefirArticleRead' },
    blocks: [
      ['p', 'kefirP1'], ['p', 'kefirP2'], ['h2', 'kefirH1'],
      ['p', 'kefirP3'], ['p', 'kefirP4'], ['p', 'kefirP5'], ['p', 'kefirP6'], ['p', 'kefirP7'],
      ['figure', 'kefirPhotoAlt1'],
      ['h2', 'kefirH2'], ['p', 'kefirP8'],
      ['figure', 'kefirPhotoAlt4'],
      ['p', 'kefirStep1'], ['p', 'kefirStep2'],
      ['figure', 'kefirPhotoAlt3'],
      ['p', 'kefirStep3'],
      ['figure', 'kefirPhotoAlt2'],
      ['p', 'kefirStep4'],
      ['p', 'kefirP9'], ['h2', 'kefirH3'],
      ['p', 'kefirP10'], ['p', 'kefirP11'], ['p', 'kefirP12'], ['p', 'kefirP13'], ['p', 'kefirP14'],
    ],
  },
};

// ---------------------------------------------------------------------------
// Markdown parsing (minimal, no dependencies)
// ---------------------------------------------------------------------------
function parseFrontMatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) throw new Error('missing front matter');
  const fm = {};
  for (const line of m[1].split('\n')) {
    const km = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!km) continue;
    let v = km[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) {
      v = v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
    fm[km[1]] = v;
  }
  return { fm, body: text.slice(m[0].length) };
}

function parseBodyBlocks(body) {
  // Split on blank lines; classify each block.
  const raw = body.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  return raw.map(chunk => {
    const oneLine = chunk.replace(/\s*\n\s*/g, ' ');
    if (oneLine.startsWith('## ')) return { kind: 'h2', text: oneLine.slice(3).trim() };
    const img = oneLine.match(/^!\[(.*)\]\((.*)\)$/);
    if (img) return { kind: 'figure', alt: img[1], src: img[2] };
    return { kind: 'p', text: oneLine };
  });
}

// **bold** -> <strong>bold</strong>  (inline only; values stay single-line)
function renderInline(md) {
  return md.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

// Escape a value for embedding in a double-quoted JS string.
function jsEscape(s) {
  if (s.includes('\n')) throw new Error('multi-line value not allowed in JS translations: ' + s.slice(0, 40));
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// ---------------------------------------------------------------------------
// Load all posts -> { slug: { lang: { jsKey: value } } }  (+ shop keys)
// ---------------------------------------------------------------------------
function loadPosts() {
  const out = {};
  for (const [slug, post] of Object.entries(POSTS)) {
    out[slug] = {};
    for (const lang of LANGS) {
      const file = join(ROOT, 'content', 'posts', `${slug}.${lang}.md`);
      if (!existsSync(file)) throw new Error('missing post file: ' + file);
      const { fm, body } = parseFrontMatter(readFileSync(file, 'utf8'));
      if (fm.slug !== slug || fm.lang !== lang) {
        throw new Error(`front matter mismatch in ${file}: slug=${fm.slug} lang=${fm.lang}`);
      }
      const values = {};
      for (const [field, key] of Object.entries(post.fm)) {
        if (!(field in fm)) throw new Error(`missing front matter field "${field}" in ${file}`);
        values[key] = fm[field];
      }
      if (post.fmShop) {
        values.__shop = {};
        for (const [field, key] of Object.entries(post.fmShop)) {
          if (!(field in fm)) throw new Error(`missing front matter field "${field}" in ${file}`);
          values.__shop[key] = fm[field];
        }
      }
      const blocks = parseBodyBlocks(body);
      if (blocks.length !== post.blocks.length) {
        throw new Error(`${file}: expected ${post.blocks.length} body blocks, found ${blocks.length}`);
      }
      blocks.forEach((b, i) => {
        const [kind, key] = post.blocks[i];
        if (b.kind !== kind) {
          throw new Error(`${file}: block ${i + 1} should be ${kind}, found ${b.kind}`);
        }
        values[key] = kind === 'figure' ? b.alt : renderInline(b.text);
      });
      out[slug][lang] = values;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// String-aware scanners for the JS translation objects.
// ---------------------------------------------------------------------------
function findMatchingBrace(text, openIdx) {
  // openIdx points at '{'; returns index of the matching '}'.
  let depth = 0, inStr = false, esc = false;
  for (let j = openIdx; j < text.length; j++) {
    const c = text[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else {
      if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) return j;
      }
    }
  }
  throw new Error('no matching brace');
}

// Replace one key's value inside a single language block (string-aware).
function replaceJsValue(block, key, newValue) {
  const needle = key + ':"';
  const idx = block.indexOf(needle);
  if (idx === -1) throw new Error('JS key not found in block: ' + key);
  if (block.indexOf(needle, idx + 1) !== -1) {
    throw new Error('JS key appears more than once in block, refusing: ' + key);
  }
  let j = idx + needle.length;
  let esc = false;
  while (j < block.length) {
    const c = block[j];
    if (esc) esc = false;
    else if (c === '\\') esc = true;
    else if (c === '"') break;
    j++;
  }
  if (j >= block.length) throw new Error('unterminated JS string for key: ' + key);
  return block.slice(0, idx + needle.length) + jsEscape(newValue) + block.slice(j);
}

// Apply {key: value} replacements scoped to varName's `lang` block.
function replaceInLangBlock(html, varName, lang, replacements) {
  const vIdx = html.indexOf('var ' + varName + ' = {');
  if (vIdx === -1) throw new Error('JS object not found: ' + varName);
  const objOpen = html.indexOf('{', vIdx);
  const objClose = findMatchingBrace(html, objOpen);
  const langNeedle = '        ' + lang + ': {';
  const lIdx = html.indexOf(langNeedle, objOpen);
  if (lIdx === -1 || lIdx > objClose) throw new Error('language block not found: ' + varName + '.' + lang);
  const blkOpen = html.indexOf('{', lIdx);
  const blkClose = findMatchingBrace(html, blkOpen);
  let block = html.slice(blkOpen, blkClose + 1);
  for (const [key, value] of Object.entries(replacements)) {
    block = replaceJsValue(block, key, value);
  }
  return html.slice(0, blkOpen) + block + html.slice(blkClose + 1);
}

// Template loading: prefers src/template.html (single file); falls back to
// src/template.part1.html..N (concatenated byte-exact) for environments
// where the single 300KB file cannot be uploaded (e.g. API size limits).
function loadTemplate() {
  const single = join(ROOT, 'src', 'template.html');
  if (existsSync(single)) return readFileSync(single, 'utf8');
  let html = '';
  for (let i = 1; ; i++) {
    const part = join(ROOT, 'src', `template.part${i}.html`);
    if (!existsSync(part)) break;
    html += readFileSync(part, 'utf8');
  }
  if (!html) throw new Error('src/template.html (or template.part*.html) not found');
  return html;
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------
function main() {
  const posts = loadPosts();
  let html = loadTemplate();

  // 1. Inject frozen first-paint partials (byte-verbatim).
  const partials = {
    '<!--@CARD:soul-scissors-->': 'card-soul-scissors.html',
    '<!--@CARD:away-from-the-house-->': 'card-away-from-the-house.html',
    '<!--@CARD:toward-the-goal-->': 'card-toward-the-goal.html',
    '<!--@CARD:kefir-->': 'card-kefir.html',
    '<!--@CARD:ppk-->': 'card-ppk.html',
    '<!--@ARTICLE:ppk-->': 'article-ppk.html',
    '<!--@ARTICLE:toward-the-goal-->': 'article-toward-the-goal.html',
    '<!--@ARTICLE:soul-scissors-->': 'article-soul-scissors.html',
    '<!--@ARTICLE:away-from-the-house-->': 'article-away-from-the-house.html',
    '<!--@ARTICLE:kefir-->': 'article-kefir.html',
  };
  for (const [ph, file] of Object.entries(partials)) {
    // Replace the whole placeholder line (indent included) with the
    // verbatim partial, so indentation stays byte-identical.
    const lineRe = new RegExp('^[ \\t]*' + ph.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[ \\t]*$', 'm');
    if (!lineRe.test(html)) throw new Error('placeholder missing in template: ' + ph);
    html = html.replace(lineRe, () => readFileSync(join(ROOT, 'src', 'partials', file), 'utf8').replace(/\n$/, ''));
  }

  // 2. Regenerate translation values from markdown, scoped per language
  //    block so formatting elsewhere is untouched.
  for (const lang of LANGS) {
    const mainReplacements = {};
    const shopReplacements = {};
    for (const [slug, post] of Object.entries(POSTS)) {
      const values = posts[slug][lang];
      for (const [key, value] of Object.entries(values)) {
        if (key === '__shop') continue;
        mainReplacements[key] = value;
      }
      if (values.__shop) Object.assign(shopReplacements, values.__shop);
    }
    html = replaceInLangBlock(html, 'translations', lang, mainReplacements);
    if (Object.keys(shopReplacements).length) {
      html = replaceInLangBlock(html, 'shopTranslations', lang, shopReplacements);
    }
  }

  // 3. Chapters-list straggler: hardcoded ppkChapterListing span (default zh).
  {
    const zhListing = posts['soul-scissors']['zh']['scisChapterListing'];
    const re = /(<span class="empty-note article-available" data-i18n="scisChapterListing">)[^<]*(<\/span>)/;
    if (!re.test(html)) throw new Error('ppkChapterListing span not found');
    html = html.replace(re, `$1${zhListing}$2`);
  }

  // 4. Emit dist/.
  const dist = join(ROOT, 'dist');
  mkdirSync(dist, { recursive: true });
  writeFileSync(join(dist, 'index.html'), html);

  // 图片来源:仓库根目录(通过 GitHub 网页上传的图片在此)与 assets/
  // (Decap CMS 后台上传的图片在此)。两者合并进 dist/assets/,
  // 站内所有 assets/xxx 引用保持不变。
  const distAssets = join(dist, 'assets');
  mkdirSync(distAssets, { recursive: true });
  const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.ico']);
  const copyImagesFrom = (dir) => {
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir)) {
      const sp = join(dir, f);
      if (!statSync(sp).isFile()) continue;
      // .webp.b64: base64-encoded image for text-only transports (e.g. CMS/API);
      // decode to dist/assets/<name>.webp
      if (f.toLowerCase().endsWith('.b64')) {
        const outName = f.slice(0, -4);
        if (!IMAGE_EXT.has(extname(outName).toLowerCase())) continue;
        writeFileSync(join(distAssets, outName), Buffer.from(readFileSync(sp, 'utf8'), 'base64'));
        continue;
      }
      if (!IMAGE_EXT.has(extname(f).toLowerCase())) continue;
      cpSync(sp, join(distAssets, f));
    }
  };
  copyImagesFrom(ROOT);              // GitHub 网页上传的:仓库根目录
  copyImagesFrom(join(ROOT, 'assets')); // Decap CMS 上传的:assets/ (如存在则覆盖同名)
  for (const f of ['CNAME', 'sitemap.xml', 'google5a7cc2f81f0923ed.html']) {
    const p = join(ROOT, f);
    if (existsSync(p)) cpSync(p, join(dist, f));
  }
  const pub = join(ROOT, 'public');
  if (existsSync(pub)) {
    for (const f of readdirSync(pub, { recursive: true })) {
      const sp = join(pub, f);
      const dp = join(dist, f);
      mkdirSync(dirname(dp), { recursive: true });
      cpSync(sp, dp, { recursive: true });
    }
  }
  // Decap CMS 有时从站点根目录请求 /config.yml(忽略 base 标签),
  // 在根目录也放一份,确保两种路径都能找到。
  const adminCfg = join(dist, 'admin', 'config.yml');
  if (existsSync(adminCfg)) cpSync(adminCfg, join(dist, 'config.yml'));
  console.log('built dist/index.html (%d bytes)', Buffer.byteLength(html));
}

main();
