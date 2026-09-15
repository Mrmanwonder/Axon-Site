import { readFile, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
const paths = [
  ...html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/g),
  ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g),
].map((match) => match[1]);

if (!paths.length) throw new Error("Could not find the initial JavaScript bundle in dist/index.html");

let raw = 0;
let gzip = 0;
for (const path of new Set(paths)) {
  const url = new URL(`../dist${path}`, import.meta.url);
  raw += (await stat(url)).size;
  gzip += gzipSync(await readFile(url)).length;
}

const GZIP_BUDGET = 210 * 1024;
if (gzip > GZIP_BUDGET) {
  throw new Error(`Initial JavaScript is ${Math.round(gzip / 1024)} KiB gzip; budget is ${GZIP_BUDGET / 1024} KiB`);
}

console.log(`Initial JavaScript: ${Math.round(raw / 1024)} KiB raw, ${Math.round(gzip / 1024)} KiB gzip`);
