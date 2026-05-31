import Link from "next/link";
import { signup } from "@/app/auth/actions";
import GameButton from "@/components/GameButton";
import Reveal from "@/components/Reveal";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const inputClass =
    "w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-sm text-chalk outline-none placeholder:text-chalk-dim focus:border-grass focus:ring-2 focus:ring-grass/30";

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Reveal className="w-full max-w-sm">
        <div className="glass-strong rounded-3xl p-6 space-y-6 sm:p-8">
          <div className="text-center">
            <div className="mb-2 text-4xl">⚽</div>
            <h1 className="font-display text-3xl text-chalk">Join the game</h1>
            <p className="text-sm text-chalk-dim">Create your World Cup account</p>
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{error}</p>
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
        </div>
      </Reveal>
    </main>
  );
}
