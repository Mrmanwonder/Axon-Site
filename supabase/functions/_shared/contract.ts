// Server mirror of src/scan/contract.js.
//
// A copy on purpose. The browser modules are served as static files from dist/
// and these run on Deno; there is no build step that could bridge them, and
// inventing one to share four constants would cost more than it saves. Change
// both, or neither — the thresholds are meaningless if the device and the server
// disagree about them.

export const PIPELINE_VERSION = '1.0.0';

export const TEACHER_INK = 'red';

// Mirror of the QUALITY thresholds in src/scan/contract.js's `QUALITY` — the
// subset the server needs to read a page's own quality_verdict/quality_signals
// honestly rather than re-deriving them. Change both, or neither.
export const QUALITY = {
  BLUR_WARN: 0.22,
  BLUR_FAIL: 0.10,
  GLARE_WARN: 0.005,
  GLARE_FAIL: 0.035,
  RESOLUTION_WARN: 1800,
  RESOLUTION_FAIL: 1000,
};

export type MarkShape = 'stroke' | 'crossing' | 'enclosure' | 'glyph' | 'blob' | 'unknown';

export type MarkClass =
  | 'marginal_number' | 'tick' | 'half_tick' | 'cross' | 'strikethrough'
  | 'circle' | 'underline' | 'comment' | 'unknown';

export type RegionType = 'prose' | 'math' | 'diagram' | 'table' | 'mcq' | 'mixed';

export type ConfidenceTier = 'confident' | 'unsure' | 'unreadable';

export interface Box { page: number; x: number; y: number; w: number; h: number }

export interface TeacherMarkInput {
  page: number;
  box: { x: number; y: number; w: number; h: number };
  shape: MarkShape;
  metrics: Record<string, unknown>;
}

export interface PageInput {
  page_number: number;
  storage_path: string;
  proxy_path?: string | null;
  width: number;
  height: number;
  quality?: { verdict: string; reasons: string[]; signals: Record<string, number> };
  conditioning_meta?: Record<string, unknown>;
  layer_fallback?: 'non_red_marking' | 'student_wrote_red' | null;
  teacher_marks?: TeacherMarkInput[];
  margin_band?: { x0: number; x1: number; side: 'left' | 'right'; count: number } | null;
}

/**
 * Provenance is not optional. A field the extractor cannot point at on the page
 * is discarded, and the field it belonged to is marked unsure.
 */
export function hasProvenance(box: unknown, page: number): box is Box {
  const b = box as Box | null;
  return !!b && [b.x, b.y, b.w, b.h].every((n) => typeof n === 'number' && Number.isFinite(n)) &&
    b.w > 0 && b.h > 0 && (b.page ?? page) > 0;
}

/** Normalise a model-returned box, or drop it. Never repair it into existence. */
export function takeBox(raw: unknown, page: number, pageW: number, pageH: number): Box | null {
  if (!hasProvenance(raw, page)) return null;
  const b = raw as Box;
  // Models return boxes in a 0–1000 normalised space or in pixels depending on
  // how they were asked. We ask for 0–1000, so anything larger is a
  // misunderstanding rather than a coordinate, and a box we cannot place is a
  // box that does not exist.
  if (b.x > 1000 || b.y > 1000 || b.x + b.w > 1002 || b.y + b.h > 1002) return null;
  return {
    page: b.page ?? page,
    x: Math.round((b.x / 1000) * pageW),
    y: Math.round((b.y / 1000) * pageH),
    w: Math.max(1, Math.round((b.w / 1000) * pageW)),
    h: Math.max(1, Math.round((b.h / 1000) * pageH)),
  };
}

/**
 * The pipeline's three tiers collapse onto the database's three-value
 * `confidence` enum at commit. `confident` becomes `likely`, not `confirmed` —
 * only the person who sat the exam can confirm anything.
 *
 * SCANNING_SYSTEM.md §10 has unsure fields "included in analytics but tagged";
 * CLAUDE.md hard rule 3 excludes them until a student confirms. The hard rule
 * wins, and the analytics views enforce it whatever this returns.
 */
export function tierToConfidence(tier: ConfidenceTier): 'likely' | 'unsure' {
  return tier === 'confident' ? 'likely' : 'unsure';
}
