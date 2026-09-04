alter table public.model_call
  add column if not exists http_status smallint,
  add column if not exists error_detail text;

comment on column public.model_call.http_status is
  'Raw HTTP status from the model provider on a failed call (e.g. 401 vs 403), null on success. Added because error_code alone could not distinguish an invalid API key from an OpenRouter moderation flag.';
comment on column public.model_call.error_detail is
  'First 500 chars of the raw response body on a failed call, null on success. The evidence behind error_code -- never the presigned image URL, only OpenRouter''s own error text.';
