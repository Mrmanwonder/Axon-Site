import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parse } from 'parse5';
const policy = readFileSync('public/_headers', 'utf8').match(/Content-Security-Policy: (.+)/)[1];
const netlify = readFileSync('netlify.toml', 'utf8').match(/Content-Security-Policy = "([^"]+)"/)[1];
if (policy !== netlify) throw new Error('Deployment CSP policies differ');
const scripts = policy.match(/script-src ([^;]+)/)[1];
if (scripts.includes("'unsafe-inline'")) throw new Error('Inline script execution must be hash-authorized');
for (const file of ['index.html', 'dist/index.html', 'dist/share/index.html']) {
  // Parse as HTML: tag/attribute case, quoted '>', comments and data-src must
  // behave exactly as they do in the browser, not bypass the hash check.
  const pending = [parse(readFileSync(file, 'utf8'))];
  while (pending.length) {
    const node = pending.pop();
    pending.push(...(node.childNodes ?? []));
    if (node.content) pending.push(node.content);
    if (node.tagName !== 'script' || node.attrs.some(attr => attr.name === 'src')) continue;
    const body = node.childNodes.map(child => child.value ?? '').join('');
    const hash = createHash('sha256').update(body).digest('base64');
    if (!scripts.includes(`'sha256-${hash}'`)) throw new Error(`CSP does not authorize the boot script in ${file}`);
  }
}
console.log('Script CSP: matched deployment headers; source and generated boot scripts authorized by hash.');
