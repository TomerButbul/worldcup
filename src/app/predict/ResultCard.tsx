import Link from "next/link";
import LocalTime from "@/components/LocalTime";
import Flag from "@/components/Flag";
import { stageLabel } from "@/lib/stages";
import { venueImage } from "@/lib/venues";

// A finished match, compact but complete: stage + date, the result, the venue, and
// how your pick did. Taps through to the match page for the full breakdown.
export type ResultCardData = {
  id: number;
  stage: string;
  kickoff: string;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeName: string;
  awayName: string;
  homeGoals: number | null; // actual result
  awayGoals: number | null;
  venueId: number | null;
  venueName: string | null;
  venueCity: string | null;
  predHome: number | null; // your pick (null = no prediction)
  predAway: number | null;
};

function verdict(m: ResultCardData): { label: string; cls: string } {
  if (m.predHome == null || m.predAway == null) return { label: "No pick", cls: "bg-night/10 text-chalk-dim" };
  if (m.homeGoals == null || m.awayGoals == null) return { label: "—", cls: "bg-night/10 text-chalk-dim" };
  if (m.predHome === m.homeGoals && m.predAway === m.awayGoals) return { label: "✓ Exact", cls: "bg-grass/20 text-grass" };
  const sign = (h: number, a: number) => Math.sign(h - a);
  if (sign(m.predHome, m.predAway) === sign(m.homeGoals, m.awayGoals)) return { label: "Outcome ✓", cls: "bg-gold/20 text-gold" };
  return { label: "✗ Missed", cls: "bg-red-500/15 text-red-600" };
}

export default function ResultCard({ leagueId, m }: { leagueId: string; m: ResultCardData }) {
  const v = verdict(m);
  const pick = m.predHome != null ? `${m.predHome}–${m.predAway}` : "—";
  const venueSrc = m.venueId != null ? venueImage(m.venueId) : null;

  return (
    <Link
      href={`/leagues/${leagueId}/matches/${m.id}`}
      className="block rounded-2xl glass p-4 transition hover:border-grass/50 hover:bg-night/5"
    >
      <div className="mb-3 flex items-center justify-between gap-2 text-xs text-chalk-dim">
        <span className="font-display text-gold">{stageLabel(m.stage)}</span>
        <LocalTime iso={m.kickoff} mode="date" className="whitespace-nowrap" />
      </div>

      <div className="flex items-center justify-center gap-2 text-center sm:gap-4">
        <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-sm font-semibold text-chalk">
          <span className="truncate">{m.homeName}</span>
          <Flag teamId={m.homeTeamId} name={m.homeName} size={24} className="shrink-0" />
        </span>
        <span className="net shrink-0 rounded-xl bg-night/5 px-4 py-1.5 font-display text-xl text-chalk">
          {m.homeGoals ?? 0} – {m.awayGoals ?? 0}
        </span>
        <span className="flex min-w-0 flex-1 items-center justify-start gap-1.5 text-sm font-semibold text-chalk">
          <Flag teamId={m.awayTeamId} name={m.awayName} size={24} className="shrink-0" />
          <span className="truncate">{m.awayName}</span>
        </span>
      </div>

      {m.venueName && (
        <div className="mt-3 flex justify-center">
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-night/5 py-0.5 pl-0.5 pr-2.5 text-[11px] text-chalk-dim">
            {venueSrc && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={venueSrc} alt="" width={24} height={16} loading="lazy" className="h-4 w-6 shrink-0 rounded-full object-cover" />
            )}
            <span className="truncate">
              {m.venueName}
              {m.venueCity ? ` · ${m.venueCity}` : ""}
            </span>
          </span>
        </div>
      )}

      <div className="mt-3 flex items-center justify-center gap-2 text-xs text-chalk-dim">
        <span>
          Your pick: <span className="font-display tabular-nums text-chalk">{pick}</span>
        </span>
        <span className={`rounded-full px-2 py-0.5 font-semibold ${v.cls}`}>{v.label}</span>
      </div>
    </Link>
  );
}
