# Axon — steps only Tanmay can do (2026-10-02)

Do them in this order. Each step lists what to run, what you should see, and what to paste back. Steps 1–3 unblock most of what's left, so start there.

Answer the six decisions in `docs/claude_axon-decisions-2026-10-02.md` whenever you can. Step 7 depends on decision 1, and step 12 on decision 2.

---

### 1. Apply the database migrations (unblocks AXO-116, 54, 57, 121)

**Simplest path, now that `migrate.yml` is on `main`:**
1. Add the repository secret `SUPABASE_DB_URL` under GitHub → Axon-Site → Settings → Secrets → Actions. The value comes from Supabase Dashboard → Connect → "Session pooler", `postgres` role.
2. Run **Actions → Apply migrations → Run workflow** with dry run checked.

Expect exactly five files: `…180000_axo_116…`, `…181000_axo_54…`, `…183000_axo_57…`, `…191000_learning_review_signals`, `…02090000_reconcile_live_drift`. Then merge Axon-Site#165, which runs it for real, or re-run with dry run unchecked.

**Paste back:** the run URL.

**CLI alternative:**

The agent's apply tool timed out twice, and nothing was applied. The full procedure, with expected output and rollback, is in `docs/claude_migration-ledger-2026-10-02.md` under "Apply procedure". In short, from an up-to-date `main` after Axon-Site#165 and #166 are merged:

```bash
supabase link --project-ref dlgcqieyevoebefhcggi
supabase migration repair --status applied 20261001164100 20261001170000 20261001180500 20261001190000
supabase migration list
supabase db push --include-all --dry-run   # expect exactly 5: …180000 …181000 …183000 …191000 …02090000
supabase db push --include-all
```

**Paste back:** the `migration list` output and the `db push` output.

**Do not** merge axon-backend#143 before this. Its deploy writes a column that only this migration creates.

---

### 2. Merge axon-backend#143 (deploys the AXO-116 structure fix)

Merge it after step 1 succeeds. The push to `main` runs the deploy workflow.

**Expected:** the GitHub Actions `deploy` job is green.

**Paste back:** the run URL.

---

### 3. Retry the 14-page paper (AXO-116, unblocks AXO-70)

Open Library, then the 14-page paper that kept losing pages, then **Try again**. Wait for processing to finish.

**Expected:**
- all 14 pages structured, with no "could not read this page" on a readable page;
- a question that continues over a page break shows both page bands.

**Paste back:** "done" and the time. The agent then verifies from the database and logs (pages, spans, 23505 count, success rate on recent runs) and records it on AXO-116.

---

### 4. Supabase dashboard: auth hardening (AXO-55)

- **Authentication → Providers → Email:**
  - **Leaked password protection:** on.
  - **Minimum password length:** 12.

**Paste back:** a screenshot of the setting, or just "done". The agent re-probes signup with a known-leaked password and expects `weak_password`.

---

### 5. Postgres 17.6 → 17.11 (AXO-112), after step 1

Follow `docs/claude_postgres-17-11-upgrade-runbook-2026-10-01.md`:
- **Where:** Settings → Infrastructure → Upgrade.
- **When:** in the measured low-traffic window, 19:00–22:00 UTC.

**Expected:** a few minutes of downtime, then the project reports 17.11.

**Paste back:** the start and end times. The agent runs the runbook's post-checks.

---

### 6. Revoke the share link you used for the Share check (AXO-89 / AXO-105)

From the paper's **Share** sheet, choose **Stop sharing**, or let it expire.

The agent has never seen the link or token and didn't store them.

**Paste back:** "revoked".

---

### 7. Tutor go-live, internal only (AXO-126, AXO-35), after decision 1

Runbook: `docs/claude_tutor-deploy-runbook-2026-10-01.md` in axon-backend.

**If you choose 1A (Vertex):** the agent first adds the Vertex credentials step, and `GOOGLE_API_KEY` below becomes the Vertex service-account secret.

```bash
cd workers/intelligence
npx wrangler secret put GOOGLE_API_KEY       --env tutor
npx wrangler secret put SUPABASE_SECRET_KEY  --env tutor
npx wrangler secret put TAVILY_API_KEY       --env tutor
npx wrangler secret put AXON_ADMIN_TOKEN     --env tutor   # random 32+ bytes
npx wrangler secret put AXON_PSEUDONYM_KEY   --env tutor   # random 32+ bytes
npx wrangler secret put AXON_INTERNAL_TOKEN  --env tutor   # random 32+ bytes
cd ../api
npx wrangler secret put AXON_INTERNAL_TOKEN                # same value as above
npx wrangler secret put TUTOR_INTERNAL_USERS               # your own auth user id
```

Then set these under GitHub → axon-backend → Settings → Variables:
- `TUTOR_DEPLOY_ENABLED=true`
- `TUTOR_ROLLOUT=internal`

Re-run the deploy workflow on `main`.

**Expected:**
- the `deploy-intelligence-tutor` job is green;
- `/tutor` answers for your account only, and returns 503 "not available yet" for everyone else.

**Paste back:** the run URL. The agent runs the internal smoke test and the provenance call.

---

### 8. CBSE Class X Mathematics ingest (AXO-34, AXO-12)

From axon-backend `main`, with `pdftotext` (poppler-utils) installed. Run it first without `--write`, which is a dry run:

```bash
SUPABASE_URL=https://dlgcqieyevoebefhcggi.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service key> \
  npm run schemes:cbse -- ingest --class=10 --subject=Mathematics
SUPABASE_URL=https://dlgcqieyevoebefhcggi.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service key> \
  npm run schemes:cbse -- ingest --class=10 --subject=Mathematics --write
```

**Expected:** `"failures": []`. The parser drops the mis-parsed Q36 against the section plan, so it is not ingested.

**Paste back:** the JSON summary only (counts, not the scheme text).

---

### 9. IB catalogue check (AXO-26)

1. Download the IBO "All DP subjects" PDF from ibo.org.
2. In Axon-Site, run:

```bash
AXON_IB_CATALOG_PDF=/path/to/all-dp-subjects.pdf npm run curriculum:check
```

**Paste back:** the summary line.

---

### 10. Subject expert review (AXO-40, AXO-41)

A subject teacher confirms or fixes:
- the 60 academic cases in `workers/intelligence/evals/drafts/axo40-tutor-golden-v0.1-draft.json` (20 Cambridge, 20 CBSE, 20 IBDP);
- the eval labels once the corpus review sheet is ready.

Every proposed label is marked `unreviewed`. The reviewer only confirms or fixes.

**Paste back:** the reviewer's name and the date. The agent then runs the evals and records the results. No accuracy claim is made before this.

---

### 11. Real-device rounds (AXO-45–48, 11, 68–71, 23, 114)

Follow `docs/claude_release-acceptance-matrix-2026-10-01.md`:
- **B1:** release smoke on each device, in light, dark and Reduce motion.
- **B2:** scan → review → commit. Only after step 3.
- **B3:** the scanner acquisition matrix, recorded with `node bench/scanner-reliability.mjs trials.json`.

Also:
- a scanner CPU profile on one mid/low Android and one iPhone (Chrome DevTools remote → Performance, and Safari Web Inspector → Timelines), recorded during lock;
- the AXO-114 shutter-before-lock script;
- upload the IMG_5105.MP4 frames to AXO-114;
- the legal pages in dark mode on a real phone;
- a check of the private-draft social feed.

**Paste back:** the filled results table and the `trials.json` summary.

---

### 12. Guardian provider (AXO-59), after decision 2

1. Create the sandbox account with the chosen provider (DigiLocker if 2b = yes).
2. Give the agent the sandbox credentials as worker secrets, never in chat:

```bash
cd workers/api
npx wrangler secret put GUARDIAN_VERIFICATION_PROVIDER          # e.g. digilocker
npx wrangler secret put GUARDIAN_VERIFICATION_WEBHOOK_SECRET    # 32+ bytes from the provider
```

3. After the agent's adapter and sandbox tests pass, run one live verification on your own account.

**Paste back:** "done" and the time. The agent confirms that exactly one `guardian.verified_at` was set, and by which method.

---

### 13. Counsel review (AXO-27, AXO-73–76)

Send counsel:
- `docs/claude/claude_legal-claims-audit-2026-10-01.md`;
- the proposed patch `docs/claude/claude_legal-proposed-copy-edits-2026-10-01.patch`;
- decision 1's correction.

Nothing is published before counsel signs off, and no publication date is set.

**Paste back:** counsel's sign-off, or their edits.

---

### 14. Audit routine connectors (AXO-24)

1. Open claude.ai → Routines, then the audit routine (`trig_015cdGUoTVgsgY6yTFkEGryE`).
2. Attach the **Linear**, **Supabase** and **GitHub** connectors.
3. Enable the routine, then **Run now** once.

**Paste back:** the run link.
