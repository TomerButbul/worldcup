import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { primaryPredictionLeague } from "@/lib/predictionSync";

const SANDBOX = "00000000-0000-4000-8000-000000000001";

// League-agnostic deep link to a match centre — used by the live-scores widget,
// which knows a match id but not a league. Resolves the viewer's canonical
// prediction league and redirects to /leagues/<id>/matches/<matchId>. Sentinel
// test fixtures (id >= 9M) live only in the private Sandbox league.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { origin } = new URL(request.url);
  // Behind Vercel's proxy the request origin is internal; trust x-forwarded-host in
  // production so we redirect to the real public URL (mirrors auth/callback, /join).
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocal = process.env.NODE_ENV === "development";
  const base = isLocal ? origin : forwardedHost ? `https://${forwardedHost}` : origin;

  const matchId = Number(id);
  if (!Number.isInteger(matchId)) return NextResponse.redirect(`${base}/dashboard`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${base}/signup`);

  if (matchId >= 9_000_000) {
    return NextResponse.redirect(`${base}/leagues/${SANDBOX}/matches/${matchId}`);
  }

  const league = await primaryPredictionLeague(supabase, user.id);
  if (!league) return NextResponse.redirect(`${base}/dashboard`);
  return NextResponse.redirect(`${base}/leagues/${league.id}/matches/${matchId}`);
}
