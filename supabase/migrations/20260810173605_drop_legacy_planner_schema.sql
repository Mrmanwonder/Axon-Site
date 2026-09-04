-- Erase the previous attempt's schema. This was an AXON study-planner model
-- (missions, study blocks, focus sessions, a knowledge "digital twin") which
-- does not correspond to the product described in CLAUDE.md. All 16 tables were
-- verified empty before dropping.

drop table if exists
  public.mission_steps,
  public.missions,
  public.study_blocks,
  public.study_plans,
  public.focus_sessions,
  public.learning_events,
  public.knowledge_states,
  public.progress_snapshots,
  public.notes,
  public.notifications,
  public.past_papers,
  public.topics,
  public.subjects,
  public.academic_profiles,
  public.user_preferences,
  public.users
cascade;
