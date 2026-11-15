// Turns content/ into site/. Node only, no dependencies.
// Cut down by factory@AgentiCCells.dinis on 2026-11-15 from build/build.mjs in
// AgentiCCells__Website (Apache-2.0): the site-specific parts (pricing ladder,
// stack table, flow diagram, hero, fixed contact) are removed; the site's name,
// description and contact come from site.json.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'site');
// Set by CI only (see .github/workflows/pages.yml); local builds say 'local'.
const version = process.env.SITE_VERSION || 'local';
const config = JSON.parse(readFileSync(join(root, 'site.json'), 'utf8'));
const siteName = config.name || '';
const contact = config.contact || '';

// The site's address comes from CNAME, so a domain change needs no edit here.
// No CNAME (the template itself): no canonical links, no sitemap, no deploy.
const origin = existsSync(join(root, 'CNAME')) ? `https://${readFileSync(join(root, 'CNAME'), 'utf8').trim()}` : '';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function frontMatter(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: src };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: m[2] };
}

function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function markdown(body) {
  const html = [];
  let para = [], list = [], olist = [];
  const flush = () => {
    if (para.length) html.push(`<p>${inline(para.join(' '))}</p>`);
    if (olist.length) html.push(`<ol>${olist.map((l) => `<li>${inline(l)}</li>`).join('')}</ol>`);
    if (list.length) html.push(`<ul>${list.map((l) => `<li>${inline(l)}</li>`).join('')}</ul>`);
    para = []; list = []; olist = [];
  };
  for (const line of body.split('\n')) {
    let m;
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { flush(); html.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); }
    else if ((m = line.match(/^[-*]\s+(.*)$/))) { if (para.length || olist.length) flush(); list.push(m[1]); }
    else if ((m = line.match(/^\d+\.\s+(.*)$/))) { if (para.length || list.length) flush(); olist.push(m[1]); }
    else if (line.trim() === '') flush();
    else { if (list.length || olist.length) flush(); para.push(line.trim()); }
  }
  flush();
  return html.join('\n');
}

function navHtml(nav, current) {
  if (!nav.length) return '';
  const items = nav.map((n) => n.url === current
    ? `<li><a href="${esc(n.url)}" aria-current="page">${esc(n.title)}</a></li>`
    : `<li><a href="${esc(n.url)}">${esc(n.title)}</a></li>`).join('');
  return `<nav aria-label="Site"><ul>${items}</ul></nav>`;
}

function page(meta, content, nav = [], current = '') {
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(meta.title || '')}</title>
<meta name="description" content="${esc(meta.description || '')}">
<link rel="stylesheet" href="/assets/style.css">
<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
${meta.noindex ? '<meta name="robots" content="noindex">\n' : ''}${origin && !meta.noindex ? `<link rel="canonical" href="${esc(origin + current)}">\n` : ''}<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(siteName)}">
<meta property="og:title" content="${esc(meta.title || '')}">
<meta property="og:description" content="${esc(meta.description || '')}">
${origin ? `<meta property="og:url" content="${esc(origin + current)}">\n` : ''}<meta name="twitter:card" content="summary">
</head>
<body>
<header><a class="brand" href="/">${esc(siteName)}</a>${navHtml(nav, current)}</header>
<main>
${content}
</main>
<footer>${contact ? `<p>Contact: <a href="mailto:${esc(contact)}">${esc(contact)}</a></p>` : ''}<p>Code under Apache-2.0. Text and images under CC BY 4.0.</p><p class="version">Version ${esc(version)}</p></footer>
</body>
</html>
`;
}

// A site path such as "/" or "/about/" becomes a file under site/. A path that would leave site/ is refused.
function fileFor(path) {
  if (typeof path !== 'string' || !path.startsWith('/')) throw new Error(`page path must start with "/": ${path}`);
  let f = path.slice(1);
  if (f === '' || f.endsWith('/')) f += 'index.html';
  else if (!f.endsWith('.html')) f += '/index.html';
  if (f.split(/[\\/]/).some((part) => part === '..' || part === '.')) throw new Error(`page path leaves site/: ${path}`);
  return normalize(f);
}
const urlFor = (file) => '/' + file.replace(/(^|\/)index\.html$/, '$1');

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'assets'), { recursive: true });

const pages = [];
for (const f of readdirSync(join(root, 'content')).filter((f) => f.endsWith('.md')).sort()) {
  const { meta, body } = frontMatter(readFileSync(join(root, 'content', f), 'utf8'));
  const path = f === 'index.md' ? '/' : `/${f.replace(/\.md$/, '')}/`;
  pages.push({ path, title: meta.title, description: meta.description, nav: meta.nav, html: markdown(body), source: `content/${f}` });
}

// Page hooks: build/pages/*.mjs, each `export default async function (ctx)` returning
// [{ path, title, description, html, nav? }]. Each page gets the same template, nav and footer.
const hookDir = join(root, 'build', 'pages');
const ctx = { root, out, version, contact, esc, inline, markdown, frontMatter, pages: pages.map(({ path, title }) => ({ path, title })), files: [] };
if (existsSync(hookDir)) {
  for (const f of readdirSync(hookDir).filter((f) => f.endsWith('.mjs')).sort()) {
    const mod = await import(pathToFileURL(join(hookDir, f)).href);
    if (typeof mod.default !== 'function') throw new Error(`build/pages/${f}: no default export function`);
    const got = await mod.default(ctx);
    if (!Array.isArray(got)) throw new Error(`build/pages/${f}: must return an array of pages`);
    for (const p of got) {
      for (const k of ['path', 'title', 'description', 'html']) {
        if (typeof p?.[k] !== 'string') throw new Error(`build/pages/${f}: page ${p?.path ?? '?'} has no ${k}`);
      }
      pages.push({ ...p, source: `build/pages/${f}` });
    }
  }
}

const seen = new Map();
for (const p of pages) {
  p.file = fileFor(p.path);
  if (seen.has(p.file)) throw new Error(`${p.source} and ${seen.get(p.file)} both write ${p.path}`);
  seen.set(p.file, p.source);
}
const nav = pages
  .filter((p) => p.nav !== undefined && p.nav !== '' && Number.isFinite(Number(p.nav)))
  .sort((a, b) => Number(a.nav) - Number(b.nav) || String(a.title).localeCompare(String(b.title)))
  .map((p) => ({ url: urlFor(p.file), title: p.title }));

if (!seen.has('404.html')) pages.push({
  path: '/404.html', file: '404.html', title: 'Page not found', noindex: true,
  description: 'This page does not exist. Use the menu or go back to the home page.',
  html: '<h1>Page not found</h1>\n<p>There is nothing at this address. Try the menu above, or go to the <a href="/">home page</a>.</p>',
});

for (const p of pages) {
  mkdirSync(dirname(join(out, p.file)), { recursive: true });
  writeFileSync(join(out, p.file), page(p, p.html, nav, urlFor(p.file)));
}
for (const f of readdirSync(join(root, 'assets'))) copyFileSync(join(root, 'assets', f), join(out, 'assets', f));
if (existsSync(join(root, 'CNAME'))) copyFileSync(join(root, 'CNAME'), join(out, 'CNAME'));
for (const { path, content } of ctx.files) {
  const file = normalize(String(path).replace(/^\/+/, ''));
  if (file.split(/[\\/]/).some((part) => part === '..' || part === '.')) throw new Error(`hook file leaves site/: ${path}`);
  mkdirSync(dirname(join(out, file)), { recursive: true });
  writeFileSync(join(out, file), content);
}
const indexable = pages.filter((p) => !p.noindex).map((p) => urlFor(p.file)).sort();
if (origin) {
  writeFileSync(join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexable.map((u) => `<url><loc>${esc(origin + u)}</loc></url>`).join('\n')}\n</urlset>\n`);
  writeFileSync(join(out, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`);
}
writeFileSync(join(out, 'version.json'), JSON.stringify({ version }) + '\n');
console.log(`built site/ (${version}, ${pages.length} pages${origin ? ', ' + origin : ', no CNAME'})`);
