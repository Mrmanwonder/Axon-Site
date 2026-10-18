import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROJECT_REF,
  TEMPLATES,
  buildExpected,
  changedFields,
  validateHtml,
} from '../scripts/deploy-email-templates.mjs';

test('target is fixed to the known Axon production project', () => {
  assert.equal(PROJECT_REF, 'dlgcqieyevoebefhcggi');
});

test('only the three expected auth email slots and subjects are configured', () => {
  assert.deepEqual(TEMPLATES.map(x => x.file), ['magic_link.html', 'confirmation.html', 'recovery.html']);
  const result = buildExpected();
  assert.equal(Object.keys(result).length, 6);
  assert.equal(result.mailer_subjects_magic_link, '{{ .Token }} is your Axon verification code');
  assert.equal(result.mailer_subjects_confirmation, '{{ .Token }} is your Axon verification code');
  assert.equal(result.mailer_subjects_recovery, 'Reset your Axon password');
  assert.ok(result.mailer_templates_magic_link_content.includes('{{ .Token }}'));
  assert.ok(result.mailer_templates_confirmation_content.includes('{{ .Token }}'));
  assert.ok(result.mailer_templates_recovery_content.includes('{{ .TokenHash }}'));
});

test('fails closed on missing OTP and password recovery placeholders', () => {
  const result = buildExpected();
  assert.throws(() => validateHtml('magic_link.html', result.mailer_templates_magic_link_content.replaceAll('{{ .Token }}', ''), ['{{ .Token }}']), /missing required/);
  assert.throws(() => validateHtml('recovery.html', result.mailer_templates_recovery_content.replace('{{ .TokenHash }}', ''), ['{{ .TokenHash }}']), /missing required/);
  assert.throws(() => validateHtml('recovery.html', result.mailer_templates_recovery_content.replace('<html', '<script>x</script><html'), ['{{ .TokenHash }}']), /script tag/);
});

test('idempotent diff writes only changed known fields, never unrelated auth settings', () => {
  const desired = buildExpected();
  const current = { ...desired, jwt_exp: 3600, external_google_enabled: true };
  assert.deepEqual(changedFields(current, desired), {});
  const changed = { ...current, mailer_templates_magic_link_content: 'old' };
  assert.deepEqual(changedFields(changed, desired), { mailer_templates_magic_link_content: desired.mailer_templates_magic_link_content });
  assert.throws(() => changedFields({}, desired), /did not expose/);
  assert.throws(() => changedFields(null, desired), /unexpected auth config/);
});
