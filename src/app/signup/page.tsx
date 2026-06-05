import Link from "next/link";
import { signup, playAsGuest } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";
import GameButton from "@/components/GameButton";
import Reveal from "@/components/Reveal";
import Ball from "@/components/art/Ball";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
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
        <div className="glass-strong rounded-3xl p-6 space-y-6 sm:p-8">
          <Link href="/" className="-mb-2 block text-sm text-chalk-dim hover:text-chalk">
            &larr; Home
          </Link>
          <div className="text-center">
            <div className="mb-2 flex justify-center"><Ball size={44} /></div>
            <h1 className="font-display text-3xl text-chalk">{upgrading ? "Save your picks" : "Join the game"}</h1>
            <p className="text-sm text-chalk-dim">
              {upgrading ? "Add an email to keep your guest progress and compete." : "Create your World Cup account"}
            </p>
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <form action={signup} className="space-y-4">
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
            <GameButton type="submit" variant="gold" className="w-full">
              Sign up
            </GameButton>
          </form>

          <p className="text-center text-sm text-chalk-dim">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-gold hover:underline">
              Log in
            </Link>
          </p>

          {upgrading ? (
            <Link
              href="/dashboard"
              className="block border-t border-night/10 pt-4 text-center text-sm font-semibold text-grass hover:underline"
            >
              &larr; Back to your picks (stay a guest)
            </Link>
          ) : (
            <form action={playAsGuest} className="border-t border-night/10 pt-4">
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
