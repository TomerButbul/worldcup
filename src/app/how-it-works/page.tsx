import Link from "next/link";

export const metadata = { title: "How it works" };

const GAME_STEPS = [
  "Predict the bracket — order each group's table (1st→4th) and pick the 8 best third-placed teams; your knockout bracket builds itself, then crown your champion.",
  "Predict the 4 individual awards (Golden Boot, Ball, Glove, Young Player).",
  "As the tournament plays, predict every match's exact score + goal scorers (and the shootout winner for level knockouts).",
  "Climb three leaderboards. Everything auto-saves; picks lock at kickoff (Jun 11).",
];

const STAGE_POINTS = [
  ["Round of 32", "+1"],
  ["Round of 16", "+2"],
  ["Quarter-final", "+4"],
  ["Semi-final", "+6"],
  ["Final", "+8"],
];

const AWARD_POINTS = [
  ["Golden Boot", "12"],
  ["Golden Ball", "10"],
  ["Golden Glove", "8"],
  ["Young Player", "8"],
];

const LIVE_POINTS = [
  ["Exact score — knockout", "5"],
  ["Exact score — group", "2"],
  ["Correct result — knockout / group", "2 / 1"],
  ["Each correct goal scorer — knockout / group", "2 / 1"],
  ["Calling the penalty-shootout winner", "2"],
];

const CROWNS = [
  ["🎯", "Upfront", "bracket + awards"],
  ["⚡", "Live", "in-running match picks"],
  ["👑", "Total", "the two combined"],
];

function ScoreRow({ label, points, grass = false }: { label: string; points: string; grass?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-night/5 py-2 last:border-b-0">
      <span className="text-chalk">{label}</span>
      <span
        className={`shrink-0 font-display text-lg tabular-nums ${grass ? "text-grass" : "text-gold"}`}
      >
        {points}
      </span>
    </div>
  );
}

export default function HowItWorksPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-4 sm:p-6">
      <Link href="/dashboard" className="text-sm text-chalk-dim hover:text-chalk">
        &larr; Home
      </Link>

      {/* Header */}
      <div className="glass-strong rounded-3xl p-5">
        <h1 className="font-display text-3xl text-gradient-gold">How it works</h1>
        <p className="mt-1 text-sm text-chalk-dim">
          Predict, play, and climb — everything you need to win the World Cup pool.
        </p>
      </div>

      {/* The game */}
      <section className="glass rounded-3xl p-5 sm:p-6">
        <h2 className="font-display text-2xl text-chalk">The game</h2>
        <ol className="mt-3 space-y-3">
          {GAME_STEPS.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/15 font-display text-sm tabular-nums text-gold">
                {i + 1}
              </span>
              <span className="text-sm text-chalk-dim sm:text-base">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Scoring */}
      <section className="glass rounded-3xl p-5 sm:p-6">
        <h2 className="font-display text-2xl text-chalk">Scoring</h2>

        {/* Upfront */}
        <div className="mt-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎯</span>
            <h3 className="font-display text-lg text-gold">Upfront</h3>
          </div>
          <p className="mt-0.5 text-xs text-chalk-dim">
            Your bracket + awards — locked at kickoff.
          </p>
          <div className="mt-2">
            <ScoreRow label="Each group finishing position (1st–4th)" points="1" />
            <ScoreRow label="Perfect group order (all four)" points="+3" />
            <ScoreRow label="Predict a group winner" points="3" />
            <ScoreRow label="Champion" points="25" />
          </div>

          <div className="mt-3 rounded-2xl bg-night/[0.03] p-3">
            <p className="text-sm text-chalk">Each team you correctly send through</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {STAGE_POINTS.map(([stage, pts]) => (
                <span
                  key={stage}
                  className="rounded-full bg-grass/10 px-2.5 py-1 text-xs text-chalk"
                >
                  {stage}{" "}
                  <span className="font-display tabular-nums text-grass">{pts}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="mt-3 rounded-2xl bg-night/[0.03] p-3">
            <p className="text-sm text-chalk">Individual awards</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {AWARD_POINTS.map(([award, pts]) => (
                <span
                  key={award}
                  className="rounded-full bg-gold/10 px-2.5 py-1 text-xs text-chalk"
                >
                  {award}{" "}
                  <span className="font-display tabular-nums text-gold">{pts}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Live */}
        <div className="mt-5 border-t border-night/5 pt-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚡</span>
            <h3 className="font-display text-lg text-grass">Live</h3>
          </div>
          <p className="mt-0.5 text-xs text-chalk-dim">Per match, as games play — group games score lighter than knockouts.</p>
          <div className="mt-2">
            {LIVE_POINTS.map(([label, pts]) => (
              <ScoreRow key={label} label={label} points={pts} grass />
            ))}
          </div>
        </div>
      </section>

      {/* Three crowns */}
      <section className="glass rounded-3xl p-5 sm:p-6">
        <h2 className="font-display text-2xl text-chalk">Three crowns</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {CROWNS.map(([icon, name, desc]) => (
            <div key={name} className="rounded-2xl bg-night/[0.03] p-3 text-center">
              <div className="text-2xl">{icon}</div>
              <div className="mt-1 font-display text-lg text-chalk">{name}</div>
              <div className="text-xs text-chalk-dim">{desc}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-chalk-dim">
          The leaderboard ranks by each crown; ties are broken by{" "}
          <span className="text-chalk">Upfront</span> points, then name.
        </p>
      </section>

      {/* Stay on top */}
      <section className="glass rounded-3xl p-5 sm:p-6">
        <h2 className="font-display text-2xl text-chalk">Stay on top</h2>
        <p className="mt-2 text-sm text-chalk-dim sm:text-base">
          Enable <span className="text-chalk">notifications</span> on your dashboard to get pinged
          before picks lock and before each kickoff. 🔔
        </p>
      </section>
    </main>
  );
}
