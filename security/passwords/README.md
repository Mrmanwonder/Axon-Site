# Axon password denylist — reference data

The `axon-weak-passwords.json` file documents **12,412 distinct, exact password strings** and additional *whole-password* pattern rules for Axon's guardian credentials. It includes 9,999 unique passwords from SecLists' `xato-net-10-million-passwords-10000.txt` and 2,413 Axon/default/year variants. It is **not** a complete leaked-password corpus, and **committing this JSON does not enforce any restriction in Supabase Auth**.

## Provenance and updates
- SecLists (MIT project): https://github.com/danielmiessler/SecLists/blob/master/Passwords/Common-Credentials/xato-net-10-million-passwords-10000.txt — fetched October 10, 2026.
- Kaggle 10,000 Common Passwords (CC0): https://www.kaggle.com/datasets/shivamb/10000-most-common-passwords — provenance reference; Kaggle CSV itself was not ingested or assumed byte-identical to the SecLists file.
- HIBP Pwned Passwords: https://haveibeenpwned.com/API/v3 — not downloaded or reproduced. Always use the latest breach data.
- NIST SP 800-63B: https://pages.nist.gov/800-63-4/sp800-63b.html .

Refresh by re-fetching the source and applying deterministic versions of the Axon-specific variants; validate the counts, samples, rules and SPDX attribution in PR review. Do not introduce raw customer passwords.

## Enforcement requirement (NOT IMPLEMENTED by this data PR)
The server-authoritative Supabase Auth configuration must reject weak and compromised choices at signup, credential addition, recovery/reset and change. This must still hold when directly invoking Supabase Auth without using Axon's UI.

Supabase Auth native leaked-password protection is available on **Pro+**, but this project was on **Free** at investigation time. The built-in Before User Created hook does not receive the plaintext password; a client-only check is therefore bypassable. An alternative server-side architecture cannot claim equivalent protection until direct Auth API paths are closed and adversarial integration tests confirm it. Do **not** purchase/upgrade a plan without the owner's explicit approval.

NIST-aligned targets for single-factor passwords: >=15 Unicode code points, allow at least 64 (target 128), spaces, paste, password managers and no composition requirements. Compare the **whole** password against the list and contextual derivatives; do not reject an otherwise strong long passphrase merely for containing a word such as "password". Do not silently trim, lowercase or modify the password sent to Auth.

For custom HIBP checking (only in a verifiably authoritative server flow): calculate SHA-1 locally, send only the first five hexadecimal characters to the free Pwned Passwords range API, check the remaining 35 characters against the suffix list with count >0, and use `Add-Padding: true`. Do not send plaintext or a full hash, query on every keystroke, log credentials, or leak the value through analytics. Handle outages deliberately and test rate limiting.

## Tracking
- GitHub: https://github.com/Mrmanwonder/Axon-Site/issues/256
- Linear: AXO-234 (policy and blocklist), AXO-235 (end-to-end password login hardening), AXO-55 (production Auth password protections), AXO-160 (original implemented email/password login).
