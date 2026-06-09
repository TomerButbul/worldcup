import Link from "next/link";
import { login, playAsGuest } from "@/app/auth/actions";
import GameButton from "@/components/GameButton";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import AppleSignInButton, { isAppleSignInEnabled } from "@/components/AppleSignInButton";
import Reveal from "@/components/Reveal";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; info?: string }>;
}) {
  const { error, info } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Reveal className="w-full max-w-sm">
        <div className="glass-strong rounded-3xl p-6 sm:p-8">
          <Link href="/" className="block text-sm text-chalk-dim hover:text-chalk">
            &larr; Home
          </Link>

          <div className="mt-6 text-center">
            <div className="text-4xl">🏟️</div>
            <h1 className="mt-2 font-display text-3xl text-chalk">Welcome back</h1>
            <p className="mt-1 text-sm text-chalk-dim">Log in to enter the tournament</p>
          </div>

          {info && (
            <p className="mt-6 rounded-lg bg-grass/15 px-3 py-2 text-sm text-grass">{info}</p>
          )}
          {error && (
            <p className="mt-6 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <form action={login} className="mt-6 space-y-3">
            <input
              name="email"
              type="email"
              required
              placeholder="Email"
              aria-label="Email"
              autoComplete="email"
              className="w-full rounded-xl border border-night/10 bg-white px-3 py-2.5 text-sm text-chalk outline-none placeholder:text-chalk-dim focus:border-grass focus:ring-2 focus:ring-grass/30"
            />
            <input
              name="password"
              type="password"
              required
              placeholder="Password"
              aria-label="Password"
              autoComplete="current-password"
              className="w-full rounded-xl border border-night/10 bg-white px-3 py-2.5 text-sm text-chalk outline-none placeholder:text-chalk-dim focus:border-grass focus:ring-2 focus:ring-grass/30"
            />
            <div className="pt-1">
              <GameButton type="submit" variant="primary" className="w-full">
                Log in
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

          <div className="mt-5 space-y-2 text-center text-sm text-chalk-dim">
            <p>
              <Link href="/forgot-password" className="hover:text-gold hover:underline">
                Forgot password?
              </Link>
            </p>
            <p>
              No account?{" "}
              <Link href="/signup" className="font-semibold text-gold hover:underline">
                Sign up
              </Link>
            </p>
          </div>

          <form action={playAsGuest} className="mt-5 border-t border-night/10 pt-5">
            <button type="submit" className="w-full text-center text-sm font-semibold text-grass hover:underline">
              Skip — keep playing as a guest &rarr;
            </button>
          </form>
        </div>
      </Reveal>
    </main>
  );
}
