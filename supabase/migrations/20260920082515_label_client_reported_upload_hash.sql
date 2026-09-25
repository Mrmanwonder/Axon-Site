-- S3 · A client-provided digest is telemetry, not an integrity guarantee.
--
-- Add the accurately named column without dropping the old one yet. This makes
-- rollout order safe: the currently deployed API can keep writing `sha256`
-- until the worker is redeployed, while the new API writes only the explicitly
-- untrusted column. A later cleanup migration can drop `upload.sha256` after
-- every runtime has moved.

alter table public.upload
  add column if not exists client_reported_sha256 text
    check (client_reported_sha256 is null or client_reported_sha256 ~ '^[0-9a-f]{64}$');

update public.upload
   set client_reported_sha256 = sha256
 where client_reported_sha256 is null
   and sha256 is not null;

comment on column public.upload.client_reported_sha256 is
  'Digest reported by the client. Useful only for telemetry/debugging; it is not server-verified and must never be used as an integrity guarantee.';

comment on column public.upload.sha256 is
  'DEPRECATED rollout-compatibility column. Client-reported and unverified; do not use for integrity decisions. New code writes client_reported_sha256.';
