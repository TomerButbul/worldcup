// One-off: mint N credential-less anonymous players via the app's OWN guest flow
// (supabase.auth.signInAnonymously — the same call behind the "Play for free"
// button), then print their user-ids. No email, no password, no service role:
// just the public anon key. Profile name/avatar/visibility are set separately.
//
//   node scripts/seed-mascots.mjs [count]
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY in .env.local");
  process.exit(1);
}

const count = Number(process.argv[2] ?? 3);
const ids = [];
for (let i = 0; i < count; i++) {
  // Fresh client per call → a brand-new anonymous session each time.
  const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.signInAnonymously();
  if (error) {
    console.error("signInAnonymously failed:", error.message);
    process.exit(1);
  }
  ids.push(data.user.id);
}
console.log(ids.join("\n"));
