import Link from "next/link";

// Slim nudge shown on every page while the visitor is playing as a guest (an
// anonymous account). Tapping through to /signup attaches an email to this SAME
// account, so every pick carries over — see the upgrade branch in
// auth/actions.signup().
export default function GuestBanner() {
  return (
    <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 rounded-2xl border border-gold/30 bg-gold/10 px-4 py-2.5 text-sm lg:max-w-[1600px]">
      <span className="min-w-0 text-chalk-dim">
        <span className="font-semibold text-chalk">Playing as a guest.</span>{" "}
        Create a free account to keep your picks &amp; join the leaderboards.
      </span>
      <Link
        href="/signup"
        className="shrink-0 rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-night transition hover:brightness-110"
      >
        Save my picks
      </Link>
    </div>
  );
}
