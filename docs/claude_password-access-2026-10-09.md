# AXO-160 password access — 9 October 2026

Account access now offers email/password beside Google and email/phone OTP. The password route provides sign-in, sign-up, forgot-password and a separate PASSWORD_RECOVERY view. New credentials use new-password autocomplete and confirmation; current credentials use current-password. Every password field provides a labelled show/hide control and 44px targets. Provider errors are mapped to generic account-neutral copy.

Password proof is obtained with a non-persistent client before a matching session is installed. Parent Mode derives the email and UID from the current Supabase session and rejects a different returned UID, email, or a sign-out/account switch while proof is in flight. The existing database AMR boundary remains authoritative. Passwords are not persisted by application code; forms clear them on completion/mode change and sheets clear them on dismissal/completion.

Recovery events are captured before React boot so URL initialization cannot lose the PASSWORD_RECOVERY event. The recovery view takes precedence over the app/onboarding gate. updateUser preserves the existing auth UID; guardian upserts continue to use the unique auth_user_id key. Supabase's verified-email identity linking remains the provider authority; this patch does not fabricate a Google identity or declare a mocked Google round trip successful.

## Verification

- Focused helper tests: generic provider errors, confirmation/obfuscated signup parity, exact principal installation, password validation, recovery identity, Parent Mode account-switch races.
- Component tests: single-flight submissions, credential disposal, confirmation does not advance, reset copy and recovery retry.
- Chromium/WebKit component browser fixtures: password and recovery controls, autocomplete, show/hide, axe and target geometry. These are UI fixtures, not real provider evidence.
- SQL CI starts the actual loopback Supabase/GoTrue stack. A dedicated script refuses remote hosts and creates only disposable @example.test credentials. It checks signup/sign-in, server-issued password AMR, repeated guardian upsert identity, account-neutral reset HTTP status, a real recovery token/update, changed-password sign-in and cleanup.

## Remaining acceptance gates

No agent creates production accounts or enters real credentials. The actual Google + password same verified email linking round trip still requires the owner's approved provider/local redirect setup. Production email confirmation, minimum-length policy and leaked-password protection remain dashboard evidence under AXO-55. Privacy/Terms now name the supported methods; counsel review remains AXO-75. No dashboard/auth configuration or production database changes are included.
