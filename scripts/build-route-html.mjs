import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// The SPA sets these on navigation, but bots and link previews also read the
// initial document before JavaScript. Keep both copies sourced from one file.
const dist = process.argv[2] || 'dist';
const base = await readFile(join(dist, 'index.html'), 'utf8');
const legal = JSON.parse(await readFile('src/ui/pages/publicMetadata.json', 'utf8'));
const routes = [
  ...Object.values(legal),
  {
    path: '/share',
    title: 'Shared study item | Axon',
    description: 'A private read-only Axon share.',
    noIndex: true,
  },
];

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

function replaceOne(html, pattern, replacement) {
  const matches = [...html.matchAll(new RegExp(pattern.source, pattern.flags + 'g'))];
  if (matches.length !== 1) throw new Error(`Expected one head tag for ${pattern}, got ${matches.length}`);
  return html.replace(pattern, replacement);
}

for (const route of routes) {
  const canonical = `https://axonstudy.online${route.path}`;
  const tags = [
    [/\<title\>[^<]*\<\/title\>/, `<title>${escapeHtml(route.title)}</title>`],
    [/\<meta name="description" content="[^"]*"\>/, `<meta name="description" content="${escapeHtml(route.description)}">`],
    [/\<meta name="robots" content="[^"]*"\>/, `<meta name="robots" content="${route.noIndex ? 'noindex, nofollow' : 'index, follow'}">`],
    [/\<meta property="og:title" content="[^"]*"\>/, `<meta property="og:title" content="${escapeHtml(route.title)}">`],
    [/\<meta property="og:description" content="[^"]*"\>/, `<meta property="og:description" content="${escapeHtml(route.description)}">`],
    [/\<meta property="og:url" content="[^"]*"\>/, `<meta property="og:url" content="${canonical}">`],
    [/\<meta name="twitter:title" content="[^"]*"\>/, `<meta name="twitter:title" content="${escapeHtml(route.title)}">`],
    [/\<meta name="twitter:description" content="[^"]*"\>/, `<meta name="twitter:description" content="${escapeHtml(route.description)}">`],
    [/\<link rel="canonical" href="[^"]*"\>/, `<link rel="canonical" href="${canonical}">`],
  ];
  let html = base;
  for (const [pattern, replacement] of tags) html = replaceOne(html, pattern, replacement);
  const directory = join(dist, route.path.slice(1));
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'index.html'), html);
}
