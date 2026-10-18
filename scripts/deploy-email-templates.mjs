// Deploy the three versioned Supabase Auth emails through the Management API.
// The database URL / service role key cannot authorize this API: use a
// Management API personal access token with auth config read/write permissions.
// This script never logs the token, fetched live config or rendered email HTML.
import { readFileSync, appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const PROJECT_REF = 'dlgcqieyevoebefhcggi';
export const TEMPLATES = Object.freeze([
  {
    file: 'magic_link.html',
    content: 'mailer_templates_magic_link_content',
    subject: 'mailer_subjects_magic_link',
    subjectText: '{{ .Token }} is your Axon verification code',
    required: ['{{ .Token }}'],
  },
  {
    file: 'confirmation.html',
    content: 'mailer_templates_confirmation_content',
    subject: 'mailer_subjects_confirmation',
    subjectText: '{{ .Token }} is your Axon verification code',
    required: ['{{ .Token }}'],
  },
  {
    file: 'recovery.html',
    content: 'mailer_templates_recovery_content',
    subject: 'mailer_subjects_recovery',
    subjectText: 'Reset your Axon password',
    required: ['{{ .SiteURL }}', '{{ .TokenHash }}', 'type=recovery'],
  },
]);

export function validateHtml(file, html, required) {
  if (typeof html !== 'string' || html.length < 500 || html.length > 100_000) {
    throw new Error(`${file}: missing, truncated, or unexpectedly large HTML`);
  }
  for (const fragment of ['<!doctype html>', '<html', '</html>', '<head>', '</head>', '<body', '</body>', ...required]) {
    if (!html.includes(fragment)) throw new Error(`${file}: missing required markup or auth placeholder ${fragment}`);
  }
  if (html.includes('${FONT}') || html.includes('<script')) {
    throw new Error(`${file}: unexpected unrendered interpolation or script tag`);
  }
}

export function buildExpected(readFile = readFileSync) {
  const expected = {};
  for (const template of TEMPLATES) {
    const url = new URL(`../supabase/templates/${template.file}`, import.meta.url);
    const html = readFile(url, 'utf8');
    validateHtml(template.file, html, template.required);
    expected[template.content] = html;
    expected[template.subject] = template.subjectText;
  }
  return expected;
}

export function changedFields(actual, expected) {
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) {
    throw new Error('Supabase returned an unexpected auth config response');
  }
  const changed = {};
  for (const [field, desired] of Object.entries(expected)) {
    if (!Object.hasOwn(actual, field)) {
      throw new Error(`Supabase auth config did not expose ${field}; refusing to overwrite blindly`);
    }
    if (actual[field] !== desired) changed[field] = desired;
  }
  return changed;
}

function requireSyncedGeneratedFiles() {
  const generator = fileURLToPath(new URL('./build-email-templates.mjs', import.meta.url));
  const check = spawnSync(process.execPath, [generator, '--check'], { encoding: 'utf8' });
  if (check.error || check.status !== 0) {
    throw new Error('Generated email templates are out of sync. Run node scripts/build-email-templates.mjs before publishing.');
  }
}

async function apiRequest(method, token, body) {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    let response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      if (attempt === 3) throw new Error(`Supabase Management API network request failed (${error.name})`);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      continue;
    }
    if ([429, 502, 503, 504].includes(response.status) && attempt < 3) {
      await response.arrayBuffer(); // drain the response without logging secrets
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      continue;
    }
    if (!response.ok) {
      // The API can echo auth configuration. Never print the response body.
      const access = [401, 403].includes(response.status) ? ' Check the Management API token and auth_config_read/auth_config_write permissions.' : '';
      throw new Error(`Supabase Management API ${method} returned HTTP ${response.status}.${access}`);
    }
    const responseText = await response.text();
    if (!responseText) return null;
    try { return JSON.parse(responseText); }
    catch { throw new Error(`Supabase Management API ${method} returned invalid JSON`); }
  }
  throw new Error('Supabase Management API retries exhausted');
}

function summary(lines) {
  const text = lines.join('\n') + '\n';
  process.stdout.write(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
}

export async function run({ dryRun = false, validateOnly = false, token = process.env.SUPABASE_ACCESS_TOKEN } = {}) {
  requireSyncedGeneratedFiles();
  const expected = buildExpected();
  if (validateOnly) {
    summary(['### Auth email templates validated', 'All three HTML files match the generator and retain their auth placeholders.']);
    return { validated: true };
  }
  if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is missing (Supabase Management API token, not database URL or service-role key).');
  // A fixed, public project ref prevents accidental deployments to another project.
  if (process.env.SUPABASE_PROJECT_REF && process.env.SUPABASE_PROJECT_REF !== PROJECT_REF) {
    throw new Error('SUPABASE_PROJECT_REF does not match Axon production; refusing to deploy');
  }
  const current = await apiRequest('GET', token);
  const patch = changedFields(current, expected);
  const keys = Object.keys(patch);
  if (keys.length === 0) {
    summary(['### Supabase Auth email templates', 'Already synchronized; no changes made.']);
    return { changed: [], dryRun };
  }
  if (dryRun) {
    summary(['### Supabase Auth email template dry run', 'No changes made.', ...keys.map(key => `- Would update \`${key}\``)]);
    return { changed: keys, dryRun: true };
  }
  // PATCH only the changed fields; do not send unrelated auth or SMTP settings.
  await apiRequest('PATCH', token, patch);
  // Success from PATCH is insufficient; independently read and compare.
  const after = await apiRequest('GET', token);
  const mismatch = Object.keys(changedFields(after, expected));
  if (mismatch.length) throw new Error(`Supabase did not retain expected values for: ${mismatch.join(', ')}`);
  summary(['### Supabase Auth email templates published', 'Read-back verification passed.', ...keys.map(key => `- Updated \`${key}\``)]);
  return { changed: keys, dryRun: false };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL('file://' + process.argv[1]));
if (isMain) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !['--validate', '--dry-run', '--deploy'].includes(args[0])) {
    console.error('Usage: node scripts/deploy-email-templates.mjs --validate | --dry-run | --deploy');
    process.exitCode = 2;
  } else {
    run({ validateOnly: args[0] === '--validate', dryRun: args[0] === '--dry-run' })
      .catch(error => { console.error(error.message); process.exitCode = 1; });
  }
}
