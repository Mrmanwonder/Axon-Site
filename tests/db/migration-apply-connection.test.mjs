import { test } from "node:test";
import assert from "node:assert/strict";
import { connectionEnv, redact, secretFragments } from "../../scripts/migrations/connection.mjs";

// Synthetic credentials only.
const PASSWORD = "s3cret@part-two:x";
const encoded = `postgresql://postgres.ref:${encodeURIComponent(PASSWORD)}@aws-0-example.pooler.supabase.com:5432/postgres`;

test("an encoded URL becomes PG* variables with the password decoded", () => {
  const env = connectionEnv(encoded);
  assert.equal(env.PGHOST, "aws-0-example.pooler.supabase.com");
  assert.equal(env.PGPORT, "5432");
  assert.equal(env.PGUSER, "postgres.ref");
  assert.equal(env.PGPASSWORD, PASSWORD);
  assert.equal(env.PGDATABASE, "postgres");
  assert.equal(env.PGSSLMODE, "require");
});

test("a malformed URL fails with a message that contains no part of it", () => {
  const raw = "not a url with s3cretvalue in it";
  assert.throws(() => connectionEnv(raw), (e) => !e.message.includes("s3cretvalue") && /Percent-encode/.test(e.message));
  assert.throws(() => connectionEnv("https://user:pw@host/db"), /postgresql:\/\//);
});

test("every fragment of the password is redacted, including the pieces around a raw @", () => {
  const env = connectionEnv(encoded);
  const fragments = secretFragments(encoded, env);
  // The failure seen in run 37031953032: psql printed the part of the password
  // after an unencoded "@" as if it were the host.
  const stderr = `psql: error: could not translate host name "part-two:x@aws-0-example.pooler.supabase.com" to address; password s3cret@part-two:x`;
  const out = redact(stderr, fragments);
  for (const piece of ["s3cret", "part-two", PASSWORD]) assert.ok(!out.includes(piece), `leaked ${piece}: ${out}`);
  assert.ok(out.includes("aws-0-example.pooler.supabase.com"));
});
