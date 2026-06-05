import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getInvitePreview } from "@/lib/invite";
import { acceptInvite } from "./actions";
import Trophy from "@/components/art/Trophy";

// The invite landing page. Replaces the old redirect-only route handler so a shared
// /join/<code> link gets a real HTML page with per-league OG tags (see
// generateMetadata + the colocated opengraph-image). It also sells the join with
// social proof + lock urgency instead of bouncing straight to sign-up. The actual
// join/cookie work happens in the acceptInvite Server Action (./actions.ts).
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ code: string }> };

// World Cup 2026 opener / bracket-lock fallback when a league has no explicit lock.
const DEFAULT_LOCK_MS = Date.parse("2026-06-11T19:00:00Z");

function lockLine(lockAt: string | null): { date: string; rel: string | null } {
  const ms = lockAt ? Date.parse(lockAt) : DEFAULT_LOCK_MS;
  const date = new Date(ms).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const days = Math.ceil((ms - Date.now()) / 86_400_000);
  const rel = days > 1 ? `in ${days} days` : days === 1 ? "tomorrow" : days === 0 ? "today" : null;
  return { date, rel };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { code } = await params;
  const league = await getInvitePreview(code);
  if (!league) {
    return {
      title: "League invite",
      description:
        "Join a free World Cup 2026 prediction league — build your bracket, call every match and compete with friends.",
      robots: { index: false },
    };
  }
  const who = league.memberCount === 1 ? "1 manager is" : `${league.memberCount} managers are`;
  const title = `Join “${league.name}”`;
  const description = `${who} predicting the 2026 World Cup in “${league.name}”. Build your bracket, call every match and goal scorer, and climb the live leaderboard. Free to play.`;
  return {
    title,
    description,
    // The image comes from the colocated opengraph-image.tsx (file-based metadata
    // wins), so we only set the words here.
    openGraph: { title: `${title} · World Cup 2026`, description, type: "website" },
    twitter: { card: "summary_large_image", title: `${title} · World Cup 2026`, description },
    robots: { index: false }, // invite links are for direct sharing, not search
  };
}

export default async function JoinPage({ params }: Params) {
  const { code } = await params;
  const league = await getInvitePreview(code);

  if (!league) {
    return (
      <main className="mx-auto flex min-h-[80vh] w-full max-w-md flex-1 flex-col items-center justify-center p-6 text-center">
        <div className="glass-strong w-full rounded-3xl p-8">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-night/10 text-3xl">🔗</div>
          <h1 className="font-display text-2xl text-chalk">This invite link is invalid</h1>
          <p className="mt-2 text-sm text-chalk-dim">
            It may have been mistyped, or the league was removed. You can still jump in and start
            your own bracket.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold text-night bg-gradient-to-b from-gold-bright to-gold glow-gold shine transition hover:brightness-105"
          >
            Explore World Cup 2026 →
          </Link>
        </div>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let isMember = false;
  if (user) {
    const { data: m } = await supabase
      .from("league_members")
      .select("user_id")
      .eq("league_id", league.id)
      .eq("user_id", user.id)
      .maybeSingle();
    isMember = !!m;
  }

  const { date, rel } = lockLine(league.lockAt);
  const isDraft = league.kind === "draft";
  const eyebrow = league.ownerName ? `${league.ownerName} invited you to` : "You’re invited to";
  const dots = Math.min(5, Math.max(1, league.memberCount));
  const joinLabel = user ? "Join this league →" : "Join free — pick your bracket →";
  const memberLabel = `✓ You’re in — open ${league.name} →`;

  return (
    <main className="relative mx-auto flex min-h-[88vh] w-full max-w-md flex-1 flex-col items-center justify-center p-5 sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-10 h-56 w-56 -translate-x-1/2 rounded-full bg-gold/20 blur-3xl"
      />

      <div className="glass-strong relative w-full overflow-hidden rounded-[28px] p-7 text-center sm:p-8">
        {/* brand */}
        <div className="mb-6 flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-[#ffd970] to-[#f6c453] text-base">
            ⚽
          </span>
          The 2026 Prediction Game
        </div>

        <div className="flex justify-center">
          <Trophy size={52} />
        </div>

        <p className="mt-4 text-sm font-medium text-chalk-dim">{eyebrow}</p>
        <h1 className="mt-1 font-display text-[28px] leading-tight text-gradient-gold sm:text-3xl">
          {league.name}
        </h1>
        {isDraft && (
          <span className="mt-2 inline-block rounded-full bg-night/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-chalk-dim">
            Draft league
          </span>
        )}

        {/* social proof */}
        <div className="mt-5 flex items-center justify-center gap-2.5">
          <div className="flex -space-x-2">
            {Array.from({ length: dots }).map((_, i) => (
              <span
                key={i}
                className="h-6 w-6 rounded-full border-2 border-white/40 bg-gradient-to-br from-[#ffd970] to-[#f6c453]"
              />
            ))}
          </div>
          <span className="text-sm font-semibold text-chalk">
            {league.memberCount} {league.memberCount === 1 ? "manager" : "managers"} playing
          </span>
        </div>

        {/* lock urgency */}
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-night/[0.06] px-3 py-1.5 text-xs font-semibold text-chalk-dim">
          🔒 Picks lock {date}
          {rel ? ` · ${rel}` : ""}
        </div>

        {/* CTA */}
        <div className="mt-6">
          {isMember ? (
            <Link
              href={`/leagues/${league.id}`}
              className="flex min-h-12 w-full items-center justify-center rounded-2xl px-5 text-base font-bold text-night bg-gradient-to-b from-gold-bright to-gold glow-gold shine transition hover:brightness-105"
            >
              {memberLabel}
            </Link>
          ) : (
            <form action={acceptInvite}>
              <input type="hidden" name="code" value={code} />
              <button
                type="submit"
                className="flex min-h-12 w-full items-center justify-center rounded-2xl px-5 text-base font-bold text-night bg-gradient-to-b from-gold-bright to-gold glow-gold shine transition hover:brightness-105"
              >
                {joinLabel}
              </button>
            </form>
          )}
        </div>

        <p className="mt-4 text-xs leading-relaxed text-chalk-dim">
          Predict the bracket, every match score &amp; goal scorers. Live leaderboards, real squads
          &amp; stats for all 104 games.{user ? "" : " No payment, ever."}
        </p>
      </div>

      <Link
        href="/"
        className="relative mt-5 text-xs text-chalk-dim underline decoration-dotted underline-offset-2 hover:text-chalk"
      >
        What is this?
      </Link>
    </main>
  );
}
