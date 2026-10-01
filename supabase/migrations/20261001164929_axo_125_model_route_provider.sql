-- AXO-125: the provider is route configuration. model_route.provider selects the endpoint a
-- stage's calls go to, so moving from Google AI Studio to Vertex AI (zero data retention) is a
-- route change, not a code change. Existing routes keep calling AI Studio.

alter table public.model_route
  add column if not exists provider text not null default 'ai_studio'
    check (provider in ('ai_studio', 'vertex'));

comment on column public.model_route.provider is
  'Which endpoint serves this stage: ai_studio (Google AI Studio, GOOGLE_API_KEY) or vertex (Vertex AI, service-account secret). Both speak the same OpenAI-compatible contract.';
