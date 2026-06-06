"use client";

// TEMP screenshot route: a clean leaderboard full of fun mascot managers, for
// marketing shots (portrait). Deleted after capture.
import Avatar from "@/components/Avatar";
import Flag from "@/components/Flag";
import { Upfront, Live, Trophy } from "@/components/icons";

const f = (iso: string) => `https://flagcdn.com/w80/${iso}.png`;
type Row = { name: string; iso: string; up: number; live: number; me?: boolean };
const ROWS: Row[] = [
  { name: "The Goal Diggers", iso: "br", up: 26, live: 18 },
  { name: "Tiki-Taka Tactics", iso: "es", up: 22, live: 16, me: true },
  { name: "Mbappé's Minions", iso: "fr", up: 19, live: 15 },
  { name: "Saka Potatoes", iso: "gb-eng", up: 17, live: 12 },
  { name: "Oranje Crush", iso: "nl", up: 14, live: 11 },
  { name: "Bielsa Believers", iso: "ar", up: 12, live: 9 },
  { name: "Kroos Control", iso: "de", up: 9, live: 6 },
  { name: "Last-Place Larry", iso: "pt", up: 3, live: 2 },
];
const RANK_COLOR = ["text-gold", "text-slate-300", "text-amber-600"];

export default function ShotLeaderboard() {
  const rows = [...ROWS].sort((a, b) => b.up + b.live - (a.up + a.live));
  return (
    <main className="mx-auto w-full max-w-md px-4 py-8">
      <div className="mb-3 flex items-center gap-2">
        <Trophy size={22} className="text-gold" />
        <h1 className="font-display text-2xl text-chalk">League Leaderboard</h1>
      </div>
      <div className="glass-strong overflow-hidden rounded-3xl">
        <div className="grid grid-cols-[1.75rem_1fr_2.5rem_2.5rem_3rem] items-center gap-2 border-b border-night/10 px-4 py-2.5 text-[11px] uppercase tracking-wider text-chalk-dim">
          <span>#</span>
          <span>Manager</span>
          <span className="flex justify-end"><Upfront size={14} /></span>
          <span className="flex justify-end"><Live size={14} /></span>
          <span className="flex justify-end"><Trophy size={14} /></span>
        </div>
        {rows.map((r, i) => {
          const top = i === 0;
          return (
            <div
              key={r.name}
              className={`grid grid-cols-[1.75rem_1fr_2.5rem_2.5rem_3rem] items-center gap-2 border-b border-night/5 px-4 py-3 text-sm last:border-0 ${
                top ? "bg-gold/15" : ""
              } ${r.me ? "ring-1 ring-inset ring-grass/50" : ""}`}
            >
              <span className="flex items-center justify-center font-bold tabular-nums">
                {top ? <Trophy size={17} className="text-gold" /> : <span className={RANK_COLOR[i] ?? "text-chalk-dim"}>{i + 1}</span>}
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <Avatar url={null} name={r.name} size={26} />
                <Flag logoUrl={f(r.iso)} name={r.name} size={18} />
                <span className="min-w-0 flex-1 truncate font-semibold text-chalk">{r.name}</span>
                {r.me && <span className="shrink-0 rounded bg-grass/20 px-1.5 py-0.5 text-[10px] font-bold text-grass">you</span>}
                {top && <span className="shrink-0">✨</span>}
              </span>
              <span className="text-right tabular-nums text-chalk/70">{r.up}</span>
              <span className="text-right tabular-nums text-chalk/70">{r.live}</span>
              <span className="text-right font-display text-base tabular-nums text-chalk">{r.up + r.live}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-xs text-chalk-dim">
        Three crowns up for grabs — best bracket, best live calls, best overall.
      </p>
    </main>
  );
}
