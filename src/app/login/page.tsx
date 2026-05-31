import Link from "next/link";
import { login } from "@/app/auth/actions";
import GameButton from "@/components/GameButton";
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
        <div className="glass-strong rounded-3xl p-6 space-y-6 sm:p-8">
          <div className="text-center">
            <div className="mb-2 text-4xl">🏟️</div>
            <h1 className="font-display text-3xl text-chalk">Welcome back</h1>
            <p className="text-sm text-chalk-dim">Log in to enter the tournament</p>
          </div>

          {info && (
            <p className="rounded-lg bg-grass/15 px-3 py-2 text-sm text-grass-bright">{info}</p>
          )}
          {error && (
            <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{error}</p>
          )}

          <form action={login} className="space-y-4">
            <input
              name="email"
              type="email"
              required
              placeholder="Email"
              aria-label="Email"
              autoComplete="email"
              className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-sm text-chalk outline-none placeholder:text-chalk-dim focus:border-grass focus:ring-2 focus:ring-grass/30"
            />
            <input
              name="password"
              type="password"
              required
              placeholder="Password"
              aria-label="Password"
              autoComplete="current-password"
              className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-sm text-chalk outline-none placeholder:text-chalk-dim focus:border-grass focus:ring-2 focus:ring-grass/30"
            />
            <GameButton type="submit" variant="primary" className="w-full">
              Log in
            </GameButton>
          </form>

          <p className="text-center text-sm text-chalk-dim">
            No account?{" "}
            <Link href="/signup" className="font-semibold text-gold hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </Reveal>
    </main>
  );
}
