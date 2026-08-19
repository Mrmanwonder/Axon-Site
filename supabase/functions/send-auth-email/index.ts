// Send Email Hook — Mastery's auth email.
//
// Supabase Auth calls this instead of sending the email itself, so the message a
// guardian receives is the one in this repository rather than one pasted into a
// dashboard and quietly edited later. It renders
// supabase/functions/send-auth-email/auth-email.html — the same file that can be
// pasted into the dashboard — and hands it to Resend.
//
// Wiring, once:
//   1. supabase secrets set RESEND_API_KEY=...  AUTH_EMAIL_FROM='Mastery <hello@your-domain>'
//   2. Authentication → Hooks → Send Email → this function. Copy the generated
//      secret into  supabase secrets set SEND_EMAIL_HOOK_SECRET=v1,whsec_...
//   3. Deploy with --no-verify-jwt. Auth authenticates with the webhook
//      signature, not a user JWT, so a JWT check here would reject every call.
//
// Until it is wired up, Supabase keeps sending its own mail from its own
// template, and nothing here runs.

import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

// Read once at cold start. A missing template is a hard failure, not something
// to paper over with a plain-text fallback: an email nobody designed is exactly
// the failure this function exists to remove.
const TEMPLATE = await Deno.readTextFile(new URL('./auth-email.html', import.meta.url));

/**
 * Copy per action type.
 *
 * All of these are the same gesture — prove you hold this address — so they
 * share one layout and differ only in the two lines at the top. `magiclink` is
 * what this app actually triggers; the rest are here so that turning on another
 * flow later cannot silently fall back to Supabase's default template.
 */
const COPY: Record<string, { subject: string; heading: string; intro: string }> = {
  magiclink: {
    subject: 'Your Mastery sign-in code',
    heading: 'Your sign-in code',
    intro: 'Enter this in Mastery to finish signing in. It works once, and expires in an hour.',
  },
  signup: {
    subject: 'Your Mastery sign-in code',
    heading: 'Confirm your email',
    intro: 'Enter this in Mastery to finish creating your account. It works once, and expires in an hour.',
  },
  invite: {
    subject: "You've been invited to Mastery",
    heading: 'Your invitation',
    intro: 'Enter this in Mastery to accept the invitation. It works once, and expires in an hour.',
  },
  recovery: {
    subject: 'Your Mastery sign-in code',
    heading: 'Sign in again',
    intro: 'Enter this in Mastery to get back into your account. It works once, and expires in an hour.',
  },
  email_change: {
    subject: 'Confirm your new email for Mastery',
    heading: 'Confirm this address',
    intro: 'Enter this in Mastery to move your account to this address. It works once, and expires in an hour.',
  },
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Replace the text inside the one element carrying this data-slot. */
function fillSlot(html: string, slot: string, text: string): string {
  const re = new RegExp(`(<([a-z0-9]+)[^>]*data-slot="${slot}"[^>]*>)([\\s\\S]*?)(</\\2>)`, 'i');
  return html.replace(re, (_m, open, _tag, _inner, close) => `${open}${escapeHtml(text)}${close}`);
}

function render(opts: {
  heading: string;
  intro: string;
  token: string;
  confirmationUrl: string;
  email: string;
}): string {
  let html = TEMPLATE;
  html = fillSlot(html, 'heading', opts.heading);
  html = fillSlot(html, 'intro', opts.intro);
  // The same Go-template placeholders the dashboard would fill, filled here.
  html = html
    .replaceAll('{{ .Token }}', escapeHtml(opts.token))
    .replaceAll('{{ .ConfirmationURL }}', escapeHtml(opts.confirmationUrl))
    .replaceAll('{{ .Email }}', escapeHtml(opts.email));
  return html;
}

/**
 * The plain-text alternative, which is not a courtesy.
 *
 * Some clients render it in preference to the HTML, and a few strip HTML mail
 * from unknown senders entirely. If this were missing, those readers would get
 * exactly the empty message this function was built to fix.
 */
function renderText(opts: { heading: string; intro: string; token: string; confirmationUrl: string; email: string }) {
  return [
    `Mastery — ${opts.heading}`,
    '',
    opts.intro,
    '',
    `    ${opts.token}`,
    '',
    'Or open this link on the device you want to be signed in on:',
    opts.confirmationUrl,
    '',
    'If the link has already been used, type the code instead — pasting the whole',
    'link into Mastery works too.',
    '',
    'Nobody from Mastery will ever ask you for this code.',
    '',
    `This was sent to ${opts.email} because someone asked to sign in to Mastery.`,
    'If that was not you, nothing has happened and no account has been changed.',
  ].join('\n');
}

function fail(status: number, message: string) {
  // The shape Supabase Auth expects, so the reason reaches the auth log rather
  // than becoming a generic 500 with nothing behind it.
  return new Response(JSON.stringify({ error: { http_code: status, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return fail(405, 'Method not allowed.');

  const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('AUTH_EMAIL_FROM');
  if (!hookSecret || !resendKey || !from) {
    return fail(500, 'send-auth-email is missing SEND_EMAIL_HOOK_SECRET, RESEND_API_KEY or AUTH_EMAIL_FROM.');
  }

  const payload = await req.text();

  // Verify before parsing. This endpoint runs without a JWT check, so the
  // signature is the only thing standing between it and anyone who finds the
  // URL — and an unverified body could name any address to mail a code to.
  let body: {
    user: { email: string };
    email_data: {
      token: string;
      token_hash: string;
      redirect_to: string;
      email_action_type: string;
      site_url?: string;
    };
  };
  try {
    const wh = new Webhook(hookSecret.replace(/^v1,\s*/, '').replace(/^whsec_/, ''));
    body = wh.verify(payload, Object.fromEntries(req.headers)) as typeof body;
  } catch (_e) {
    return fail(401, 'Signature did not verify.');
  }

  const { user, email_data: d } = body;
  const copy = COPY[d.email_action_type] ?? COPY.magiclink;

  // Supabase builds this URL itself for its own templates; from a hook we build
  // it. redirect_to is whatever the client passed as emailRedirectTo.
  const projectUrl = Deno.env.get('SUPABASE_URL') ?? d.site_url ?? '';
  const confirmationUrl =
    `${projectUrl}/auth/v1/verify` +
    `?token=${encodeURIComponent(d.token_hash)}` +
    `&type=${encodeURIComponent(d.email_action_type)}` +
    `&redirect_to=${encodeURIComponent(d.redirect_to ?? d.site_url ?? '')}`;

  const opts = { ...copy, token: d.token, confirmationUrl, email: user.email };

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [user.email],
      subject: copy.subject,
      html: render(opts),
      text: renderText(opts),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('resend rejected the message', res.status, detail);
    return fail(502, 'The sign-in email could not be sent. Try again in a moment.');
  }

  return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
});
