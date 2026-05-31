import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { btnClass } from "@/components/buttonStyles";
import Hero from "@/components/Hero";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 p-6 text-center">
      <Hero />
      <div className="flex w-full max-w-xs flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:items-center sm:justify-center">
        <Link href="/signup" className={btnClass("gold")} style={{ background: "linear-gradient(90deg,#ffd970,#f6c453)" }}>
          Get started
        </Link>
        <Link href="/login" className={btnClass("ghost")}>
          Log in
        </Link>
      </div>

      <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
        {[
          { t: "Upfront Bracket", d: "Call all 12 groups + the full knockout to the champion." },
          { t: "Live Predictions", d: "Score and goal-scorer picks for every match." },
          { t: "3 Crowns", d: "Win upfront, win live, win overall." },
        ].map((f) => (
          <div
            key={f.t}
            className="glass rounded-2xl p-4 text-left transition duration-300 hover:-translate-y-1 hover:border-grass/40 hover:bg-white/10"
          >
            <h3 className="font-display text-lg text-gradient-gold">{f.t}</h3>
            <p className="mt-1 text-sm text-chalk-dim">{f.d}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
