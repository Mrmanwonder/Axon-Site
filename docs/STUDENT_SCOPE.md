# Student Mode authority and scope

## Purpose

Axon has one Supabase authentication principal per household: the guardian. That is
useful for consent, billing and account ownership, but it is too broad for the daily
student experience when one guardian owns multiple student profiles.

Student Mode adds a second, narrower **server-side authorization state**. It does not
create a second login and it does not put another bearer secret in browser storage.
The signed Supabase JWT already identifies the auth session through its `session_id`
claim. Axon stores one short-lived active student selection for that exact session.

The invariant is:

> Guardian ownership says which profiles the account may manage. Student scope says
> which one profile the daily academic session may read or mutate right now.

## Authority levels

### Guardian session

The Supabase session proves the account owner. It may:

- bootstrap the household;
- enumerate owned student profiles so the guardian can choose one;
- use Parent Mode for consent, deletion, billing and other sensitive actions;
- establish or switch Student Mode after the required guardian confirmation.

Guardian ownership alone must not remain sufficient for ordinary academic reads once
AXO-61 is complete.

### Parent Mode

Parent Mode is the stronger, recently re-authenticated guardian authority already
implemented through the signed JWT `amr` claim.

It is required when a household with more than one active student establishes its
first Student Mode selection or switches from one sibling to another. Refreshing the
same active scope does not repeatedly challenge the parent.

Parent Mode does not become a permanent bypass around Student Mode academic RLS.
Parent-only management operations should use explicit guardian/Parent Mode functions
instead of weakening ordinary paper, answer, insight or scan policies.

### Student Mode

Student Mode is represented by `private.student_scope_session`:

- guardian ID;
- signed Supabase `session_id`;
- selected student ID;
- server-issued timestamp;
- server expiry;
- optional revocation timestamp.

There is exactly one row per guardian + auth session. The browser never authors the
guardian ID or session ID. `public.set_student_scope(student_id)` derives them from
the signed JWT and verifies the requested student belongs to the current guardian.

The default lifetime is 30 minutes, bounded to 5–60 minutes. Expiry, session mismatch,
revocation, missing `session_id`, a deleted student, or ownership mismatch all fail
closed.

## Why a server session instead of a second bearer token

A second opaque token would need to be attached to every PostgREST, Storage and RPC
request. Putting it in local/session storage would create another credential to leak,
and the shared Supabase client does not give RLS an ergonomic, trustworthy custom
header for every request.

The server-scope row is an equivalent server-verifiable capability:

- the signed JWT session ID is the unforgeable capability handle;
- the selected student exists only in server state;
- changing a `student_id` query parameter cannot widen access;
- a different auth session has no scope even for the same guardian;
- revocation and expiry are immediate database decisions.

## Server primitives

### `private.current_auth_session_id()`

Returns the signed JWT `session_id`. Null is not treated as a legacy compatibility
mode; it is a refusal to establish/consume Student Mode.

### `public.set_student_scope(student_id, ttl_seconds)`

Verifies:

1. authenticated guardian exists;
2. signed session ID exists;
3. requested student belongs to that guardian and is not deleted;
4. requested lifetime is 5–60 minutes;
5. if the guardian owns multiple active students and this is a first selection or
   sibling switch, Parent Mode is fresh.

It then atomically creates/replaces the one scope for that auth session.

### `private.student_scope_allows(student_id)`

The load-bearing RLS primitive. It returns true only when the requested student is
the current, owned, unexpired, non-revoked scope for this exact auth session.

AXO-61 must use this helper on ordinary student-facing academic resources rather than
repeating `student.guardian_id = current_guardian_id()`.

### `public.student_scope_state()`

Returns only safe state: active flag, selected student ID, expiry and remaining
seconds. No secret is exposed because none is needed.

### `public.clear_student_scope()`

Revokes the current auth session's scope. The frontend must call this before sign-out
where possible; expiry and auth-session binding remain the server fallback.

## Resource rollout boundary

AXO-60 ships and tests the capability model. AXO-61 is responsible for the exhaustive
resource migration. At minimum it must cover:

- papers and pages;
- question regions and attempts;
- teacher marks and explanations;
- mark-loss data and insights;
- uploads, extraction/review state and scans;
- Library/search RPCs;
- paper Storage objects;
- every ordinary student-facing mutation.

The `student` profile table itself is intentionally not scoped by
`student_scope_allows` because the guardian must be able to enumerate owned profiles
to select one. Profile management remains guardian authority and sensitive actions
remain Parent Mode guarded.

## Required abuse tests

The capability layer must prove:

- unowned student selection is rejected;
- multi-profile first selection/switch fails without fresh Parent Mode;
- the selected sibling is allowed while another owned sibling is denied;
- a different signed auth session cannot reuse the scope;
- missing session ID fails closed;
- expiry fails closed;
- single-profile households can establish their sole profile without needless
  re-authentication;
- explicit clear/revocation removes access.

AXO-63 extends this to the complete API/resource surface after AXO-61/62 land.
