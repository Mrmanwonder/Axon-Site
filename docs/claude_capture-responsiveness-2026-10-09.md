# AXO-189: shutter acknowledgement and original encoding

The controller now publishes capture-in-flight state before native still acquisition or canvas fallback. The shutter and status strip acknowledge the action and prevent duplicate taps while the existing shot is in flight. The camera stream and preview paint loop remain active. Live detector searches yield to still analysis; manual capture remains independent of detection success.

Canvas fallback originals are drawn and encoded in a dedicated module worker using a transferred clone of the still bitmap where Worker/OffscreenCanvas.convertToBlob are available. Native photo blobs remain unchanged. The original's dimensions and JPEG quality (0.95) match the previous path. Capability/worker failure falls back to the established canvas path with a diagnostic; empty/failed encoding becomes a visible capture failure. Temporary worker bitmaps and resize bitmaps close deterministically. The caller retains ownership of the source until conditioning completes.

Tests exercise acknowledgement before a held native photo, duplicate taps, continued preview, encoding failure with no false page, off-thread transfer ownership, worker crash fallback, capability fallback, and release on success/failure. Full CI must pass before merge.

## Outstanding device acceptance

No before/after Android or iPhone measurement is claimed. On the owner's OnePlus and an iPhone Safari, use the same marked multi-page paper and record long tasks, preview frame drops, shutter-to-feedback and capture-to-thumbnail p50/p95, source dimensions/capture path and repeated-session memory. Compare 100% crops and confirm no missing/duplicate pages. The no-worker fallback still draws on the UI thread and needs separate measurement. AXO-189 remains open until physical acceptance is recorded.
