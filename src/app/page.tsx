import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Hero from "@/components/Hero";
import InstallPrompt from "@/components/InstallPrompt";
import GameButton from "@/components/GameButton";
import { playAsGuest } from "@/app/auth/actions";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-9 p-6 text-center">
      <Hero />

      {/* Start instantly as a guest — no sign-up. (Falls back to /signup if guest
          sessions aren't enabled yet.) Account creation stays one tap away. */}
      <div className="flex flex-col items-center gap-2">
        <form action={playAsGuest}>
          <GameButton type="submit" variant="gold" className="px-10">
            Start playing — free
          </GameButton>
        </form>
        <p className="text-sm text-chalk-dim">
          No sign-up to start.{" "}
          <Link href="/login" className="font-semibold text-gold hover:underline">Log in</Link>
          {" · "}
          <Link href="/signup" className="font-semibold text-gold hover:underline">create an account</Link>
        </p>
      </div>

      {/* Depth tiers — everyone's welcome; you choose how far you go. */}
      <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
        {[
          { t: "Keep it simple", d: "Just pick who you think wins each match." },
          { t: "Go deeper", d: "Scorelines, goal scorers, the Golden Boot & the full bracket." },
          { t: "Compete", d: "Climb live leaderboards with friends — and the world." },
        ].map((f) => (
          <div
            key={f.t}
            className="glass rounded-2xl p-4 text-left transition duration-300 hover:-translate-y-1 hover:border-grass/40 hover:bg-night/5"
          >
            <h3 className="font-display text-lg text-gradient-gold">{f.t}</h3>
            <p className="mt-1 text-sm text-chalk-dim">{f.d}</p>
          </div>
        ))}
      </div>

      <InstallPrompt />

      <Link
        href="/how-it-works"
        className="text-sm text-chalk-dim underline-offset-2 hover:text-chalk hover:underline"
      >
        How it works &amp; scoring &rarr;
      </Link>
    </main>
  );
}
