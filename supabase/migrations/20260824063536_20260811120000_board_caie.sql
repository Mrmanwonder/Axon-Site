-- ============================================================================
-- 0008 · Cambridge (CAIE) joins the board enum
-- ============================================================================
-- Alone in its own migration on purpose. Postgres will add a value to an enum
-- inside a transaction, but nothing may *use* that value until the transaction
-- that added it has committed — so a default of 'CAIE' cannot be set in the
-- same file. 0009 does that.
-- ============================================================================

alter type public.board add value if not exists 'CAIE';

comment on type public.board is
  'Examination boards the app is scoped to. v1 onboards Cambridge (CAIE) only; CBSE remains for accounts created before that and is not offered to new ones.';
