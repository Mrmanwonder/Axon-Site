# Third-party notice: scanic and the page-corner model

Used for live page detection (`src/scan/detector.js`, `src/scan/detect-worker.js`) and the Adjust edges editor.

| Component | Where | Licence |
| --- | --- | --- |
| scanic 1.6.0 (marquaye) | npm dependency; licence text in `third_party/scanic/LICENSE` | MIT |
| DocCornerNet architecture (mapo80), as slimmed and trained in scanic's repository | `public/scan-ml/0.2.0/doccornernet_lean.ort` | MIT, per scanic's README ("DocCornerNet ... MIT licensed") and `MODEL_CARD.md` |
| ONNX Runtime Web (custom minimal wasm build shipped by scanic) | `public/scan-ml/0.2.0/ort-wasm-simd-threaded.*` | MIT (ONNX Runtime) |

Recorded 2026-10-03 from the licence files and READMEs shipped in the package. This is a reading of those files, not legal advice and not an independent audit of the training data behind the weights; AXO-157 tracks any counsel review the owner wants.
