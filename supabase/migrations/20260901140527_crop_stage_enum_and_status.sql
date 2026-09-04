alter type public.extraction_status add value if not exists 'cropping' after 'structure';

alter table public.paper_page
  add column if not exists crop_status text not null default 'pending';

comment on column public.paper_page.crop_status is
  'pending | running | done | failed | skipped. A crop failure never blocks the run: content falls back to the full page.';
