// Turns SUPABASE_DB_URL into PG* variables for psql, and lists every piece of it
// that must never reach a log. Pure, so it is unit-tested without a database.
// See apply.mjs for why the URI is never passed to psql directly.

export function connectionEnv(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("SUPABASE_DB_URL is not a valid URL. Percent-encode any @ : / ? # in the password (encodeURIComponent).");
  }
  if (!/^postgres(ql)?:$/.test(u.protocol) || !u.hostname || !u.username) {
    throw new Error("SUPABASE_DB_URL must look like postgresql://USER:PASSWORD@HOST:PORT/DATABASE.");
  }
  const password = decodeURIComponent(u.password);
  return {
    PGHOST: u.hostname,
    PGPORT: u.port || "5432",
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: password,
    PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, "")) || "postgres",
    PGSSLMODE: u.searchParams.get("sslmode") || "require",
  };
}

/** Everything in the secret that must never reach a log, including fragments. */
export function secretFragments(raw, env) {
  const parts = new Set([raw, env.PGPASSWORD, encodeURIComponent(env.PGPASSWORD)]);
  for (const piece of `${env.PGPASSWORD}`.split(/[@:/?#]/)) if (piece.length >= 4) parts.add(piece);
  return [...parts].filter((p) => p && p.length >= 4);
}

export function redact(text, fragments) {
  let out = text;
  for (const f of [...fragments].sort((a, b) => b.length - a.length)) out = out.split(f).join("***");
  return out;
}
