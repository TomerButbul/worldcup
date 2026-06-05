import Link from "next/link";
import { Upfront, Live, Trophy, Bell } from "@/components/icons";
import type { ComponentType } from "react";
import { SUPPORT_URL } from "@/lib/site";

export const metadata = {
  title: "How it works",
  description:
    "How the World Cup 2026 prediction game works: build your bracket, predict exact scores and goal scorers, pick the Golden Boot, and exactly how every point is scored.",
  alternates: { canonical: "/how-it-works" },
};

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
  ["Semi-final", "+8"],
  ["Final", "+16"],
];

const AWARD_POINTS = [
  ["Golden Boot", "12"],
  ["Golden Ball", "10"],
  ["Golden Glove", "8"],
  ["Young Player", "8"],
];

const LIVE_POINTS = [
  ["Exact score — knockout", "8"],
  ["Exact score — group", "3"],
  ["Correct result — knockout / group", "3 / 1"],
  ["Each correct goal scorer — knockout / group", "3 / 1"],
  ["Calling the penalty-shootout winner", "3"],
];

type CrownEntry = { Icon: ComponentType<{ size?: number }>; name: string; desc: string };
const CROWNS: CrownEntry[] = [
  { Icon: Upfront, name: "Upfront", desc: "bracket + awards" },
  { Icon: Live, name: "Live", desc: "in-running match picks" },
  { Icon: Trophy, name: "Total", desc: "the two combined" },
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
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 p-4 sm:p-6 lg:max-w-5xl lg:p-8">
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

      {/* Desktop 2-col: left = The game + Three crowns + Stay on top; right = Scoring */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
        {/* Left column */}
        <div className="space-y-4">
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

          {/* Three crowns */}
          <section className="glass rounded-3xl p-5 sm:p-6">
            <h2 className="font-display text-2xl text-chalk">Three crowns</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {CROWNS.map(({ Icon, name, desc }) => (
                <div key={name} className="rounded-2xl bg-night/[0.03] p-3 text-center">
                  <div className="flex justify-center text-chalk"><Icon size={24} /></div>
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
              before picks lock and before each kickoff.{" "}
              <span className="inline-flex items-center gap-1.5"><Bell size={14} /></span>
            </p>
          </section>
        </div>

        {/* Right column: Scoring */}
        <div className="mt-4 lg:mt-0">
          <section className="glass rounded-3xl p-5 sm:p-6">
            <h2 className="font-display text-2xl text-chalk">Scoring</h2>

            {/* Upfront */}
            <div className="mt-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-gold"><Upfront size={16} /></span>
                <h3 className="font-display text-lg text-gold">Upfront</h3>
              </div>
              <p className="mt-0.5 text-xs text-chalk-dim">
                Your bracket + awards — locked at kickoff.
              </p>
              <div className="mt-2">
                <ScoreRow label="Each group finishing position (1st–4th)" points="1" />
                <ScoreRow label="Perfect group order (all four)" points="+3" />
                <ScoreRow label="Predict a group winner" points="3" />
                <ScoreRow label="Champion" points="32" />
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
                <p className="mt-2 text-xs text-chalk-dim">
                  Each round doubles — March Madness style, so every tier is worth the same in total.
                </p>
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
                <span className="inline-flex items-center gap-1.5 text-grass"><Live size={16} /></span>
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
        </div>
      </div>

      {/* Permanent, low-key support line — always here for anyone who wants to give,
          never a nag. Hidden until SUPPORT_URL is set. */}
      {SUPPORT_URL ? (
        <p className="pt-2 text-center text-xs text-chalk-dim">
          World Cup is free and ad-free, built by one person.{" "}
          <a
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-gold underline-offset-2 hover:underline"
          >
            ☕ Buy me a coffee
          </a>{" "}
          if you&apos;d like to chip in.
        </p>
      ) : null}
    </main>
  );
}
