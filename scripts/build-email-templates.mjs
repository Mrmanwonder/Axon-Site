// Builds the Supabase Auth email templates from one source so the three emails
// cannot drift apart. Run: node scripts/build-email-templates.mjs
//
// Email clients run no JavaScript, so a code can never copy itself on a click.
// What an email can do is make the code easy to take: one unbroken token (a
// double-tap or double-click selects all of it), large type, the code in the
// subject and preheader (Gmail and phone lock screens read those and offer their
// own "Copy code" action), and a button that signs in with no code at all.
//
// Colour: dark, to match the app. No red anywhere. No images, so nothing is
// blocked or tracked, and no remote fonts.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const out = new URL('../supabase/templates/', import.meta.url);
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace";

const shell = ({ preheader, heading, lead, body, note, footer }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:#070A12;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#070A12;font-size:1px;line-height:1px;">${preheader}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#070A12;">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
    <tr><td style="padding:0 4px 20px 4px;font-family:${FONT};">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="26" height="26" align="center" valign="middle" style="background:#2E74E8;border-radius:8px;color:#ffffff;font-family:${FONT};font-size:15px;font-weight:700;line-height:26px;">A</td>
        <td style="padding-left:10px;font-family:${FONT};font-size:16px;font-weight:600;letter-spacing:-0.01em;color:#F4F6FB;">Axon</td>
      </tr></table>
    </td></tr>
    <tr><td style="background:#0E1424;border:1px solid #1D2640;border-radius:20px;padding:32px 28px;font-family:${FONT};">
      <h1 style="margin:0 0 10px 0;font-family:${FONT};font-size:26px;line-height:1.2;font-weight:650;letter-spacing:-0.03em;color:#F4F6FB;">${heading}</h1>
      <p style="margin:0 0 24px 0;font-family:${FONT};font-size:15px;line-height:1.55;color:#A9B3CC;">${lead}</p>
${body}
      <p style="margin:24px 0 0 0;font-family:${FONT};font-size:13px;line-height:1.55;color:#8993AD;">${note}</p>
    </td></tr>
    <tr><td style="padding:20px 8px 0 8px;font-family:${FONT};font-size:12px;line-height:1.6;color:#6C7691;">${footer}</td></tr>
  </table>
</td></tr>
</table>
</body>
</html>
`;

const button = (label, href = '{{ .ConfirmationURL }}') => `      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        <td align="center" style="background:#3A86FF;border-radius:14px;">
          <a href="${href}" style="display:block;padding:16px 20px;font-family:${FONT};font-size:16px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;">${label}</a>
        </td>
      </tr></table>`;

// The code sits in the same blue block as the reset button, so the three emails
// read as one family. Plain digits (no spaced-out styling) and a plain sentence
// naming the code give Gmail's own detector the best chance of offering its
// "Copy code" chip; nothing in an email can force it.
const code = `      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        <td align="center" style="background:#3A86FF;border-radius:14px;padding:18px 12px;">
          <span style="display:block;font-family:${MONO};font-size:32px;line-height:1.1;font-weight:700;letter-spacing:0.06em;color:#ffffff;-webkit-user-select:all;user-select:all;">{{ .Token }}</span>
        </td>
      </tr></table>
      <p style="margin:12px 0 0 0;font-family:${FONT};font-size:13px;line-height:1.5;color:#8993AD;text-align:center;">Double-tap the code to select it, then copy.</p>`;

const safety = "Did not ask for this? You can ignore this email, and nobody can sign in without it. Axon will never ask you for this code by phone, message or email.";
const footer = "Axon turns a marked paper into feedback a student can act on.<br>You are receiving this because someone entered this email address at Axon.";

const templates = {
  'magic_link.html': shell({
    preheader: 'Your Axon sign-in code is {{ .Token }}. It works once and expires soon.',
    heading: 'Your sign-in code',
    lead: 'Your Axon verification code is {{ .Token }}. Enter it in Axon to sign in. It works once and expires soon.',
    body: code, note: safety, footer,
  }),
  'confirmation.html': shell({
    preheader: 'Your Axon code is {{ .Token }}. Enter it to confirm this email address.',
    heading: 'Confirm your email',
    lead: 'Your Axon verification code is {{ .Token }}. Enter it to confirm this email address and finish creating your account.',
    body: code, note: safety, footer,
  }),
  'recovery.html': shell({
    preheader: 'Choose a new password for your Axon account.',
    heading: 'Reset your password',
    lead: 'Use the button below to choose a new password. Open it on the device where you started, and it works once.',
    // The page exchanges the token itself, so a mail scanner that only fetches the
    // URL cannot use up the one-time link before the person taps it.
    body: button('Choose a new password', '{{ .SiteURL }}/?token_hash={{ .TokenHash }}&type=recovery'),
    note: 'Did not ask for this? You can ignore this email and your password stays as it is.',
    footer,
  }),
};

mkdirSync(out, { recursive: true });
for (const [name, html] of Object.entries(templates)) writeFileSync(new URL(name, out), html);
console.log('wrote', Object.keys(templates).map(n => fileURLToPath(new URL(n, out))).join('\n      '));
