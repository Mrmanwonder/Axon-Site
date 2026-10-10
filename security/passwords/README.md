# Axon weak and breached-password policy

## Product-required password rules (decision: 10 October 2026)
A **new** guardian password is accepted only if it has:
- **8 or more characters**
- At least **one uppercase English letter** (A-Z)
- At least **one lowercase English letter** (a-z)
- At least **one digit** (0-9)
- **No required special character**
- No whole-password match against the versioned blocklist or obvious year-based default variants
- No confirmed occurrence in HIBP's Pwned Passwords data

Existing account password sign-in and Parent Mode password reauthentication remain unchanged, to avoid locking out previously registered guardians. Password **creation**, **recovery/reset** and **authenticated change** run the checks. The new-password errors are specific to the chosen password and do not reveal account existence.

The checked-in `axon-weak-passwords.json` contains **12,412 exact values**: 9,999 distinct SecLists `xato-net-10-million-passwords-10000.txt` entries and 2,413 additional Axon/predictable variants. It is not the entire set of leaked passwords.

## Implemented HIBP browser defense
`src/lib/auth/passwordPolicy.js` performs a **privacy-preserving** Pwned Passwords lookup only after a user submits a newly chosen password:
1. Evaluate the composition requirement and lazy-loaded whole-password denylist.
2. Locally SHA-1 hash the **unaltered** password via Web Crypto (for HIBP lookup only, **not password storage**).
3. Send **only the first five hex characters** to `https://api.pwnedpasswords.com/range/{prefix}` over HTTPS, with `Add-Padding: true`. No API key is required.
4. Match the remaining 35 hex characters against the returned suffixes; count > 0 means reject, zero-count padding does not count.
5. If HIBP is unavailable, show an actionable retry message and do not submit a new password to Supabase. Requests time out; no request is made on every keystroke.
6. Never include the plaintext password or full hash in a URL, telemetry, console logs, or HIBP request. The original exact password goes to Supabase only after passing screening.

**Critical production limitation:** The HIBP/blocklist checks on the current Supabase Free plan are a **browser defense**, not a server-authoritative control. A caller can skip the UI and submit directly to the public Supabase Auth API. Native Supabase leaked-password protection is documented for **Pro+** and is the preferred, server-authoritative control. To actually enforce the desired restriction for all clients, enable native protection with explicit cost approval and configure Auth minimum length = 8 and character classes = uppercase + lowercase + digits (no mandatory symbol). Do not claim this warning is resolved until direct Auth API tests and the Supabase Security Advisor confirm it. The static custom blocklist must also be enforced server-authoritatively or documented as extra browser-side protection only.

## Sources
- SecLists (MIT): https://github.com/danielmiessler/SecLists/blob/master/Passwords/Common-Credentials/xato-net-10-million-passwords-10000.txt — fetched 10 Oct 2026.
- Kaggle common-password reference (CC0): https://www.kaggle.com/datasets/shivamb/10000-most-common-passwords — referenced, **not separately ingested**.
- HIBP API: https://haveibeenpwned.com/API/v3#PwnedPasswords — live, no corpus in this repository.
- Supabase current docs: https://supabase.com/docs/guides/auth/password-security .

## Tracking
- [AXO-234](https://linear.app/axon-26/issue/AXO-234): implementation, tests and Supabase server enforcement.
- [AXO-235](https://linear.app/axon-26/issue/AXO-235): full password-login QA.
- [GitHub #256](https://github.com/Mrmanwonder/Axon-Site/issues/256): follow-up production enforcement.
- AXO-55: server-side advisor warning.
