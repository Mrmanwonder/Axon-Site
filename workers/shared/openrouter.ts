// The model client. One module, used by every worker.
//
// REVIEW_PIPELINE.md §7, CLOUDFLARE_WORKERS.md §7. Logic is unchanged from the
// Supabase version — only `Deno.env.get` becomes `env.X`, and the `fetch` call
// underneath it is now pure I/O wait against the Worker's CPU budget rather
// than a cost that competed with a 2-second ceiling.
//
// Three things stay load-bearing:
//
//   · The provider policy is not a parameter. Zero Data Retention endpoints
//     only, and no provider that stores or trains on input. `model_route.
//     allow_training` can relax it for one stage; nothing here writes that
//     column, a human sets it having read what it means.
//
//   · Model choice is configuration, read from `model_route` at call time and
//     cached for a minute — a bad model is swapped out with an UPDATE while a
//     paper is mid-flight rather than with a redeploy.
//
//   · The model that served the call is logged, not the one requested. With
//     fallbacks live you frequently did not get what you asked for, and an
//     eval that assumes otherwise is measuring noise.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Env } from './env.ts';

const OR_URL = 'https://openrouter.ai/api/v1/chat/completions';

export type Stage = 'triage' | 'structure' | 'content' | 'adjudicate' | 'explain';

/**
 * Non-negotiable on every request.
 *
 * `allow_fallbacks` stays true: the filters above it have already excluded
 * non-compliant providers, so a fallback is a compliant secondary provider,
 * and a hard failure on a student's paper is the worse outcome.
 */
export const PROVIDER_POLICY = {
  zdr: true,
  data_collection: 'deny',
  require_parameters: true,
  allow_fallbacks: true,
} as const;

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
// A minute, because an isolate lives for minutes and a route change should
// take effect within one delivery of the operator making it.

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

export function forgetRoutes(): void {
  routes.clear();
}

export function applyOverride(route: Route, override?: Partial<Route> | null): Route {
  if (!override) return route;
  return {
    ...route,
    ...(override.primary_model ? { primary_model: override.primary_model } : {}),
    ...(Array.isArray(override.fallbacks) ? { fallbacks: override.fallbacks } : {}),
    ...(typeof override.temperature === 'number' ? { temperature: override.temperature } : {}),
    ...(typeof override.max_tokens === 'number' ? { max_tokens: override.max_tokens } : {}),
    ...(override.prompt_version ? { prompt_version: override.prompt_version } : {}),
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

export function classify(status: number, body: string): ModelError {
  const lower = body.toLowerCase();

  if (status === 404 && (lower.includes('no endpoints') || lower.includes('no allowed providers'))) {
    return new ModelError(
      'no_compliant_provider',
      'No provider for this model meets the zero-data-retention policy. ' +
        'Either pick a model with a compliant endpoint, or decide deliberately that this stage may be trained on.',
      status,
      false,
    );
  }
  if (status === 401 || status === 403) return new ModelError('auth', 'OpenRouter rejected the key', status, false);
  if (status === 402) return new ModelError('out_of_credit', 'the OpenRouter account is out of credit', status, false);
  if (status === 429) return new ModelError('rate_limited', 'rate limited by OpenRouter', status, true);
  if (status >= 500) return new ModelError('provider_error', `provider returned ${status}`, status, true);
  return new ModelError('bad_request', body.slice(0, 500) || `request failed with ${status}`, status, false);
}

// ── the call ────────────────────────────────────────────────────────────────

export interface ImageRef {
  /** Signed asset-route URL. Never logged, never stored. */
  url: string;
  /** The object key behind it. This is what goes in the ledger. */
  key: string;
  detail?: 'low' | 'high';
}

export interface CallOpts<T> {
  env: Env;
  sb: SupabaseClient;
  stage: Stage;
  system: string;
  instruction: string;
  images?: ImageRef[];
  schema: { name: string; schema: Record<string, unknown> };
  validate: (parsed: unknown) => T;
  runId?: string | null;
  paperId?: string | null;
  regionId?: string | null;
  studentId?: string | null;
  attempt?: number;
  timeoutMs?: number;
  routeOverride?: Partial<Route> | null;
}

export interface CallResult<T> {
  parsed: T;
  model: string;
  promptVersion: string;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  latencyMs: number;
}

export async function callModel<T>(opts: CallOpts<T>): Promise<CallResult<T>> {
  const key = opts.env.OPENROUTER_API_KEY;
  if (!key) throw new ModelError('no_key', 'OPENROUTER_API_KEY is not set for this worker', 0, false);

  const route = applyOverride(await getRoute(opts.sb, opts.stage), opts.routeOverride);
  const attempt = opts.attempt ?? 1;
  const started = Date.now();

  const content: unknown[] = [{ type: 'text', text: opts.instruction }];
  for (const image of opts.images ?? []) {
    content.push({ type: 'image_url', image_url: { url: image.url, detail: image.detail ?? 'high' } });
  }

  const body = {
    model: route.primary_model,
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
      latency_ms: Date.now() - started,
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
        'HTTP-Referer': opts.env.MASTERY_SITE_URL ?? 'https://mastery.app',
        'X-Title': 'Mastery',
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
    latencyMs: Date.now() - started,
  };
}

// ── the ledger ──────────────────────────────────────────────────────────────

async function logCall(sb: SupabaseClient, row: Record<string, unknown>): Promise<void> {
  const { error } = await sb.from('model_call').insert(row);
  if (error) console.error('model_call insert failed', error.message, row.stage, row.error_code ?? 'ok');
}
