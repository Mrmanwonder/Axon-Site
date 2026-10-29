# Third-party notice: heic-to (libheif)

Used to decode HEIC/HEIF photos where the browser cannot (Chrome, Firefox). Safari decodes HEIC itself and never loads it. Entry point: `src/scan/import-decode.js`.

| Component | Where | Licence |
| --- | --- | --- |
| heic-to 1.6.7 (hoppergee), CSP build (`heic-to/csp`) | npm dependency; licence text in `third_party/heic-to/LICENSE` | LGPL-3.0-or-later |
| libheif and its codecs, compiled to WebAssembly inside heic-to | bundled in the same file | LGPL-3.0 (libheif) |

How the LGPL is met: the library is shipped unmodified as its own lazily loaded file (`dist/assets/heic-to-*.js`), separate from Axon's code, so it can be replaced with a modified version without rebuilding Axon. Its source is public at https://github.com/hoppergee/heic-to.

Recorded 2026-10-28 from the licence file shipped in the package. This is a reading of that file, not legal advice; counsel may want to confirm that serving an LGPL WebAssembly library this way meets the relinking obligation.
