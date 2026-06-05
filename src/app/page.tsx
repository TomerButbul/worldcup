import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Hero from "@/components/Hero";
import InstallPrompt from "@/components/InstallPrompt";
import GameButton from "@/components/GameButton";
import { playAsGuest } from "@/app/auth/actions";
import { SITE_URL, SITE_DESCRIPTION } from "@/lib/site";
import type { Metadata } from "next";

// The landing is the one heavily-indexed page — claim the canonical root URL.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// JSON-LD: tells search engines this is a free web-based game/app so the result
// is understood and can earn richer display. Kept accurate — it's a real free PWA.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "World Cup 2026 Predictions",
      description: SITE_DESCRIPTION,
    },
    {
      "@type": "WebApplication",
      name: "World Cup 2026 — Bracket & Prediction Game",
      url: SITE_URL,
      applicationCategory: "GameApplication",
      operatingSystem: "Web, iOS, Android",
      description: SITE_DESCRIPTION,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
  ],
};

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-9 p-6 text-center">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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

      {/* Two pillars: play it your way, AND follow the whole tournament. */}
      <div className="w-full max-w-2xl space-y-6">
        <section className="space-y-3">
          <h2 className="font-display text-sm uppercase tracking-[0.2em] text-chalk-dim">Play it your way</h2>
          <div className="grid gap-3 sm:grid-cols-3">
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
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-sm uppercase tracking-[0.2em] text-chalk-dim">Follow every minute — even between picks</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { t: "Live scores", d: "Every match live & auto-updating — goal-by-goal, lineups and full stats." },
              { t: "Teams & players", d: "Squads, formations, FIFA ranks & ratings. Tap anyone for their card." },
              { t: "Never miss a kick", d: "Per-match countdowns and reminders for all 104 games." },
            ].map((f) => (
              <div
                key={f.t}
                className="glass rounded-2xl p-4 text-left transition duration-300 hover:-translate-y-1 hover:border-electric/40 hover:bg-night/5"
              >
                <h3 className="font-display text-lg text-gradient-fifa">{f.t}</h3>
                <p className="mt-1 text-sm text-chalk-dim">{f.d}</p>
              </div>
            ))}
          </div>
        </section>
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
