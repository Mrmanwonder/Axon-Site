-- AXO-123: explain and adjudicate have failed `bad_shape` on every call since
-- they moved to Gemini 3.5 Flash-Lite. On Gemini 3.x the output budget
-- (max_tokens) includes thinking tokens, and thinking cannot be switched off;
-- at thinking `medium`/`high` with a 2048 budget the reasoning consumes the
-- budget and the JSON answer is cut off at ~75 tokens.
--
-- Roll both stages back to gemini-3.1-flash-lite (19/19 explain and 7/7
-- adjudicate OK in production, Aug-Sep) at thinking `low` with a 4096 budget.
-- The full routing table is certified separately by AXO-125 via eval_run.
-- The prompt version is left as it is; callModel now repairs a `length` stop.

update public.model_route
set primary_model = 'gemini-3.1-flash-lite',
    fallbacks = '{}'::text[],
    thinking_level = 'low',
    max_tokens = 4096,
    allow_training = false,
    updated_at = now()
where stage in ('explain', 'adjudicate');

-- Reasoning tokens are billed as output and count against max_tokens, so a
-- failed call is only diagnosable if they are recorded next to output_tokens.
alter table public.model_call
  add column if not exists reasoning_tokens integer;

comment on column public.model_call.reasoning_tokens is
  'Thinking tokens reported by the provider for this call, when it reports them. Billed as output and counted against max_tokens.';
comment on column public.model_call.error_detail is
  'Bounded diagnostic text for a failed call: provider body for HTTP failures; for bad_shape / empty_response, finish_reason, token counts and the validator message with quoted student text redacted. Never raw model output.';
