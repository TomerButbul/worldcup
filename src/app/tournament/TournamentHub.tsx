"use client";

import { useMemo, useState, type JSX } from "react";
import Link from "next/link";
import Flag from "@/components/Flag";
import PlayerAvatar from "@/components/PlayerAvatar";
import { PlayerCardButton } from "@/components/PlayerCard";
import { TeamCardButton } from "@/components/TeamCard";
import KnockoutBracket, { type BracketRound, type BracketTeam } from "@/components/KnockoutBracket";
import AutoRefresh from "@/components/AutoRefresh";
import Ball from "@/components/art/Ball";
import Trophy from "@/components/art/Trophy";
import { Boot, Net, Glove } from "@/components/icons";
import type { GroupStandings, StandingRow } from "@/lib/tournament-standings";

type TeamMini = { id: number; name: string; code: string | null; logo_url: string | null };
type LeaderRow = { playerId: number; count: number; name: string; teamId: number | null };
type LiveMatch = { group: string; homeTeamId: number | null; awayTeamId: number | null; homeGoals: number; awayGoals: number; elapsed: number | null };

type Tab = "standings" | "bracket" | "leaders";

const TABS: { key: Tab; label: string; short: string }[] = [
  { key: "standings", label: "Group Standings", short: "Groups" },
  { key: "bracket", label: "Knockout Bracket", short: "Bracket" },
  { key: "leaders", label: "Player Leaders", short: "Leaders" },
];

export default function TournamentHub({
  teams,
  standings,
  liveMatches,
  scorers,
  assisters,
  keepers,
  bracketRounds,
  champion,
  fifaRank,
  roundDates,
  liveCount,
  hasResults,
  started,
}: {
  teams: TeamMini[];
  standings: GroupStandings[];
  liveMatches: LiveMatch[];
  scorers: LeaderRow[];
  assisters: LeaderRow[];
  keepers: LeaderRow[];
  bracketRounds: BracketRound[];
  champion: number | null;
  fifaRank: Record<number, number>;
  roundDates: Record<string, string>;
  liveCount: number;
  hasResults: boolean;
  started: boolean;
}): JSX.Element {
  const [tab, setTab] = useState<Tab>("standings");

  const teamsById = useMemo(() => {
    const m: Record<number, TeamMini> = {};
    for (const t of teams) m[t.id] = t;
    return m;
  }, [teams]);

  const champTeam = champion != null ? teamsById[champion] : null;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 p-4 sm:space-y-5 sm:p-6 lg:max-w-[1600px] lg:p-8">
      <AutoRefresh enabled={started || liveCount > 0} />

      {/* Header */}
      <header className="glass-strong overflow-hidden rounded-3xl">
        <div className="relative p-5 sm:p-6">
          <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl text-shimmer-fifa sm:text-4xl">The Tournament</h1>
              <p className="mt-0.5 text-sm text-chalk-dim">
                Live group tables, the Golden Boot race, and the real knockout bracket.
              </p>
            </div>
            {liveCount > 0 && (
              <span className="flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1 text-xs font-bold text-red-600">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                {liveCount} live now
              </span>
            )}
          </div>

          {champTeam && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-gold/15 px-4 py-2.5 ring-1 ring-gold glow-gold">
              <Trophy size={30} />
              <Flag teamId={champTeam.id} logoUrl={champTeam.logo_url} code={champTeam.code} name={champTeam.name} size={24} />
              <div className="leading-tight">
                <p className="font-display text-lg text-gradient-gold">{champTeam.name}</p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-gold/80">World Champions</p>
              </div>
            </div>
          )}
        </div>

        {/* Tab bar — three equal columns so the labels sit evenly across the width. */}
        <nav className="grid grid-cols-3 gap-1 border-t border-night/10 px-2 py-2">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-current={active ? "page" : undefined}
                className={`flex w-full items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-sm font-semibold transition ${
                  active ? "bg-gold text-night glow-gold" : "text-chalk-dim hover:bg-night/5 hover:text-chalk"
                }`}
              >
                <TabIcon tab={t.key} />
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.short}</span>
              </button>
            );
          })}
        </nav>
      </header>

      {tab === "standings" && (
        <StandingsView standings={standings} teamsById={teamsById} started={started} liveMatches={liveMatches} />
      )}
      {tab === "bracket" && (
        <BracketView
          rounds={bracketRounds}
          teams={teams}
          fifaRank={fifaRank}
          roundDates={roundDates}
          hasResults={hasResults}
        />
      )}
      {tab === "leaders" && (
        <LeadersView scorers={scorers} assisters={assisters} keepers={keepers} teamsById={teamsById} />
      )}

      {!started && (
        <p className="text-center text-xs text-chalk-dim">
          Kick-off is June 11 — standings, scorers and the bracket fill in live once the ball is rolling.
        </p>
      )}
    </main>
  );
}

// ── Group standings ─────────────────────────────────────────────────────────

function StandingsView({
  standings,
  teamsById,
  started,
  liveMatches,
}: {
  standings: GroupStandings[];
  teamsById: Record<number, TeamMini>;
  started: boolean;
  liveMatches: LiveMatch[];
}) {
  if (standings.length === 0) {
    return (
      <p className="glass rounded-2xl p-8 text-center text-sm text-chalk-dim">
        <Ball size={14} className="mr-1 inline-block align-[-2px] " />
        Groups haven&apos;t been drawn into the database yet.
      </p>
    );
  }
  const liveByGroup = liveMatches.reduce<Record<string, LiveMatch[]>>((acc, m) => {
    (acc[m.group] ??= []).push(m);
    return acc;
  }, {});
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-chalk-dim">
        <Legend className="bg-grass/60" label="Top 2 — qualify" />
        <Legend className="bg-gold/70" label="3rd — best-thirds race" />
        {!started && <span className="text-chalk-dim/80">Seeded by FIFA ranking until kick-off.</span>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {standings.map((g) => (
          <GroupTable key={g.group} g={g} teamsById={teamsById} live={liveByGroup[g.group] ?? []} />
        ))}
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-sm ${className}`} />
      {label}
    </span>
  );
}

function GroupTable({ g, teamsById, live }: { g: GroupStandings; teamsById: Record<number, TeamMini>; live: LiveMatch[] }) {
  const code = (t: TeamMini | null) => t?.code ?? t?.name?.slice(0, 3).toUpperCase() ?? "—";

  // Per-team live score from their own perspective (for–against + clock).
  // Disappears automatically once the match leaves the liveMatches feed.
  const liveScoreByTeam = new Map<number, { for: number; against: number; elapsed: number | null }>();
  for (const m of live) {
    if (m.homeTeamId != null) liveScoreByTeam.set(m.homeTeamId, { for: m.homeGoals, against: m.awayGoals, elapsed: m.elapsed });
    if (m.awayTeamId != null) liveScoreByTeam.set(m.awayTeamId, { for: m.awayGoals, against: m.homeGoals, elapsed: m.elapsed });
  }

  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-night/10 px-3 py-2">
        <h3 className="font-display text-base text-chalk">Group {g.group}</h3>
        {g.complete ? (
          <span className="rounded-full bg-grass/15 px-2 py-0.5 text-[10px] font-semibold text-grass">Final</span>
        ) : live.length > 0 ? (
          <span className="flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-600">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> Live
          </span>
        ) : null}
      </div>

      {/* In-progress game(s) — the table already reflects provisional points;
          this strip shows the scoreline at a glance above the rows. */}
      {live.map((m, i) => {
        const h = m.homeTeamId != null ? teamsById[m.homeTeamId] : null;
        const a = m.awayTeamId != null ? teamsById[m.awayTeamId] : null;
        return (
          <div key={i} className="flex items-center justify-center gap-1.5 border-b border-night/10 bg-red-500/[0.04] px-3 py-1.5 text-[11px] font-semibold">
            <span className="flex items-center gap-1 text-chalk">
              <Flag teamId={m.homeTeamId} logoUrl={h?.logo_url ?? null} code={h?.code ?? null} name={h?.name ?? "?"} size={13} />
              {code(h)}
            </span>
            <span className="net rounded bg-night/10 px-1.5 font-display tabular-nums text-chalk">{m.homeGoals}–{m.awayGoals}</span>
            <span className="flex items-center gap-1 text-chalk">
              {code(a)}
              <Flag teamId={m.awayTeamId} logoUrl={a?.logo_url ?? null} code={a?.code ?? null} name={a?.name ?? "?"} size={13} />
            </span>
            <span className="ml-0.5 tabular-nums text-red-600">{m.elapsed != null ? `${m.elapsed}'` : "LIVE"}</span>
          </div>
        );
      })}

      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-chalk-dim">
            <th className="py-1 pl-2 text-left font-semibold">#</th>
            <th className="py-1 text-left font-semibold">Team</th>
            <th className="py-1 text-center font-semibold">P</th>
            <th className="hidden py-1 text-center font-semibold sm:table-cell">W</th>
            <th className="hidden py-1 text-center font-semibold sm:table-cell">D</th>
            <th className="hidden py-1 text-center font-semibold sm:table-cell">L</th>
            <th className="hidden py-1 text-center font-semibold sm:table-cell">GF</th>
            <th className="hidden py-1 text-center font-semibold sm:table-cell">GA</th>
            <th className="py-1 text-center font-semibold">GD</th>
            <th className="py-1 pr-2 text-center font-semibold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {g.rows.map((r, i) => (
            <StandingTr key={r.teamId} r={r} pos={i} team={teamsById[r.teamId] ?? null} liveScore={liveScoreByTeam.get(r.teamId)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StandingTr({ r, pos, team, liveScore }: { r: StandingRow; pos: number; team: TeamMini | null; liveScore?: { for: number; against: number; elapsed: number | null } }) {
  // Qualification zones: top 2 advance (grass), 3rd contends for a best-thirds slot (gold).
  const zone = pos < 2 ? "border-l-2 border-grass bg-grass/5" : pos === 2 ? "border-l-2 border-gold/70 bg-gold/5" : "border-l-2 border-transparent";
  const name = team?.name ?? `#${r.teamId}`;
  return (
    <tr className={`${zone} border-b border-night/5 last:border-0`}>
      <td className="py-1.5 pl-2 text-left tabular-nums text-chalk-dim">{pos + 1}</td>
      <td className="py-1.5">
        <div className="flex items-center gap-1.5">
          <TeamCardButton teamId={r.teamId} name={name} className="flex min-w-0 items-center gap-1.5 transition hover:opacity-80">
            <Flag teamId={team?.id ?? null} logoUrl={team?.logo_url ?? null} code={team?.code ?? null} name={name} size={16} />
            <span className="min-w-0 max-w-[6rem] truncate font-semibold text-chalk">{name}</span>
          </TeamCardButton>
          {liveScore && (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-red-500/15 px-1 py-0.5 font-display text-[10px] font-bold tabular-nums text-red-600">
              {liveScore.for}–{liveScore.against}
              {liveScore.elapsed != null && <span className="ml-0.5 font-sans font-semibold">{liveScore.elapsed}&apos;</span>}
            </span>
          )}
        </div>
      </td>
      <td className="py-1.5 text-center tabular-nums text-chalk-dim">{r.played}</td>
      <td className="hidden py-1.5 text-center tabular-nums text-chalk-dim sm:table-cell">{r.won}</td>
      <td className="hidden py-1.5 text-center tabular-nums text-chalk-dim sm:table-cell">{r.drawn}</td>
      <td className="hidden py-1.5 text-center tabular-nums text-chalk-dim sm:table-cell">{r.lost}</td>
      <td className="hidden py-1.5 text-center tabular-nums text-chalk-dim sm:table-cell">{r.gf}</td>
      <td className="hidden py-1.5 text-center tabular-nums text-chalk-dim sm:table-cell">{r.ga}</td>
      <td className="py-1.5 text-center tabular-nums text-chalk-dim">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
      <td className="py-1.5 pr-2 text-center font-display tabular-nums text-chalk">{r.pts}</td>
    </tr>
  );
}

// ── Player leaderboards (Golden Boot · Playmakers · Golden Glove) ────────────

function LeadersView({
  scorers,
  assisters,
  keepers,
  teamsById,
}: {
  scorers: LeaderRow[];
  assisters: LeaderRow[];
  keepers: LeaderRow[];
  teamsById: Record<number, TeamMini>;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <LeaderBoard
        title="Golden Boot"
        subtitle="Most goals"
        rows={scorers}
        teamsById={teamsById}
        icon={<Boot size={18} className="text-gold" />}
        unit="goals"
        empty="No goals yet — the race for the Golden Boot starts at kick-off."
      />
      <LeaderBoard
        title="Playmakers"
        subtitle="Most assists"
        rows={assisters}
        teamsById={teamsById}
        icon={<Net size={18} className="text-electric" />}
        unit="assists"
        empty="No assists registered yet."
      />
      <LeaderBoard
        title="Golden Glove"
        subtitle="Keeper clean sheets"
        rows={keepers}
        teamsById={teamsById}
        icon={<Glove size={18} className="text-sky-500" />}
        unit="clean sheets"
        empty="No clean sheets yet — shutouts count once knockout defences hold."
      />
    </div>
  );
}

function LeaderBoard({
  title,
  subtitle,
  rows,
  teamsById,
  icon,
  unit,
  empty,
}: {
  title: string;
  subtitle?: string;
  rows: LeaderRow[];
  teamsById: Record<number, TeamMini>;
  icon: JSX.Element;
  unit: string;
  empty: string;
}) {
  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="flex items-center gap-2 border-b border-night/10 px-4 py-2.5">
        {icon}
        <div className="min-w-0 leading-tight">
          <h3 className="font-display text-base text-chalk">{title}</h3>
          {subtitle && <p className="text-[10px] uppercase tracking-wide text-chalk-dim">{subtitle}</p>}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="p-6 text-center text-sm text-chalk-dim">{empty}</p>
      ) : (
        <ul className="divide-y divide-night/5">
          {rows.map((r, i) => {
            const team = r.teamId != null ? teamsById[r.teamId] : null;
            const top = i === 0;
            return (
              <li key={r.playerId} className={`flex items-center gap-2.5 px-3 py-2 ${top ? "bg-gold/5" : ""}`}>
                <span className={`w-5 text-center font-display tabular-nums ${top ? "text-gold" : "text-chalk-dim"}`}>{i + 1}</span>
                <PlayerCardButton playerId={r.playerId} name={r.name} className="flex min-w-0 flex-1 items-center gap-2 text-left transition hover:opacity-80">
                  <span className="relative shrink-0">
                    <PlayerAvatar playerId={r.playerId} name={r.name} size={32} className="ring-1 ring-night/10" />
                    {team && (
                      <span className="absolute -bottom-1 -right-1">
                        <Flag teamId={team.id} logoUrl={team.logo_url} code={team.code} name={team.name} size={14} className="rounded-full ring-1 ring-white" />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-chalk">{r.name}</span>
                    {team && <span className="block truncate text-[11px] text-chalk-dim">{team.name}</span>}
                  </span>
                </PlayerCardButton>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="font-display text-lg tabular-nums text-chalk">{r.count}</span>
                  <span className="text-[10px] uppercase text-chalk-dim">{unit}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Real knockout bracket ───────────────────────────────────────────────────

function BracketView({
  rounds,
  teams,
  fifaRank,
  roundDates,
  hasResults,
}: {
  rounds: BracketRound[];
  teams: TeamMini[];
  fifaRank: Record<number, number>;
  roundDates: Record<string, string>;
  hasResults: boolean;
}) {
  const teamsById: Record<number, BracketTeam> = {};
  for (const t of teams) teamsById[t.id] = { id: t.id, name: t.name, code: t.code, logo_url: t.logo_url };

  return (
    <div className="space-y-3">
      <div className="glass rounded-2xl p-3 text-center text-sm text-chalk-dim">
        The <span className="font-semibold text-chalk">real</span> knockout bracket — it fills in with actual results as
        the tournament unfolds.{" "}
        {!hasResults && (
          <>
            Want to make your call?{" "}
            <Link href="/bracket" className="font-semibold text-gold transition hover:text-gold-bright">
              Predict your bracket →
            </Link>
          </>
        )}
      </div>
      <div className="glass-strong rounded-3xl p-3 sm:p-5">
        {/* treeOnly = the full two-sided connected bracket (scrolls sideways on a
            phone) rather than the paged round-by-round view — the showpiece view. */}
        <KnockoutBracket
          rounds={rounds}
          teamsById={teamsById}
          championNo={104}
          locked
          treeOnly
          fifaRank={fifaRank}
          roundDates={roundDates}
          actual
        />
      </div>
    </div>
  );
}

// ── Shared bits ─────────────────────────────────────────────────────────────

function TabIcon({ tab }: { tab: Tab }) {
  const p = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (tab) {
    case "standings":
      return (
        <svg {...p}>
          <path d="M4 7h16M4 12h16M4 17h16" />
          <path d="M9 4v16" strokeWidth={1.3} />
        </svg>
      );
    case "leaders":
      // Podium / ranking bars — the tab now spans goals, assists & clean sheets.
      return (
        <svg {...p}>
          <path d="M5 21V11M12 21V4M19 21v-7" />
        </svg>
      );
    case "bracket":
      return (
        <svg {...p}>
          <path d="M4 5h4v6h4M4 19h4v-6" />
          <path d="M20 12h-4M16 8v8" />
        </svg>
      );
  }
}
