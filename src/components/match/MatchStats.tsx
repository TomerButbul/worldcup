import InfoTip from "@/components/InfoTip";
import type { ReactNode } from "react";

// Per-team match statistics (possession, shots, passes…) as a column of
// Google-style two-sided bars. Fed by the match_stats table (one jsonb map per
// team). Shared by the full match page and the live card on /predict.
export type StatMap = Record<string, string | number | null>;

// Numeric value for the proportional bars (strips "%"; 0 when absent).
const num = (v: string | number | null | undefined): number => {
  if (v == null) return 0;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};

// Rows of the stats comparison, in display order, with clean labels (the raw
// API keys are verbose). "—" stands in for any key a side hasn't reported.
const STAT_ROWS: { key: string; label: string }[] = [
  { key: "Total Shots", label: "Shots" },
  { key: "Shots on Goal", label: "Shots on target" },
  { key: "Shots insidebox", label: "Shots inside box" },
  { key: "Corner Kicks", label: "Corners" },
  { key: "Fouls", label: "Fouls" },
  { key: "Offsides", label: "Offsides" },
  { key: "Goalkeeper Saves", label: "Saves" },
  { key: "Passes accurate", label: "Accurate passes" },
  { key: "Passes %", label: "Pass accuracy" },
  { key: "Yellow Cards", label: "Yellow cards" },
  { key: "Red Cards", label: "Red cards" },
];

const statVal = (s: StatMap | null, key: string) => {
  const v = s?.[key];
  return v == null || v === "" ? "—" : String(v);
};

export default function MatchStats({
  homeStats,
  awayStats,
}: {
  homeStats: StatMap | null;
  awayStats: StatMap | null;
}) {
  const hasStats = !!homeStats || !!awayStats;

  // One stat row: the label centred with each side's value at the ends, over a
  // proportional two-sided bar (home = grass from the left, away = electric from
  // the right). The leader's value + bar segment are brighter.
  const statBar = (label: ReactNode, key: string) => {
    const hr = statVal(homeStats, key);
    const ar = statVal(awayStats, key);
    const h = num(homeStats?.[key]);
    const a = num(awayStats?.[key]);
    const tot = h + a;
    const hPct = tot > 0 ? (h / tot) * 100 : 50;
    const hLead = h > a;
    const aLead = a > h;
    return (
      <div key={key} className="space-y-1">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className={`w-12 shrink-0 tabular-nums font-bold ${hLead ? "text-grass" : "text-chalk"}`}>{hr}</span>
          <span className="flex-1 text-center text-[11px] text-chalk-dim">{label}</span>
          <span className={`w-12 shrink-0 text-right tabular-nums font-bold ${aLead ? "text-electric" : "text-chalk"}`}>{ar}</span>
        </div>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-night/10">
          <span className={`h-full transition-all ${hLead ? "bg-grass" : "bg-grass/35"}`} style={{ width: `${hPct}%` }} />
          <span className={`h-full transition-all ${aLead ? "bg-electric" : "bg-electric/35"}`} style={{ width: `${100 - hPct}%` }} />
        </div>
      </div>
    );
  };

  return (
    <section className="glass rounded-2xl p-4 sm:p-5">
      {!hasStats ? (
        <p className="py-6 text-center text-sm text-chalk-dim">Stats appear once the match is underway.</p>
      ) : (
        <div className="space-y-3.5">
          {/* xG — the headline modern stat, shown only when the feed provides it. */}
          {(homeStats?.["expected_goals"] != null || awayStats?.["expected_goals"] != null) &&
            statBar(
              <>
                Expected goals (xG){" "}
                <InfoTip>
                  <b>Expected goals (xG)</b> rates the quality of chances — the goals an average
                  side would score from those shots. Higher = better chances created.
                </InfoTip>
              </>,
              "expected_goals",
            )}
          {statBar("Possession", "Ball Possession")}
          {STAT_ROWS.map((r) => statBar(r.label, r.key))}
        </div>
      )}
    </section>
  );
}
