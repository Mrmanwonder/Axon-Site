-- Align source control with the 2026-10-10 production least-privilege change.
-- These student-data views use security_invoker=true; only authenticated readers need SELECT.
-- They are not public data APIs and should never accept client write access.
revoke all privileges on
  public.attempt_analytics,
  public.consent_current,
  public.mark_loss_analytics,
  public.paper_canonical_run,
  public.paper_progress,
  public.review_queue,
  public.student_analytics_readiness,
  public.topic_evidence
from anon, authenticated;

grant select on
  public.attempt_analytics,
  public.consent_current,
  public.mark_loss_analytics,
  public.paper_canonical_run,
  public.paper_progress,
  public.review_queue,
  public.student_analytics_readiness,
  public.topic_evidence
to authenticated;

-- The dashboard bootstrap derives its identity from auth.uid() and must be signed in.
revoke execute on function public.bootstrap_current_user() from anon;
