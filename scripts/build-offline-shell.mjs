import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8'));
const files = new Set(['/index.html']);
function include(key) {
  const entry = manifest[key];
  if (!entry || files.has('/' + entry.file)) return;
  files.add('/' + entry.file);
  for (const css of entry.css ?? []) files.add('/' + css);
  for (const imported of entry.imports ?? []) include(imported);
}
for (const [key, entry] of Object.entries(manifest)) if (entry.isEntry) include(key);
for (const font of await readdir('dist/fonts')) files.add('/fonts/' + font);
const version = createHash('sha256').update(JSON.stringify([...files])).digest('hex').slice(0, 16);
await writeFile('dist/sw.js', `
const CACHE = 'axon-shell-${version}';
const SHELL = ${JSON.stringify([...files])};
self.addEventListener('install', event => event.waitUntil((async () => {
  await caches.open(CACHE).then(cache => cache.addAll(SHELL));
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith('axon-shell-') && key !== CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Query results remain in LocalDataService. Never retain APIs or signed URLs.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.open(CACHE).then(cache => cache.match('/index.html'))));
  } else if (!url.search && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/fonts/'))) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(url.pathname);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })());
  }
});
`);
