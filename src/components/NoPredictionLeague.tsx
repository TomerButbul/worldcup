import Link from "next/link";
import Ball from "@/components/art/Ball";

// Shown on the account-level prediction pages (/predict, /bracket, /awards) when
// the user isn't in any prediction league yet. Predictions are scored inside a
// league, so we steer them to create/join one first.
export default function NoPredictionLeague({ title }: { title: string }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 p-4 sm:p-6 lg:p-8">
      <div className="glass-strong rounded-3xl p-6 text-center sm:p-10">
        <Ball size={44} className="mx-auto text-gold" />
        <h1 className="mt-3 font-display text-2xl text-gradient-gold sm:text-3xl">{title}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-chalk-dim">
          You make your picks once and they count in every league you&apos;re in — but
          they need a league to be scored against. Create your own or join one with a
          code, then come straight back here.
        </p>
        <Link
          href="/dashboard"
          className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-gold/15 px-4 py-2.5 text-sm font-semibold text-gold transition hover:bg-gold/25"
        >
          Create or join a league →
        </Link>
      </div>
    </main>
  );
}
