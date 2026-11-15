// The release gate. Must print OK. Checks content/, site.json and the built site/.
// Cut down by factory@AgentiCCells.dinis on 2026-11-15 from build/validate.js in
// AgentiCCells__Website (Apache-2.0): checks specific to that site (its domain,
// pricing data, hub.json) are removed; CNAME is optional (the template has none).
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const fail = (m) => errors.push(m);

function walk(dir, ext) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p, ext) : (!ext || ext.some((e) => n.endsWith(e)) ? [p] : []);
  });
}
const rel = (p) => p.slice(root.length + 1);
const text = ['.md', '.json', '.html', '.css', '.js', '.mjs', '.yml'];
const scanned = [...walk(join(root, 'content'), text), ...walk(join(root, 'site'), text), ...walk(join(root, 'assets'), text), join(root, 'site.json')].filter(existsSync);

if (!existsSync(join(root, 'site/index.html'))) fail('site/index.html missing: run the build first');

// CNAME is optional. When present it holds one lowercase domain.
const cname = existsSync(join(root, 'CNAME')) ? readFileSync(join(root, 'CNAME'), 'utf8').trim() : '';
if (existsSync(join(root, 'CNAME')) && !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(cname)) fail('CNAME: must hold one lowercase domain');

// site.json: name and description; contact empty or an email address.
try {
  const c = JSON.parse(readFileSync(join(root, 'site.json'), 'utf8'));
  for (const k of ['name', 'description']) if (typeof c[k] !== 'string' || !c[k].trim()) fail(`site.json: ${k} must be a non-empty string`);
  if (c.contact !== undefined && c.contact !== '' && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(c.contact)) fail('site.json: contact must be empty or an email address');
} catch (e) { fail(`site.json: ${e.message}`); }

const keyShapes = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}/,
  /\bgithub_pat_[A-Za-z0-9_]{30,}/,
  /\bsk-[A-Za-z0-9_-]{20,}/,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/,
  /\b[A-Fa-f0-9]{40,}\b/,
  /\b[A-Za-z0-9+\/]{40,}={0,2}(?![A-Za-z0-9+\/])/,
];
for (const f of scanned) {
  const t = readFileSync(f, 'utf8');
  if (t.includes('—')) fail(`${rel(f)}: em dash found`);
  for (const re of keyShapes) if (re.test(t)) fail(`${rel(f)}: key-shaped string (${re.source.slice(0, 20)}...)`);
  if (/\.(md|html)$/.test(f) || f.endsWith('.json')) {
    t.split('\n').forEach((line, i) => {
      if (/[£$€]\s?\d/.test(line) && !/first proposal/i.test(line)) fail(`${rel(f)}:${i + 1}: price not marked "first proposal"`);
    });
  }
}

for (const f of walk(join(root, 'content'), ['.md'])) {
  const m = readFileSync(f, 'utf8').match(/^---\n([\s\S]*?)\n---/);
  const fm = m ? m[1] : '';
  if (!/^title:\s*\S/m.test(fm)) fail(`${rel(f)}: no title`);
  if (!/^description:\s*\S/m.test(fm)) fail(`${rel(f)}: no description`);
}
for (const f of walk(join(root, 'site'), ['.html'])) {
  const t = readFileSync(f, 'utf8');
  if (!/<title>[^<]+<\/title>/.test(t)) fail(`${rel(f)}: empty title`);
  if (!/<meta name="description" content="[^"]+"/.test(t)) fail(`${rel(f)}: empty description`);
  for (const m of t.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const u = m[1];
    if (/^(https?:|mailto:|#)/.test(u)) continue;
    const path = u.split('#')[0].split('?')[0];
    if (!path) continue;
    let target = path.startsWith('/') ? join(root, 'site', path) : resolve(dirname(f), path);
    if (existsSync(target) && statSync(target).isDirectory()) target = join(target, 'index.html');
    if (!existsSync(target)) fail(`${rel(f)}: broken link ${u}`);
  }
}

// No page loads a script or stylesheet from another host.
const ownHosts = new Set(cname ? [cname, `www.${cname}`] : []);
const foreign = (u) => {
  const m = u.trim().match(/^(?:[a-z][a-z0-9+.-]*:)?\/\/([^/?#:]+)/i);
  if (m) return !ownHosts.has(m[1].toLowerCase());
  return /^[a-z][a-z0-9+.-]*:/i.test(u.trim());
};
for (const f of walk(join(root, 'site'), ['.html'])) {
  const t = readFileSync(f, 'utf8');
  for (const m of t.matchAll(/<script\b[^>]*>/gi)) {
    const src = m[0].match(/\ssrc\s*=\s*["']?([^"'\s>]+)/i);
    if (src && foreign(src[1])) fail(`${rel(f)}: script from another host: ${src[1]}`);
  }
  for (const m of t.matchAll(/<link\b[^>]*>/gi)) {
    const relAttr = (m[0].match(/\srel\s*=\s*["']?([^"'>]+)/i) || [])[1] || '';
    if (!/\b(stylesheet|preload|modulepreload)\b/i.test(relAttr)) continue;
    const href = m[0].match(/\shref\s*=\s*["']?([^"'\s>]+)/i);
    if (href && foreign(href[1])) fail(`${rel(f)}: ${relAttr.trim()} from another host: ${href[1]}`);
  }
}
for (const f of walk(join(root, 'site'), ['.css', '.html'])) {
  const t = readFileSync(f, 'utf8');
  for (const m of t.matchAll(/@import\s+(?:url\()?\s*["']?([^"')\s;]+)/gi)) if (foreign(m[1])) fail(`${rel(f)}: @import from another host: ${m[1]}`);
}

// Wording: no hype words in content/ or in the built pages.
const hype = /\b(revolutionary|cutting[- ]edge|seamless(?:ly)?|world[- ]class|game[- ]changing)\b/gi;
for (const f of [...walk(join(root, 'content'), ['.md']), ...walk(join(root, 'site'), ['.html'])]) {
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    for (const m of line.matchAll(hype)) fail(`${rel(f)}:${i + 1}: hype word "${m[1]}"`);
  });
}

// Basics: 404, favicon and Open Graph always; canonical, sitemap and robots when the site has a domain.
for (const f of ['site/404.html', 'site/assets/favicon.svg', 'site/version.json']) if (!existsSync(join(root, f))) fail(`${f} missing`);
const sitemap = existsSync(join(root, 'site/sitemap.xml')) ? readFileSync(join(root, 'site/sitemap.xml'), 'utf8') : '';
if (cname) {
  for (const f of ['site/robots.txt', 'site/sitemap.xml', 'site/CNAME']) if (!existsSync(join(root, f))) fail(`${f} missing`);
  if (existsSync(join(root, 'site/robots.txt')) && !readFileSync(join(root, 'site/robots.txt'), 'utf8').includes(`Sitemap: https://${cname}/sitemap.xml`)) fail('site/robots.txt: Sitemap line missing or wrong host');
}
for (const f of walk(join(root, 'site'), ['.html'])) {
  const t = readFileSync(f, 'utf8');
  for (const k of ['og:title', 'og:description']) if (!t.includes(`property="${k}"`)) fail(`${rel(f)}: no ${k}`);
  if (!cname || /<meta name="robots" content="noindex">/.test(t)) continue;
  const url = '/' + rel(f).slice('site/'.length).replace(/(^|\/)index\.html$/, '$1');
  if (!t.includes(`<link rel="canonical" href="https://${cname}${url}">`)) fail(`${rel(f)}: canonical missing or wrong (want https://${cname}${url})`);
  if (!sitemap.includes(`<loc>https://${cname}${url}</loc>`)) fail(`${rel(f)}: not in sitemap.xml`);
}

if (errors.length) { console.error(errors.join('\n')); console.error(`FAILED (${errors.length})`); process.exit(1); }
console.log(`OK${cname ? ` (${cname})` : ' (no CNAME: template mode)'}`);
