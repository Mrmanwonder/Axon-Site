// D1: the scanner contract crosses two repositories, so "remember to update both"
// is not a contract. CI compares the shared page cap and upload MIME map against
// the matching branch in the other repo (falling back to main).
import fs from 'node:fs/promises';

const COUNTERPART_REPO = "Mrmanwonder/axon-backend";
const COUNTERPART_PATH = "shared/src/contract.ts";
const LOCAL_PATH = new URL("../src/scan/contract.js", import.meta.url);

function parseContract(source) {
  const max = source.match(/MAX_PAGES\s*:\s*(\d+)/);
  if (!max) throw new Error('Could not find MAX_PAGES in pipeline contract.');

  const map = {};
  for (const match of source.matchAll(/['"]((?:image|application)\/[^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g)) {
    map[match[1]] = match[2];
  }
  if (!Object.keys(map).length) throw new Error('Could not find upload MIME map in pipeline contract.');
  return { maxPages: Number(max[1]), uploadExtensions: Object.fromEntries(Object.entries(map).sort()) };
}

async function githubFile(repo, path, ref) {
  const url = `https://api.github.com/repos/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`;
  const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'axon-contract-parity' } });
  if (response.status === 404 && ref !== 'main') return githubFile(repo, path, 'main');
  if (!response.ok) throw new Error(`Could not read ${repo}@${ref}/${path}: HTTP ${response.status}`);
  const payload = await response.json();
  return Buffer.from(payload.content.replace(/\n/g, ''), 'base64').toString('utf8');
}

const local = parseContract(await fs.readFile(LOCAL_PATH, 'utf8'));
const ref = process.env.GITHUB_HEAD_REF || process.env.COUNTERPART_REF || 'main';
const remote = parseContract(await githubFile(COUNTERPART_REPO, COUNTERPART_PATH, ref));

if (JSON.stringify(local) !== JSON.stringify(remote)) {
  throw new Error(
    `Cross-repo pipeline contract drift detected. Local: ${JSON.stringify(local)}; ` +
    `${COUNTERPART_REPO}: ${JSON.stringify(remote)}`
  );
}
console.log(`Pipeline contract matches ${COUNTERPART_REPO} (${local.maxPages} pages; ${Object.keys(local.uploadExtensions).length} MIME types).`);
