import Link from "next/link";
import { updatePassword } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";
import GameButton from "@/components/GameButton";
import Reveal from "@/components/Reveal";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // The recovery link runs through /auth/callback, which exchanges the code for
  // a session before landing here. No session → the link was invalid/expired.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const inputClass =
    "w-full rounded-xl border border-night/10 bg-white px-3 py-2.5 text-sm text-chalk outline-none placeholder:text-chalk-dim focus:border-grass focus:ring-2 focus:ring-grass/30";

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Reveal className="w-full max-w-sm">
        <div className="glass-strong rounded-3xl p-6 space-y-6 sm:p-8">
          <div className="text-center">
            <div className="mb-2 text-4xl">🔐</div>
            <h1 className="font-display text-3xl text-chalk">Set a new password</h1>
          </div>

          {!user ? (
            <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-600">
              This reset link is invalid or has expired.{" "}
              <Link href="/forgot-password" className="font-semibold underline">
                Request a new one
              </Link>
              .
            </p>
          ) : (
            <>
              {error && (
                <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-600">{error}</p>
              )}
              <form action={updatePassword} className="space-y-4">
                <input
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  placeholder="New password (min 6 chars)"
                  aria-label="New password"
                  autoComplete="new-password"
                  className={inputClass}
                />
                <GameButton type="submit" variant="gold" className="w-full">
                  Update password
                </GameButton>
              </form>
            </>
          )}
        </div>
      </Reveal>
    </main>
  );
}
