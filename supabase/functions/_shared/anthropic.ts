// The model client, and the cost meter around it.
//
// Two models, deliberately. SCANNING_SYSTEM.md §15 makes "a smaller model for
// structure and a frontier model only for content" an explicit cost lever, and
// the two passes want genuinely different things: the structure pass has to find
// boundaries on a downscaled page and does not need to read handwriting, while
// the content pass reads a child's writing under a teacher's ink and is the one
// place accuracy is worth paying for.
//
// Both are environment-overridable, because the accuracy harness exists to
// answer exactly this question with data rather than taste.

import Anthropic from 'npm:@anthropic-ai/sdk@0.117.1';

export const MODELS = {
  structure: Deno.env.get('MASTERY_MODEL_STRUCTURE') ?? 'claude-haiku-4-5',
  content: Deno.env.get('MASTERY_MODEL_CONTENT') ?? 'claude-opus-5',
  explanation: Deno.env.get('MASTERY_MODEL_EXPLANATION') ?? 'claude-opus-5',
};

// USD per million tokens, input and output. Kept here rather than looked up so
// a run's recorded cost is reproducible after the fact; update alongside MODELS.
const RATES: Record<string, { in: number; out: number }> = {
  'claude-haiku-4-5': { in: 1.00, out: 5.00 },
  'claude-sonnet-5': { in: 3.00, out: 15.00 },
  'claude-opus-5': { in: 5.00, out: 25.00 },
};

// Paise per US dollar. The unit the business plans in is rupees, and a cost
// column in dollars is a column nobody checks against the price of a plan.
const PAISE_PER_USD = Number(Deno.env.get('MASTERY_PAISE_PER_USD') ?? 8800);

export function client(): Anthropic {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set for this function');
  return new Anthropic({ apiKey });
}

export interface Usage { input: number; output: number; cache_read: number; paise: number }

export function meter(): Usage & { add: (model: string, usage: unknown) => void } {
  const total: Usage = { input: 0, output: 0, cache_read: 0, paise: 0 };
  return Object.assign(total, {
    add(model: string, usage: unknown) {
      const u = usage as {
        input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number;
      } | null;
      if (!u) return;
      const inTok = u.input_tokens ?? 0;
      const outTok = u.output_tokens ?? 0;
      const cached = u.cache_read_input_tokens ?? 0;
      total.input += inTok;
      total.output += outTok;
      total.cache_read += cached;
      const rate = RATES[model];
      if (!rate) return; // an unpriced model logs tokens and no rupees, rather than a wrong number
      const usd = (inTok / 1e6) * rate.in + (outTok / 1e6) * rate.out;
      total.paise += Math.round(usd * PAISE_PER_USD);
    },
  });
}

/**
 * One structured vision call.
 *
 * Structured output rather than prose the caller has to parse: the extractor's
 * whole contract is that it returns fields with boxes or returns nothing, and a
 * schema is the only way to make "or returns nothing" mean null instead of an
 * apologetic paragraph.
 */
export async function askAboutImage(opts: {
  model: string;
  system: string;
  instruction: string;
  images: { media_type: string; data: string }[];
  schema: Record<string, unknown>;
  maxTokens?: number;
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
}): Promise<{ parsed: unknown; usage: unknown }> {
  const anthropic = client();
  const response = await anthropic.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 8000,
    system: opts.system,
    output_config: {
      format: { type: 'json_schema', schema: opts.schema },
      ...(opts.effort ? { effort: opts.effort } : {}),
    },
    messages: [{
      role: 'user',
      content: [
        ...opts.images.map((img) => ({
          type: 'image' as const,
          source: { type: 'base64' as const, media_type: img.media_type as 'image/jpeg', data: img.data },
        })),
        { type: 'text' as const, text: opts.instruction },
      ],
    }],
  });

  // A refusal is a real outcome, not an exception. Surface it rather than
  // letting an empty content array read as "the page was blank".
  if (response.stop_reason === 'refusal') {
    throw new Error(`the model declined to read this page (${response.stop_details?.category ?? 'unspecified'})`);
  }

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text).join('');

  let parsed: unknown = null;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  return { parsed, usage: response.usage };
}

export type { Anthropic };
