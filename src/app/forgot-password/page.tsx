import Link from "next/link";
import { requestPasswordReset } from "@/app/auth/actions";
import GameButton from "@/components/GameButton";
import Reveal from "@/components/Reveal";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  const inputClass =
    "w-full rounded-xl border border-night/10 bg-white px-3 py-2.5 text-sm text-chalk outline-none placeholder:text-chalk-dim focus:border-grass focus:ring-2 focus:ring-grass/30";

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Reveal className="w-full max-w-sm">
        <div className="glass-strong rounded-3xl p-6 space-y-6 sm:p-8">
          <div className="text-center">
            <div className="mb-2 text-4xl">🔑</div>
            <h1 className="font-display text-3xl text-chalk">Reset password</h1>
            <p className="text-sm text-chalk-dim">We&apos;ll email you a reset link</p>
          </div>

          {sent ? (
            <p className="rounded-lg bg-grass/15 px-3 py-2 text-sm text-grass">
              If an account exists for that email, a reset link is on its way. Check your inbox
              (and your spam folder).
            </p>
          ) : (
            <>
              {error && (
                <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-600">{error}</p>
              )}
              <form action={requestPasswordReset} className="space-y-4">
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="Email"
                  aria-label="Email"
                  autoComplete="email"
                  className={inputClass}
                />
                <GameButton type="submit" variant="primary" className="w-full">
                  Send reset link
                </GameButton>
              </form>
            </>
          )}

          <p className="text-center text-sm text-chalk-dim">
            Remembered it?{" "}
            <Link href="/login" className="font-semibold text-gold hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </Reveal>
    </main>
  );
}
