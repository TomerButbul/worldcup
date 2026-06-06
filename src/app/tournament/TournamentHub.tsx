"use client";

import { useMemo, useState, type JSX, type ReactNode } from "react";
import Link from "next/link";
import Flag from "@/components/Flag";
import PlayerAvatar from "@/components/PlayerAvatar";
import { PlayerCardButton } from "@/components/PlayerCard";
import { TeamCardButton } from "@/components/TeamCard";
import KnockoutBracket, { type BracketRound, type BracketTeam } from "@/components/KnockoutBracket";
import AutoRefresh from "@/components/AutoRefresh";
import Ball from "@/components/art/Ball";
import Trophy from "@/components/art/Trophy";
import { Boot, Net } from "@/components/icons";
import { stageLabel } from "@/lib/stages";
import type { GroupStandings, StandingRow } from "@/lib/tournament-standings";

type TeamMini = { id: number; name: string; code: string | null; logo_url: string | null };
type FixtureView = {
  id: number;
  stage: string;
  group_label: string | null;
  kickoff_at: string;
  status: string;
  elapsed: number | null;
  home: number | null;
  away: number | null;
  homeGoals: number | null;
  awayGoals: number | null;
  winner: number | null;
  venueName: string | null;
  venueCity: string | null;
};
type LeaderRow = { playerId: number; count: number; name: string; teamId: number | null };

type Tab = "fixtures" | "standings" | "scorers" | "bracket";

const TABS: { key: Tab; label: string; short: string }[] = [
  { key: "fixtures", label: "Fixtures & Results", short: "Fixtures" },
  { key: "standings", label: "Group Standings", short: "Groups" },
  { key: "scorers", label: "Top Scorers", short: "Scorers" },
  { key: "bracket", label: "Knockout Bracket", short: "Bracket" },
];

export default function TournamentHub({
  teams,
  fixtures,
  standings,
  scorers,
  assisters,
  bracketRounds,
  champion,
  fifaRank,
  started,
}: {
  teams: TeamMini[];
  fixtures: FixtureView[];
  standings: GroupStandings[];
  scorers: LeaderRow[];
  assisters: LeaderRow[];
  bracketRounds: BracketRound[];
  champion: number | null;
  fifaRank: Record<number, number>;
  started: boolean;
}): JSX.Element {
  const [tab, setTab] = useState<Tab>("fixtures");

  const teamsById = useMemo(() => {
    const m: Record<number, TeamMini> = {};
    for (const t of teams) m[t.id] = t;
    return m;
  }, [teams]);

  const liveCount = fixtures.filter((f) => f.status === "live").length;
  const champTeam = champion != null ? teamsById[champion] : null;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 p-4 sm:space-y-5 sm:p-6 lg:max-w-[1600px] lg:p-8">
      <AutoRefresh enabled={started} />

      {/* Header */}
      <header className="glass-strong overflow-hidden rounded-3xl">
        <div className="relative p-5 sm:p-6">
          <Link href="/dashboard" className="text-sm text-chalk-dim transition hover:text-chalk">
            &larr; Home
          </Link>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl text-gradient-fifa sm:text-4xl">The Tournament</h1>
              <p className="mt-0.5 text-sm text-chalk-dim">
                Every fixture &amp; result, live group tables, the Golden Boot race, and the real bracket.
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

        {/* Tab bar */}
        <nav className="flex gap-1 overflow-x-auto border-t border-night/10 px-2 py-2">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${
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

      {tab === "fixtures" && <FixturesView fixtures={fixtures} teamsById={teamsById} />}
      {tab === "standings" && <StandingsView standings={standings} teamsById={teamsById} started={started} />}
      {tab === "scorers" && <ScorersView scorers={scorers} assisters={assisters} teamsById={teamsById} />}
      {tab === "bracket" && (
        <BracketView rounds={bracketRounds} teams={teams} fifaRank={fifaRank} hasResults={fixtures.some((f) => f.status !== "scheduled")} />
      )}

      {!started && (
        <p className="text-center text-xs text-chalk-dim">
          Kick-off is June 11 — standings, scorers and the bracket fill in live once the ball is rolling.
        </p>
      )}
    </main>
  );
}

// ── Fixtures & Results ──────────────────────────────────────────────────────

function FixturesView({ fixtures, teamsById }: { fixtures: FixtureView[]; teamsById: Record<number, TeamMini> }) {
  const [showAll, setShowAll] = useState(false);
  const live = fixtures.filter((f) => f.status === "live");
  const upcoming = fixtures.filter((f) => f.status === "scheduled");
  const finished = fixtures.filter((f) => f.status === "finished").reverse(); // most recent first

  const upcomingDays = groupByDay(upcoming);
  const finishedDays = groupByDay(finished);
  const VISIBLE_DAYS = 3;
  const shownUpcoming = showAll ? upcomingDays : upcomingDays.slice(0, VISIBLE_DAYS);
  const hiddenCount = upcomingDays.slice(VISIBLE_DAYS).reduce((s, d) => s + d.matches.length, 0);

  if (fixtures.length === 0) {
    return (
      <p className="glass rounded-2xl p-8 text-center text-sm text-chalk-dim">
        <Ball size={14} className="mr-1 inline-block align-[-2px]" />
        No fixtures loaded yet.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {live.length > 0 && (
        <section className="space-y-2">
          <SectionTitle tone="live">Live now</SectionTitle>
          <div className="grid gap-2 lg:grid-cols-2">
            {live.map((f) => (
              <FixtureRow key={f.id} f={f} teamsById={teamsById} />
            ))}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="space-y-3">
          <SectionTitle>Upcoming</SectionTitle>
          {shownUpcoming.map((d) => (
            <DayBlock key={d.day} day={d.day} matches={d.matches} teamsById={teamsById} />
          ))}
          {!showAll && hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="glass w-full rounded-2xl p-3 text-center text-sm font-semibold text-gold transition hover:text-gold-bright"
            >
              Show the full schedule — {hiddenCount} more {hiddenCount === 1 ? "fixture" : "fixtures"} ▾
            </button>
          )}
        </section>
      )}

      {finished.length > 0 && (
        <section className="space-y-3">
          <SectionTitle>Results</SectionTitle>
          {finishedDays.map((d) => (
            <DayBlock key={d.day} day={d.day} matches={d.matches} teamsById={teamsById} />
          ))}
        </section>
      )}
    </div>
  );
}

function DayBlock({ day, matches, teamsById }: { day: string; matches: FixtureView[]; teamsById: Record<number, TeamMini> }) {
  return (
    <div className="space-y-2">
      <h3 className="px-1 font-display text-sm text-chalk-dim">{day}</h3>
      <div className="grid gap-2 lg:grid-cols-2">
        {matches.map((f) => (
          <FixtureRow key={f.id} f={f} teamsById={teamsById} />
        ))}
      </div>
    </div>
  );
}

function FixtureRow({ f, teamsById }: { f: FixtureView; teamsById: Record<number, TeamMini> }) {
  const home = f.home != null ? teamsById[f.home] : null;
  const away = f.away != null ? teamsById[f.away] : null;
  const live = f.status === "live";
  const finished = f.status === "finished";
  const showScore = live || finished;
  const meta = f.group_label ? `Group ${f.group_label}` : stageLabel(f.stage);

  return (
    <Link
      href={`/match/${f.id}`}
      className="glass block rounded-2xl p-3 transition hover:ring-1 hover:ring-gold/40"
    >
      <div className="mb-1.5 flex items-center justify-between text-[11px] text-chalk-dim">
        <span className="font-display uppercase tracking-wide text-gold/90">{meta}</span>
        {live ? (
          <span className="flex items-center gap-1 font-bold text-red-600">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
            {f.elapsed != null ? `${f.elapsed}'` : "LIVE"}
          </span>
        ) : finished ? (
          <span className="rounded bg-night/10 px-1.5 py-0.5 font-semibold text-chalk-dim">FT</span>
        ) : (
          <span className="tabular-nums">{fmtTime(f.kickoff_at)}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <TeamSide team={home} align="right" />
        <span
          className={`net shrink-0 rounded-lg px-2.5 py-1 text-center font-display tabular-nums ${
            live ? "bg-red-500/10 text-red-600" : "bg-night/5 text-chalk"
          }`}
        >
          {showScore ? `${f.homeGoals ?? 0}–${f.awayGoals ?? 0}` : <span className="text-sm text-chalk-dim">vs</span>}
        </span>
        <TeamSide team={away} align="left" />
      </div>
    </Link>
  );
}

function TeamSide({ team, align }: { team: TeamMini | null; align: "left" | "right" }) {
  const name = team?.name ?? "TBD";
  const flag = (
    <Flag teamId={team?.id ?? null} logoUrl={team?.logo_url ?? null} code={team?.code ?? null} name={name} size={22} className="shrink-0" />
  );
  const label = <span className="min-w-0 truncate text-sm font-semibold text-chalk">{name}</span>;
  return (
    <span className={`flex min-w-0 flex-1 items-center gap-1.5 ${align === "right" ? "justify-end" : "justify-start"}`}>
      {align === "right" ? (
        <>
          {label}
          {flag}
        </>
      ) : (
        <>
          {flag}
          {label}
        </>
      )}
    </span>
  );
}

// ── Group standings ─────────────────────────────────────────────────────────

function StandingsView({
  standings,
  teamsById,
  started,
}: {
  standings: GroupStandings[];
  teamsById: Record<number, TeamMini>;
  started: boolean;
}) {
  if (standings.length === 0) {
    return (
      <p className="glass rounded-2xl p-8 text-center text-sm text-chalk-dim">
        <Ball size={14} className="mr-1 inline-block align-[-2px] " />
        Groups haven&apos;t been drawn into the database yet.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-chalk-dim">
        <Legend className="bg-grass/60" label="Top 2 — qualify" />
        <Legend className="bg-gold/70" label="3rd — best-thirds race" />
        {!started && <span className="text-chalk-dim/80">Seeded by FIFA ranking until kick-off.</span>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {standings.map((g) => (
          <GroupTable key={g.group} g={g} teamsById={teamsById} />
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

function GroupTable({ g, teamsById }: { g: GroupStandings; teamsById: Record<number, TeamMini> }) {
  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-night/10 px-3 py-2">
        <h3 className="font-display text-base text-chalk">Group {g.group}</h3>
        {g.complete && <span className="rounded-full bg-grass/15 px-2 py-0.5 text-[10px] font-semibold text-grass">Final</span>}
      </div>
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
            <StandingTr key={r.teamId} r={r} pos={i} team={teamsById[r.teamId] ?? null} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StandingTr({ r, pos, team }: { r: StandingRow; pos: number; team: TeamMini | null }) {
  // Qualification zones: top 2 advance (grass), 3rd contends for a best-thirds slot (gold).
  const zone = pos < 2 ? "border-l-2 border-grass bg-grass/5" : pos === 2 ? "border-l-2 border-gold/70 bg-gold/5" : "border-l-2 border-transparent";
  const name = team?.name ?? `#${r.teamId}`;
  return (
    <tr className={`${zone} border-b border-night/5 last:border-0`}>
      <td className="py-1.5 pl-2 text-left tabular-nums text-chalk-dim">{pos + 1}</td>
      <td className="py-1.5">
        <TeamCardButton teamId={r.teamId} name={name} className="flex items-center gap-1.5 transition hover:opacity-80">
          <Flag teamId={team?.id ?? null} logoUrl={team?.logo_url ?? null} code={team?.code ?? null} name={name} size={16} />
          <span className="min-w-0 max-w-[8rem] truncate font-semibold text-chalk">{name}</span>
        </TeamCardButton>
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

// ── Top scorers & assists ───────────────────────────────────────────────────

function ScorersView({
  scorers,
  assisters,
  teamsById,
}: {
  scorers: LeaderRow[];
  assisters: LeaderRow[];
  teamsById: Record<number, TeamMini>;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <LeaderBoard
        title="Golden Boot race"
        rows={scorers}
        teamsById={teamsById}
        icon={<Boot size={18} className="text-gold" />}
        unit="goals"
        empty="No goals yet — the race for the Golden Boot starts at kick-off."
      />
      <LeaderBoard
        title="Top assists"
        rows={assisters}
        teamsById={teamsById}
        icon={<Net size={18} className="text-electric" />}
        unit="assists"
        empty="No assists registered yet."
      />
    </div>
  );
}

function LeaderBoard({
  title,
  rows,
  teamsById,
  icon,
  unit,
  empty,
}: {
  title: string;
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
        <h3 className="font-display text-base text-chalk">{title}</h3>
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
  hasResults,
}: {
  rounds: BracketRound[];
  teams: TeamMini[];
  fifaRank: Record<number, number>;
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
        <KnockoutBracket rounds={rounds} teamsById={teamsById} championNo={104} locked fifaRank={fifaRank} />
      </div>
    </div>
  );
}

// ── Shared bits ─────────────────────────────────────────────────────────────

function SectionTitle({ children, tone }: { children: ReactNode; tone?: "live" }) {
  return (
    <h2 className={`flex items-center gap-2 font-display text-xl ${tone === "live" ? "text-red-600" : "text-chalk"}`}>
      {tone === "live" && <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" />}
      {children}
    </h2>
  );
}

function TabIcon({ tab }: { tab: Tab }) {
  const p = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (tab) {
    case "fixtures":
      return (
        <svg {...p}>
          <rect x="4" y="5" width="16" height="16" rx="2" />
          <path d="M4 9h16M8 3v4M16 3v4" />
        </svg>
      );
    case "standings":
      return (
        <svg {...p}>
          <path d="M4 7h16M4 12h16M4 17h16" />
          <path d="M9 4v16" strokeWidth={1.3} />
        </svg>
      );
    case "scorers":
      return <Boot size={17} />;
    case "bracket":
      return (
        <svg {...p}>
          <path d="M4 5h4v6h4M4 19h4v-6" />
          <path d="M20 12h-4M16 8v8" />
        </svg>
      );
  }
}

// Group fixtures into consecutive day blocks, labelled in the tournament's
// North-American day (so a late UTC kickoff stays with its day's slate).
function groupByDay(list: FixtureView[]): { day: string; matches: FixtureView[] }[] {
  const out: { day: string; matches: FixtureView[] }[] = [];
  for (const f of list) {
    const day = new Date(f.kickoff_at).toLocaleDateString("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const last = out[out.length - 1];
    if (last && last.day === day) last.matches.push(f);
    else out.push({ day, matches: [f] });
  }
  return out;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
