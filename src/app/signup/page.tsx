import Link from "next/link";
import { signup, playAsGuest } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";
import GameButton from "@/components/GameButton";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import AppleSignInButton, { isAppleSignInEnabled } from "@/components/AppleSignInButton";
import Reveal from "@/components/Reveal";
import Ball from "@/components/art/Ball";
import { INVITATIONAL_NAME, PRIZE_LABEL } from "@/lib/contest";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invited?: string }>;
}) {
  const { error, invited } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // A guest (anonymous account) reaching this form is UPGRADING — same picks kept.
  const upgrading = !!user?.is_anonymous;

  const inputClass =
    "w-full rounded-xl border border-night/10 bg-white px-3 py-2.5 text-sm text-chalk outline-none placeholder:text-chalk-dim focus:border-grass focus:ring-2 focus:ring-grass/30";

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Reveal className="w-full max-w-sm">
        <div className="glass-strong rounded-3xl p-6 sm:p-8">
          <Link href="/" className="block text-sm text-chalk-dim hover:text-chalk">
            &larr; Home
          </Link>

          <div className="mt-6 text-center">
            <div className="flex justify-center"><Ball size={44} /></div>
            <h1 className="mt-2 font-display text-3xl text-chalk">{upgrading ? "Save your picks" : "Join the game"}</h1>
            <p className="mt-1 text-sm text-chalk-dim">
              {upgrading ? "Add an email to keep your guest progress and compete." : "Create your World Cup account"}
            </p>
          </div>

          {invited && (
            <div className="mt-6 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2.5 text-sm text-chalk">
              <span className="font-semibold text-gold">🏆 You&rsquo;re invited.</span> Sign up and
              your bracket joins {INVITATIONAL_NAME} — the best one wins {PRIZE_LABEL}.
            </div>
          )}

          {error && (
            <p className="mt-6 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <form action={signup} className="mt-6 space-y-3">
            <input name="display_name" type="text" required placeholder="Display name" aria-label="Display name" autoComplete="name" className={inputClass} />
            <input name="email" type="email" required placeholder="Email" aria-label="Email" autoComplete="email" className={inputClass} />
            <input
              name="password"
              type="password"
              required
              minLength={6}
              placeholder="Password (min 6 chars)"
              aria-label="Password"
              autoComplete="new-password"
              className={inputClass}
            />
            <div className="pt-1">
              <GameButton type="submit" variant="gold" className="w-full">
                Sign up
              </GameButton>
            </div>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-chalk-dim">
            <span className="h-px flex-1 bg-night/10" />
            or
            <span className="h-px flex-1 bg-night/10" />
          </div>

          <GoogleSignInButton label="Continue with Google" />
          {isAppleSignInEnabled() && (
            <div className="mt-2.5">
              <AppleSignInButton label="Continue with Apple" />
            </div>
          )}

          <p className="mt-5 text-center text-sm text-chalk-dim">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-gold hover:underline">
              Log in
            </Link>
          </p>

          {upgrading ? (
            <Link
              href="/dashboard"
              className="mt-5 block border-t border-night/10 pt-5 text-center text-sm font-semibold text-grass hover:underline"
            >
              &larr; Back to your picks (stay a guest)
            </Link>
          ) : (
            <form action={playAsGuest} className="mt-5 border-t border-night/10 pt-5">
              <button type="submit" className="w-full text-center text-sm font-semibold text-grass hover:underline">
                Skip — keep playing as a guest &rarr;
              </button>
            </form>
          )}
        </div>
      </Reveal>
    </main>
  );
}
