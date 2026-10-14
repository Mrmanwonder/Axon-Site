import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const policy = readFileSync('public/_headers', 'utf8').match(/Content-Security-Policy: (.+)/)[1];
const netlify = readFileSync('netlify.toml', 'utf8').match(/Content-Security-Policy = "([^"]+)"/)[1];
if (policy !== netlify) throw new Error('Deployment CSP policies differ');
const scripts = policy.match(/script-src ([^;]+)/)[1];
if (scripts.includes("'unsafe-inline'")) throw new Error('Inline script execution must be hash-authorized');
for (const file of ['index.html', 'dist/index.html', 'dist/share/index.html']) {
  const html = readFileSync(file, 'utf8');
  for (const [, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc=/.test(attrs)) continue;
    const hash = createHash('sha256').update(body).digest('base64');
    if (!scripts.includes(`'sha256-${hash}'`)) throw new Error(`CSP does not authorize the boot script in ${file}`);
  }
}
console.log('Script CSP: matched deployment headers; source and generated boot scripts authorized by hash.');
