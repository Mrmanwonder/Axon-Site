// The model client. One module, used by every worker.
//
// REVIEW_PIPELINE.md §7. Three things are load-bearing:
//
//   · The provider policy is not a parameter. Zero Data Retention endpoints
//     only, and no provider that stores or trains on input. This is a named
//     minor's exam script with their handwriting, their marks, and often their
//     name on the cover. `model_route.allow_training` can relax it for one
//     stage, it defaults false on every row, and nothing in this codebase
//     writes that column — a human sets it, having read what it means.
//
//   · Model choice is configuration. Routes are read from `model_route` at call
//     time, cached for a minute, so a bad model is swapped out with an UPDATE
//     while a paper is mid-flight rather than with a redeploy.
//
//   · The model that served the call is logged, not the one requested. With
//     fallbacks live you frequently did not get what you asked for, and an eval
//     that assumes otherwise is measuring noise.
//
// Images go in as presigned GET URLs rather than base64: base64 is ~1.33× the
// bytes through an isolate with a tight memory budget, and building it costs CPU
// this function does not have. The consequence — a bearer capability to a
// student's page, held by a third party for ten minutes — is stated in
// STORAGE_R2.md §6 rather than assumed away.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const OR_URL = 'https://openrouter.ai/api/v1/chat/completions';

export type Stage = 'triage' | 'structure' | 'content' | 'adjudicate' | 'explain';

/**
 * Non-negotiable on every request.
 *
 * `allow_fallbacks` stays true: the filters above it have already excluded
 * non-compliant providers, so a fallback is a compliant secondary provider, and
 * a hard failure on a student's paper is the worse outcome. It is not a way
 * around the policy — with `zdr` and `data_collection` set, there is nothing
 * non-compliant left to fall back to.
 */
export const PROVIDER_POLICY = {
  zdr: true,
  data_collection: 'deny',
  require_parameters: true,
  allow_fallbacks: true,
} as const;

/**
 * What a route that has opted out of the policy sends instead. Reachable only
 * by a `model_route` row a human set `allow_training` on.
 */
const RELAXED_POLICY = {
  zdr: false,
  data_collection: 'allow',
  require_parameters: true,
  allow_fallbacks: true,
} as const;

export interface Route {
  stage: Stage;
  primary_model: string;
  fallbacks: string[];
  temperature: number;
  max_tokens: number;
  prompt_version: string;
  allow_training: boolean;
  enabled: boolean;
}

// ── route cache ─────────────────────────────────────────────────────────────
// A minute, because an isolate lives for minutes and a route change should take
// effect within one tick of the operator making it — not on the next cold start.

const ROUTE_TTL_MS = 60_000;
const routes = new Map<Stage, { at: number; route: Route }>();

export async function getRoute(sb: SupabaseClient, stage: Stage): Promise<Route> {
  const cached = routes.get(stage);
  if (cached && Date.now() - cached.at < ROUTE_TTL_MS) return cached.route;

  const { data, error } = await sb
    .from('model_route')
    .select('stage, primary_model, fallbacks, temperature, max_tokens, prompt_version, allow_training, enabled')
    .eq('stage', stage)
    .maybeSingle();

  if (error) throw new ModelError('route_lookup_failed', `could not read the route for ${stage}: ${error.message}`);
  if (!data) throw new ModelError('no_route', `no model route is configured for ${stage}`);
  if (!data.enabled) throw new ModelError('route_disabled', `the ${stage} route is switched off`);

  const route = data as Route;
  routes.set(stage, { at: Date.now(), route });
  return route;
}

/** Drop the cache. Used by the eval harness between runs, not by workers. */
export function forgetRoutes(): void {
  routes.clear();
}

/**
 * Point one stage at a different model for one call.
 *
 * This is what makes the eval harness worth having: run the golden set, change
 * the content model, run it again, compare. It is also why model_route is a
 * table — model selection gets decided rather than guessed.
 *
 * Never applied from a queue message a student could influence: eval-run is
 * service-role only, and the override travels on the message it mints.
 */
export function applyOverride(route: Route, override?: Partial<Route> | null): Route {
  if (!override) return route;
  return {
    ...route,
    ...(override.primary_model ? { primary_model: override.primary_model } : {}),
    ...(Array.isArray(override.fallbacks) ? { fallbacks: override.fallbacks } : {}),
    ...(typeof override.temperature === 'number' ? { temperature: override.temperature } : {}),
    ...(typeof override.max_tokens === 'number' ? { max_tokens: override.max_tokens } : {}),
    ...(override.prompt_version ? { prompt_version: override.prompt_version } : {}),
    // Deliberately not overridable. A route that may be trained on is a decision
    // a human makes in the table, not one an eval run can borrow for an hour.
    allow_training: route.allow_training,
  };
}

// ── errors ──────────────────────────────────────────────────────────────────

export class ModelError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;

  constructor(code: string, message: string, status = 0, retryable = false) {
    super(message);
    this.name = 'ModelError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

/**
 * Which failures are worth another attempt.
 *
 * Rate limits, provider outages and timeouts are transient and the same request
 * will work later. A rejected schema, a bad key or an unsatisfiable routing
 * policy will fail identically five times and burn four papers' worth of
 * latency doing it.
 */
export function classify(status: number, body: string): ModelError {
  const lower = body.toLowerCase();

  // The policy filters can leave a model with no eligible endpoint at all. That
  // reads as a 404 about the model, which sends you looking at the model name;
  // it is almost always the policy, and on a free model it almost always is.
  if (status === 404 && (lower.includes('no endpoints') || lower.includes('no allowed providers'))) {
    return new ModelError(
      'no_compliant_provider',
      'No provider for this model meets the zero-data-retention policy. ' +
        'Either pick a model with a compliant endpoint, or decide deliberately that this stage may be trained on.',
      status,
      false,
    );
  }
  if (status === 401 || status === 403) {
    return new ModelError('auth', 'OpenRouter rejected the key', status, false);
  }
  if (status === 402) {
    return new ModelError('out_of_credit', 'the OpenRouter account is out of credit', status, false);
  }
  if (status === 429) {
    return new ModelError('rate_limited', 'rate limited by OpenRouter', status, true);
  }
  if (status >= 500) {
    return new ModelError('provider_error', `provider returned ${status}`, status, true);
  }
  return new ModelError('bad_request', body.slice(0, 500) || `request failed with ${status}`, status, false);
}

// ── the call ────────────────────────────────────────────────────────────────

export interface ImageRef {
  /** Presigned GET URL. Never logged, never stored. */
  url: string;
  /** The object key behind it. This is what goes in the ledger. */
  key: string;
  detail?: 'low' | 'high';
}

export interface CallOpts<T> {
  sb: SupabaseClient;
  stage: Stage;
  system: string;
  instruction: string;
  images?: ImageRef[];
  /** JSON Schema, enforced server-side by the provider. */
  schema: { name: string; schema: Record<string, unknown> };
  /**
   * Checked after parsing. Strict schema mode is a strong constraint, not a
   * proof, and the fields that matter here carry provenance the schema cannot
   * assert — a box that is present but does not fit the page is still fiction.
   */
  validate: (parsed: unknown) => T;
  runId?: string | null;
  paperId?: string | null;
  regionId?: string | null;
  studentId?: string | null;
  attempt?: number;
  timeoutMs?: number;
  /** Set by eval-run only, to compare one stage across models. */
  routeOverride?: Partial<Route> | null;
}

export interface CallResult<T> {
  parsed: T;
  /** What actually served the request, which is not always what was asked for. */
  model: string;
  promptVersion: string;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  latencyMs: number;
}

export async function callModel<T>(opts: CallOpts<T>): Promise<CallResult<T>> {
  const key = Deno.env.get('OPENROUTER_API_KEY');
  if (!key) throw new ModelError('no_key', 'OPENROUTER_API_KEY is not set for this function', 0, false);

  const route = applyOverride(await getRoute(opts.sb, opts.stage), opts.routeOverride);
  const attempt = opts.attempt ?? 1;
  const started = performance.now();

  const content: unknown[] = [{ type: 'text', text: opts.instruction }];
  for (const image of opts.images ?? []) {
    content.push({ type: 'image_url', image_url: { url: image.url, detail: image.detail ?? 'high' } });
  }

  const body = {
    model: route.primary_model,
    // Provider failover is automatic; model fallback is opt-in. Both are wanted.
    models: route.fallbacks?.length ? route.fallbacks : undefined,
    provider: route.allow_training ? RELAXED_POLICY : PROVIDER_POLICY,
    temperature: route.temperature,
    max_tokens: route.max_tokens,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: opts.schema.name, strict: true, schema: opts.schema.schema },
    },
    usage: { include: true },
  };

  const log = (patch: Record<string, unknown>) =>
    logCall(opts.sb, {
      run_id: opts.runId ?? null,
      paper_id: opts.paperId ?? null,
      region_id: opts.regionId ?? null,
      student_id: opts.studentId ?? null,
      stage: opts.stage,
      requested_model: route.primary_model,
      prompt_version: route.prompt_version,
      attempt,
      latency_ms: Math.round(performance.now() - started),
      // Keys, never the signed URLs. A presigned URL is a bearer credential, and
      // a log line outlives the ten minutes it is good for.
      image_keys: (opts.images ?? []).map((i) => i.key),
      ...patch,
    });

  let res: Response;
  try {
    res = await fetch(OR_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': Deno.env.get('AXON_SITE_URL') ?? 'https://axon.app',
        'X-Title': 'Axon',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 90_000),
    });
  } catch (cause) {
    const timedOut = cause instanceof DOMException && cause.name === 'TimeoutError';
    const err = new ModelError(
      timedOut ? 'timeout' : 'network',
      timedOut ? 'the model did not answer in time' : String(cause),
      0,
      true,
    );
    await log({ model_id: route.primary_model, ok: false, error_code: err.code });
    throw err;
  }

  if (!res.ok) {
    const err = classify(res.status, await res.text());
    await log({ model_id: route.primary_model, ok: false, error_code: err.code });
    throw err;
  }

  const data = await res.json() as {
    model?: string;
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
    error?: { message?: string };
  };

  const served = data.model ?? route.primary_model;
  const usage = {
    input_tokens: data.usage?.prompt_tokens ?? null,
    output_tokens: data.usage?.completion_tokens ?? null,
    cost_usd: data.usage?.cost ?? null,
  };

  // A 200 carrying an error object happens on OpenRouter, and reading
  // choices[0] off it produces "the page was blank" rather than "the call
  // failed" — which is exactly the invisible failure hard rule 4 forbids.
  const raw = data.choices?.[0]?.message?.content;
  if (data.error || typeof raw !== 'string' || raw.length === 0) {
    const err = new ModelError('empty_response', data.error?.message ?? 'the model returned nothing', 200, true);
    await log({ model_id: served, ok: false, error_code: err.code, ...usage });
    throw err;
  }

  let parsed: T;
  try {
    parsed = opts.validate(JSON.parse(raw));
  } catch (cause) {
    // Retryable: with a fallback chain and a nonzero temperature, the same
    // request can produce a schema-clean answer next time. It is capped by the
    // queue's attempt count, not by hope.
    const err = new ModelError('bad_shape', `the model's answer did not fit the schema: ${cause}`, 200, true);
    await log({ model_id: served, ok: false, error_code: err.code, ...usage });
    throw err;
  }

  await log({ model_id: served, ok: true, ...usage });

  return {
    parsed,
    model: served,
    promptVersion: route.prompt_version,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    costUsd: usage.cost_usd,
    latencyMs: Math.round(performance.now() - started),
  };
}

// ── the ledger ──────────────────────────────────────────────────────────────
// Never allowed to take down the call it is recording: a paper that failed
// because its cost row would not insert is a worse outcome than a gap in the
// ledger. It does say so on the way past, because a silent gap is how a cost
// meter stops being one.

async function logCall(sb: SupabaseClient, row: Record<string, unknown>): Promise<void> {
  const { error } = await sb.from('model_call').insert(row);
  if (error) console.error('model_call insert failed', error.message, row.stage, row.error_code ?? 'ok');
}
