#!/usr/bin/env node
// Run Supabase migrations as part of the build pipeline.
//
// Auth: uses SUPABASE_DB_URL — a project-scoped Postgres connection string,
// not a personal access token. Generate it from:
//   Supabase Dashboard → Project Settings → Database → Connection string
//   Pick "Session pooler" (port 5432) so DDL works.
//
// Locally: skipped unless SUPABASE_DB_URL is set in env.
// Vercel:  set SUPABASE_DB_URL as a project env var (no NEXT_PUBLIC_ prefix).
//
// Idempotent — `db push` only applies migrations not yet recorded in
// supabase_migrations.schema_migrations.

const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const DB_URL = process.env.SUPABASE_DB_URL;
const ON_VERCEL = !!process.env.VERCEL;
// VERCEL_ENV is "production" | "preview" | "development".
// Preview builds don't have DB access; skip migrations there so the build
// still succeeds. Production must always have SUPABASE_DB_URL set or fail loud.
const VERCEL_ENV = process.env.VERCEL_ENV;
const IS_PROD_TARGET = ON_VERCEL && VERCEL_ENV === "production";

if (!DB_URL) {
  if (IS_PROD_TARGET) {
    // On Vercel SUPABASE_DB_URL must be set for prod — silently skipping
    // caused a migration to ship to prod without applying for ~one deploy
    // cycle. Fail the build instead so it's caught immediately.
    console.error(
      "[migrate] SUPABASE_DB_URL is missing on Vercel (production).\n" +
        "        Set it under Project Settings → Environment Variables\n" +
        "        (Session-pooler connection string from Supabase, port 5432)."
    );
    process.exit(1);
  }
  if (ON_VERCEL) {
    console.log(
      `[migrate] SUPABASE_DB_URL not set — skipping migrations (Vercel ${VERCEL_ENV ?? "preview"} build)`
    );
  } else {
    console.log("[migrate] SUPABASE_DB_URL not set — skipping migrations (local build)");
  }
  process.exit(0);
}

// Find the supabase CLI binary.
const cliCandidates = [
  path.join(process.cwd(), "node_modules", ".bin", "supabase"),
  path.join(process.cwd(), "node_modules", "supabase", "bin", "supabase"),
];
const cli = cliCandidates.find(fs.existsSync);
if (!cli) {
  console.error(`[migrate] supabase CLI not found in ${cliCandidates.join(" or ")}`);
  process.exit(1);
}

console.log("[migrate] applying pending migrations…");
const push = spawnSync(
  cli,
  ["db", "push", "--include-all", "--db-url", DB_URL],
  { stdio: "inherit", input: "y\n" }
);
if (push.status !== 0) {
  console.error(`[migrate] supabase db push failed (exit ${push.status})`);
  process.exit(push.status ?? 1);
}
console.log("[migrate] done.");
