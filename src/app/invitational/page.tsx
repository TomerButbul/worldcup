import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getInvitationalStandings, referralStatusFor } from "@/lib/invitational";
import { referralLink } from "@/lib/referral";
import ReferralLink from "@/components/ReferralLink";
import {
  INVITATIONAL_NAME,
  INVITATIONAL_TAGLINE,
  PRIZE_USD,
  CONTEST_LOCK_LABEL,
  CONTEST_END_LABEL,
} from "@/lib/contest";

// Per-user (your eligibility + invite link) on top of the cached standings.
export const dynamic = "force-dynamic";
export const metadata = {
  title: INVITATIONAL_NAME,
  description: `Invite a friend, build your World Cup bracket, and the best one wins $${PRIZE_USD}. Free to enter — no purchase necessary.`,
};

export default async function InvitationalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const standings = await getInvitationalStandings();
  const status = user ? await referralStatusFor(user.id) : null;
  const myLink = status?.slug ? referralLink(status.slug) : null;
  const myRank = user ? standings.find((r) => r.user_id === user.id)?.rank ?? null : null;
  const leader = standings[0] ?? null;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-5 p-4 sm:space-y-6 sm:p-6">
      {/* ---- Hero ---- */}
      <section className="glass-strong relative overflow-hidden rounded-3xl p-6 text-center sm:p-8">
        <div className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-48 w-48 rounded-full bg-gold/20 blur-3xl" />
        <div className="relative">
          <div className="text-5xl">🏆</div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Free to enter · Best bracket wins
          </p>
          <h1 className="mt-1 font-display text-3xl text-chalk sm:text-4xl">{INVITATIONAL_NAME}</h1>
          <p className="mt-2 text-sm text-chalk-dim">{INVITATIONAL_TAGLINE}</p>
          <div className="mt-5 inline-flex items-baseline gap-2 rounded-2xl border border-gold/30 bg-gold/10 px-5 py-3">
            <span className="font-display text-4xl text-gold sm:text-5xl">${PRIZE_USD}</span>
            <span className="text-sm text-chalk-dim">to the top bracket</span>
          </div>
        </div>
      </section>

      {/* ---- Your status ---- */}
      <YourStatus
        loggedIn={!!user}
        status={status}
        myLink={myLink}
        myRank={myRank}
      />

      {/* ---- How it works ---- */}
      <section className="glass rounded-3xl p-5 sm:p-6">
        <h2 className="font-display text-lg text-chalk">How to enter</h2>
        <ol className="mt-4 space-y-3">
          <Step n={1} title="Invite a friend — or get invited">
            Share your link. The moment a friend signs up with it, you&rsquo;re{" "}
            <span className="font-semibold text-chalk">both</span> entered. (Already invited by
            someone? You&rsquo;re in.)
          </Step>
          <Step n={2} title="Build your bracket">
            Pick the whole tournament before {CONTEST_LOCK_LABEL}. Predict matches and goal scorers
            for live points too.
          </Step>
          <Step n={3} title={`Top bracket wins $${PRIZE_USD}`}>
            The single highest score when {CONTEST_END_LABEL} arrives takes the prize. Pure skill —
            no luck of the draw.
          </Step>
        </ol>
      </section>

      {/* ---- Standings ---- */}
      <section className="glass rounded-3xl p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-chalk">Who&rsquo;s in the running</h2>
          <span className="text-xs text-chalk-dim">
            {standings.length} {standings.length === 1 ? "player" : "players"}
          </span>
        </div>

        {standings.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-night/10 bg-night/5 px-4 py-6 text-center text-sm text-chalk-dim">
            No one&rsquo;s qualified yet — invite a friend and be the first name on the board.
          </p>
        ) : (
          <>
            {leader && (
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-gold/30 bg-gold/10 px-4 py-3">
                <span className="text-2xl">👑</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-chalk">{leader.name}</p>
                  <p className="text-xs text-gold">Leading for ${PRIZE_USD}</p>
                </div>
                <span className="font-display text-xl text-chalk">{leader.total}</span>
              </div>
            )}
            {user ? (
              <>
                <ol className="mt-3 divide-y divide-night/5">
                  {standings.slice(1, 25).map((r) => (
                    <li
                      key={r.user_id}
                      className={`flex items-center gap-3 px-1 py-2.5 text-sm ${
                        r.user_id === user.id ? "rounded-xl bg-grass/10" : ""
                      }`}
                    >
                      <span className="w-6 text-center font-semibold text-chalk-dim">{r.rank}</span>
                      <span className="min-w-0 flex-1 truncate text-chalk">{r.name}</span>
                      <span className="font-display text-chalk">{r.total}</span>
                    </li>
                  ))}
                </ol>
                {myRank && myRank > 25 && (
                  <p className="mt-3 rounded-xl bg-grass/10 px-4 py-2.5 text-center text-sm text-chalk">
                    You&rsquo;re <span className="font-semibold">#{myRank}</span> — keep climbing.
                  </p>
                )}
              </>
            ) : (
              // Privacy: the full named board is for signed-in players. Logged-out
              // visitors get the leader as social proof + a reason to join.
              <p className="mt-3 rounded-xl bg-night/5 px-4 py-3 text-center text-sm text-chalk-dim">
                <Link href="/signup" className="font-semibold text-gold hover:underline">
                  Sign up free
                </Link>{" "}
                to see the full board and enter.
              </p>
            )}
          </>
        )}
      </section>

      {/* ---- Legal footer ---- */}
      <footer className="px-2 pb-2 text-center text-xs text-chalk-dim">
        <p>
          No purchase necessary. Free to enter. Open to eligible players. Winner is the highest
          bracket score — a game of skill.{" "}
          <Link href="/rules" className="font-semibold text-gold hover:underline">
            Official rules
          </Link>
        </p>
        <p className="mt-2 opacity-80">
          Not affiliated with, endorsed by, or sponsored by FIFA, EA Sports, or any football
          governing body.
        </p>
      </footer>
    </main>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="text-night flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-gold-bright to-gold text-sm font-bold">
        {n}
      </span>
      <div>
        <p className="font-semibold text-chalk">{title}</p>
        <p className="mt-0.5 text-sm text-chalk-dim">{children}</p>
      </div>
    </li>
  );
}

function YourStatus({
  loggedIn,
  status,
  myLink,
  myRank,
}: {
  loggedIn: boolean;
  status: Awaited<ReturnType<typeof referralStatusFor>> | null;
  myLink: string | null;
  myRank: number | null;
}) {
  // Logged out — pure conversion CTA.
  if (!loggedIn || !status) {
    return (
      <section className="glass rounded-3xl p-5 text-center sm:p-6">
        <p className="text-sm text-chalk">
          Create a free account and invite one friend to join the running.
        </p>
        <Link
          href="/signup"
          className="text-night mt-3 inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-gold-bright to-gold px-5 py-2.5 text-sm font-semibold glow-gold shine transition hover:brightness-105"
        >
          Sign up free to enter
        </Link>
      </section>
    );
  }

  // Guest — must upgrade before they can win cash.
  if (status.isGuest) {
    return (
      <section className="glass rounded-3xl border border-gold/30 p-5 sm:p-6">
        <p className="font-semibold text-chalk">Finish your account to compete</p>
        <p className="mt-1 text-sm text-chalk-dim">
          You&rsquo;re playing as a guest. Add an email to lock in your picks and become eligible for
          the ${PRIZE_USD} prize.
        </p>
        <Link
          href="/signup"
          className="text-night mt-3 inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-gold-bright to-gold px-5 py-2.5 text-sm font-semibold glow-gold shine transition hover:brightness-105"
        >
          Create my account
        </Link>
      </section>
    );
  }

  // Real account, already eligible — celebrate + let them invite more.
  if (status.eligible) {
    return (
      <section className="glass rounded-3xl border border-grass/40 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <span className="text-xl">✅</span>
          <p className="font-semibold text-chalk">
            You&rsquo;re in the running{myRank ? ` — currently #${myRank}` : ""}.
          </p>
        </div>
        <p className="mt-1 text-sm text-chalk-dim">
          Your bracket is competing for ${PRIZE_USD}. Want company at the top? Invite more friends —
          each one you bring in is one more person you can beat.
        </p>
        {myLink && (
          <div className="mt-4">
            <ReferralLink link={myLink} prize={PRIZE_USD} />
          </div>
        )}
      </section>
    );
  }

  // Real account, not yet eligible — the key conversion moment.
  return (
    <section className="glass rounded-3xl border border-gold/40 p-5 sm:p-6">
      <p className="font-semibold text-chalk">You&rsquo;re one invite away 🎟️</p>
      <p className="mt-1 text-sm text-chalk-dim">
        Share your link. When a friend signs up with it, you&rsquo;re{" "}
        <span className="font-semibold text-chalk">both</span> entered for the ${PRIZE_USD} prize —
        free, instantly.
      </p>
      {myLink ? (
        <div className="mt-4">
          <ReferralLink link={myLink} prize={PRIZE_USD} />
        </div>
      ) : (
        <p className="mt-3 text-xs text-chalk-dim">
          Your invite link is being set up — check back in a moment.
        </p>
      )}
    </section>
  );
}
