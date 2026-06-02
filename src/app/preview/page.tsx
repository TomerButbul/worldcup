"use client";

import { useState } from "react";
import { motion } from "motion/react";
import Hero from "@/components/Hero";
import Flag from "@/components/Flag";
import Avatar from "@/components/Avatar";
import PlayerAvatar from "@/components/PlayerAvatar";
import EmojiRain from "@/components/EmojiRain";
import Reveal from "@/components/Reveal";
import FavoriteTeamStatus from "@/components/FavoriteTeamStatus";
import SoccerBall from "@/components/SoccerBall";
import PitchDivider from "@/components/PitchDivider";
import { btnClass, GOLD_GRADIENT } from "@/components/buttonStyles";
import { burst, celebrate } from "@/lib/confetti";
import { goalCelebration } from "@/lib/goal";
import type { FavTeamStatus } from "@/lib/favoriteStatus";

// Real flags from a public CDN so the preview shows the true vibe (no backend).
const f = (iso: string) => `https://flagcdn.com/w80/${iso}.png`;
const T = {
  bra: { id: 1, name: "Brazil", code: "BRA", logo_url: f("br") },
  arg: { id: 2, name: "Argentina", code: "ARG", logo_url: f("ar") },
  fra: { id: 3, name: "France", code: "FRA", logo_url: f("fr") },
  esp: { id: 4, name: "Spain", code: "ESP", logo_url: f("es") },
  eng: { id: 5, name: "England", code: "ENG", logo_url: f("gb-eng") },
  ger: { id: 6, name: "Germany", code: "GER", logo_url: f("de") },
  ned: { id: 7, name: "Netherlands", code: "NED", logo_url: f("nl") },
  por: { id: 8, name: "Portugal", code: "POR", logo_url: f("pt") },
};

const favGood: FavTeamStatus = {
  team: T.bra,
  last: { opponentId: 2, opponentName: "Serbia", gf: 3, ga: 1, outcome: "W", stage: "group" },
  next: { opponentId: 4, opponentName: "Spain", kickoff: "2099-06-20T16:00:00Z", stage: "round_of_16" },
  eliminated: false,
  champion: false,
  headline: "Brazil won their last match 3–1 vs Serbia!",
  emoji: "🎉",
  mood: "good",
};
const favBad: FavTeamStatus = {
  team: { id: 9, name: "Cameroon", code: "CMR", logo_url: f("cm") },
  last: { opponentId: 3, opponentName: "France", gf: 0, ga: 2, outcome: "L", stage: "quarter" },
  next: null,
  eliminated: true,
  champion: false,
  headline: "Cameroon were knocked out in the quarter-finals.",
  emoji: "😭",
  mood: "bad",
};

type Row = { name: string; team: (typeof T)[keyof typeof T]; up: number; live: number; me?: boolean };
const ROWS: Row[] = [
  { name: "The Goal Diggers", team: T.bra, up: 24, live: 18 },
  { name: "Tiki-Taka Tactics", team: T.esp, up: 20, live: 16, me: true },
  { name: "Mbappé's Minions", team: T.fra, up: 18, live: 14 },
  { name: "Three Lions Den", team: T.eng, up: 12, live: 10 },
  { name: "Last-Place Larry", team: T.ned, up: 4, live: 2 },
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 font-display text-xl text-chalk">
      <SoccerBall size={20} />
      {children}
    </h2>
  );
}

export default function PreviewPage() {
  const [tab, setTab] = useState<"total" | "up" | "live">("total");
  const [rain, setRain] = useState<number | null>(null);
  const [home, setHome] = useState(1);
  const [away, setAway] = useState(0);
  const [scorers, setScorers] = useState<number[]>([101]);
  const [ko, setKo] = useState<number[]>([T.bra.id, T.fra.id, T.esp.id]);
  const [champ, setChamp] = useState<number | null>(T.bra.id);

  const rows = [...ROWS].sort((a, b) =>
    tab === "total" ? b.up + b.live - (a.up + a.live) : tab === "up" ? b.up - a.up : b.live - a.live,
  );

  function troll() {
    const id = Date.now();
    setRain(id);
    setTimeout(() => setRain((c) => (c === id ? null : c)), 3500);
  }

  const scorerList = [
    { id: 101, name: "Mbappé" },
    { id: 102, name: "Griezmann" },
    { id: 103, name: "Pedri" },
    { id: 104, name: "Yamal" },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-12 p-4 sm:p-6">
      {rain && <EmojiRain key={rain} />}

      <div className="rounded-xl border border-gold/30 bg-gold/10 p-3 text-center text-xs text-gold">
        🔍 Visual preview — mock data, no backend. The real app needs Supabase.
      </div>

      {/* HERO + BUTTONS */}
      <Reveal>
        <section className="text-center">
          <Hero />
          <div className="mt-6 flex w-full max-w-xs flex-col items-stretch gap-3 sm:mx-auto sm:max-w-none sm:flex-row sm:justify-center">
            <span className={btnClass("gold")} style={{ background: GOLD_GRADIENT }}>
              Get started
            </span>
            <span className={btnClass("ghost")}>Log in</span>
          </div>
        </section>
      </Reveal>

      <PitchDivider />

      {/* PROFILE + FAVORITE TEAM */}
      <Reveal>
        <section>
          <SectionTitle>Profile & your team</SectionTitle>
          <div className="mb-4 flex items-center gap-3 glass rounded-2xl p-4">
            <Avatar url={null} name="Tomer B" size={52} />
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-display text-2xl text-gradient-gold">
                <Flag logoUrl={T.bra.logo_url} name="Brazil" size={26} />
                <span className="truncate">The Goal Diggers</span>
              </p>
              <p className="text-sm text-chalk-dim">Managed by Tomer</p>
            </div>
          </div>
          <div className="space-y-3">
            <FavoriteTeamStatus status={favGood} />
            <FavoriteTeamStatus status={favBad} />
          </div>
        </section>
      </Reveal>

      <PitchDivider />

      {/* LEADERBOARD */}
      <Reveal>
        <section>
          <SectionTitle>Leaderboard</SectionTitle>
          <div className="mb-3 flex gap-1.5">
            {([["total", "👑 Total"], ["up", "🎯 Upfront"], ["live", "⚡ Live"]] as const).map(
              ([k, label]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    tab === k ? "bg-grass text-night" : "glass text-chalk-dim hover:text-chalk"
                  }`}
                >
                  {label}
                </button>
              ),
            )}
          </div>
          <div className="glass-strong overflow-hidden rounded-2xl">
            <div className="grid grid-cols-[1.25rem_1fr_2rem_2rem_2.5rem] items-center gap-1.5 border-b border-night/10 px-3 py-2.5 text-xs uppercase tracking-wider text-chalk-dim sm:grid-cols-[2.5rem_1fr_3.5rem_3.5rem_4rem] sm:gap-2 sm:px-4">
              <span>#</span>
              <span>Player</span>
              <span className={`text-right ${tab === "up" ? "text-grass" : ""}`}>🎯</span>
              <span className={`text-right ${tab === "live" ? "text-grass" : ""}`}>⚡</span>
              <span className={`text-right ${tab === "total" ? "text-grass" : ""}`}>👑</span>
            </div>
            {rows.map((r, i) => {
              const isWinner = i === 0;
              const isLoser = i === rows.length - 1;
              const medals = ["🥇", "🥈", "🥉"];
              return (
                <motion.div
                  key={r.name}
                  layout
                  animate={isLoser ? { x: [0, -3, 3, -3, 3, 0] } : {}}
                  transition={isLoser ? { x: { duration: 0.6, repeat: Infinity, repeatDelay: 2.5 } } : {}}
                  className={`grid grid-cols-[1.25rem_1fr_2rem_2rem_2.5rem] items-center gap-1.5 border-b border-night/5 px-3 py-3 text-sm sm:grid-cols-[2.5rem_1fr_3.5rem_3.5rem_4rem] sm:gap-2 sm:px-4 ${
                    isWinner ? "animate-pulse-glow bg-gold/15" : isLoser ? "bg-red-500/5" : ""
                  } ${r.me ? "ring-1 ring-inset ring-grass/50" : ""}`}
                >
                  <span className="text-lg">{isWinner ? "👑" : medals[i] ?? <span className="text-chalk-dim">{i + 1}</span>}</span>
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Avatar url={null} name={r.name} size={22} />
                    <Flag logoUrl={r.team.logo_url} name={r.team.name} size={16} />
                    <span className="min-w-0 flex-1 truncate font-semibold text-chalk">{r.name}</span>
                    {r.me && <span className="shrink-0 rounded bg-grass/20 px-1.5 py-0.5 text-[10px] font-bold text-grass">you</span>}
                    {isWinner && <span className="shrink-0 text-sm">✨</span>}
                    {isLoser && (
                      <>
                        <span className="shrink-0 text-base">🥄</span>
                        <button
                          onClick={troll}
                          className="shrink-0 rounded-full border border-red-400/40 px-2 py-1 text-xs text-red-600 transition hover:bg-red-500/20"
                        >
                          🍅<span className="hidden sm:inline"> troll</span>
                        </button>
                      </>
                    )}
                  </span>
                  <span className="text-right tabular-nums text-chalk/70">{r.up}</span>
                  <span className="text-right tabular-nums text-chalk/70">{r.live}</span>
                  <span className="text-right font-display text-base tabular-nums">{r.up + r.live}</span>
                </motion.div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-chalk-dim">Tap 🍅 troll on last place 👀</p>
        </section>
      </Reveal>

      <PitchDivider />

      {/* BRACKET SNIPPET */}
      <Reveal>
        <section>
          <SectionTitle>Bracket picks</SectionTitle>
          <div className="glass rounded-2xl p-3">
            <h3 className="mb-2 font-display text-sm text-gold">Group A</h3>
            <ol className="space-y-1">
              {[T.bra, T.esp, T.ned, T.eng].map((t, i) => (
                <li
                  key={t.id}
                  className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-sm ${i < 2 ? "bg-grass/15" : "bg-night/[0.04]"}`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-4 shrink-0 text-chalk-dim">{i + 1}</span>
                    <Flag logoUrl={t.logo_url} name={t.name} size={18} />
                    <span className="truncate text-chalk">{t.name}</span>
                    {i < 2 && <span className="shrink-0 text-xs text-grass">✓</span>}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-3 glass rounded-2xl p-4">
            <h3 className="mb-3 font-display text-sm text-chalk">Quarter-finals</h3>
            <div className="flex flex-wrap gap-2.5">
              {Object.values(T).map((t) => {
                const on = ko.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => setKo((p) => (on ? p.filter((x) => x !== t.id) : [...p, t.id]))}
                    className={`flex min-h-10 items-center gap-1.5 rounded-full border px-3 py-2 text-sm transition ${
                      on ? "border-grass bg-grass text-night glow-grass" : "border-night/10 text-chalk hover:bg-night/5"
                    }`}
                  >
                    <Flag logoUrl={t.logo_url} name={t.name} size={16} />
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 glass-strong rounded-2xl p-5 text-center">
            <p className="mb-3 font-display text-lg text-gradient-gold">Champion 🏆</p>
            <div className="flex flex-wrap justify-center gap-3">
              {[T.bra, T.fra].map((t) => (
                <motion.button
                  key={t.id}
                  whileTap={{ scale: 0.9 }}
                  whileHover={{ scale: 1.05 }}
                  onClick={() => {
                    setChamp(t.id);
                    celebrate();
                    goalCelebration("CHAMPION!");
                  }}
                  className={`flex items-center gap-2 rounded-xl border px-5 py-3 font-display text-base transition sm:text-lg ${
                    champ === t.id ? "border-gold bg-gold/15 text-gold glow-gold" : "border-night/10 text-chalk hover:bg-night/5"
                  }`}
                >
                  {champ === t.id && "👑"}
                  <Flag logoUrl={t.logo_url} name={t.name} size={26} />
                  {t.name}
                </motion.button>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      <PitchDivider />

      {/* MATCH CARDS */}
      <Reveal>
        <section>
          <SectionTitle>Match predictions</SectionTitle>

          {/* Upcoming (interactive) */}
          <div className="glass rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between gap-2 text-xs text-chalk-dim">
              <span className="truncate font-display text-gold">Round of 16</span>
              <span className="shrink-0 whitespace-nowrap">Sat, Jun 27, 8:00 PM</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-center sm:gap-4">
              <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-sm font-semibold text-chalk sm:gap-2 sm:text-base">
                <span className="truncate">France</span>
                <Flag logoUrl={T.fra.logo_url} name="France" size={26} />
              </span>
              <div className="flex items-center gap-2">
                <Stepper value={home} setValue={setHome} />
                <span className="text-chalk-dim">–</span>
                <Stepper value={away} setValue={setAway} />
              </div>
              <span className="flex min-w-0 flex-1 items-center justify-start gap-1.5 text-sm font-semibold text-chalk sm:gap-2 sm:text-base">
                <Flag logoUrl={T.esp.logo_url} name="Spain" size={26} />
                <span className="truncate">Spain</span>
              </span>
            </div>
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-medium text-chalk-dim">⚽ Goal scorers</p>
              <div className="flex flex-wrap gap-1.5">
                {scorerList.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setScorers((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))}
                    className={`flex items-center gap-1.5 rounded-full border py-1 pl-0.5 pr-2.5 text-xs transition ${
                      scorers.includes(p.id) ? "border-grass bg-grass text-night" : "border-night/10 text-chalk hover:bg-night/5"
                    }`}
                  >
                    <PlayerAvatar playerId={p.id} name={p.name} size={20} />
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  burst();
                  goalCelebration("GOAL!");
                }}
                className="min-h-11 rounded-xl bg-grass px-4 py-2 text-sm font-semibold text-night glow-grass transition hover:brightness-110"
              >
                Save
              </motion.button>
            </div>
          </div>

          {/* Finished */}
          <div className="mt-3 glass rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between gap-2 text-xs text-chalk-dim">
              <span className="truncate font-display text-gold">Group Stage</span>
              <span className="shrink-0 whitespace-nowrap">Played</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-center sm:gap-4">
              <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-sm font-semibold text-chalk sm:gap-2 sm:text-base">
                <span className="truncate">Brazil</span>
                <Flag logoUrl={T.bra.logo_url} name="Brazil" size={26} />
              </span>
              <span className="net rounded-xl bg-night/5 px-4 py-2 font-display text-xl text-chalk">3 – 1</span>
              <span className="flex min-w-0 flex-1 items-center justify-start gap-1.5 text-sm font-semibold text-chalk sm:gap-2 sm:text-base">
                <Flag logoUrl={f("rs")} name="Serbia" size={26} />
                <span className="truncate">Serbia</span>
              </span>
            </div>
            <p className="mt-3 text-center text-xs text-chalk-dim">
              Your pick: <span className="text-chalk">2–1</span> · scorers: Vinícius, Rodrygo
            </p>
          </div>
        </section>
      </Reveal>

      <p className="pb-8 text-center text-xs text-chalk-dim">
        That&apos;s the vibe ⚽ — toggle sound bottom-right, try the tabs, champion, and 🍅 troll.
      </p>
    </main>
  );
}

function Stepper({ value, setValue }: { value: number; setValue: (fn: (n: number) => number) => void }) {
  return (
    <div className="flex flex-col items-center">
      <button onClick={() => setValue((n) => n + 1)} className="px-3 py-1 text-base leading-none text-chalk-dim hover:text-chalk" aria-label="Increase">
        ▲
      </button>
      <span className="net w-9 rounded-lg bg-night/5 py-1 text-center font-display text-lg text-chalk">{value}</span>
      <button onClick={() => setValue((n) => Math.max(0, n - 1))} className="px-3 py-1 text-base leading-none text-chalk-dim hover:text-chalk" aria-label="Decrease">
        ▼
      </button>
    </div>
  );
}
