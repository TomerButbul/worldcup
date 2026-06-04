import Link from "next/link";
import Flag from "@/components/Flag";
import MatchCountdown from "@/components/MatchCountdown";
import { Upfront } from "@/components/icons";
import { stageLabel } from "@/lib/stages";

export interface NextMatchData {
  stage: string;
  kickoff_at: string;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeName: string;
  awayName: string;
  homeCode: string | null;
  awayCode: string | null;
  homeLogoUrl: string | null;
  awayLogoUrl: string | null;
}

export interface LeaguePrediction {
  leagueId: string;
  leagueName: string;
  pred: { home: number; away: number } | null;
}

export default function NextMatchCard({
  match,
  predictions,
}: {
  match: NextMatchData;
  predictions: LeaguePrediction[];
}) {
  const kickoff = new Date(match.kickoff_at).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-chalk-dim">
        <span className="font-display text-gold">{stageLabel(match.stage)}</span>
        <span className="flex shrink-0 items-center gap-2">
          <MatchCountdown kickoff={match.kickoff_at} />
          <span className="whitespace-nowrap">{kickoff}</span>
        </span>
      </div>

      <div className="flex items-center justify-center gap-2 text-center sm:gap-4">
        <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-sm font-semibold text-chalk sm:gap-2 sm:text-base">
          <span className="truncate">{match.homeName}</span>
          <Flag
            teamId={match.homeTeamId}
            logoUrl={match.homeLogoUrl}
            code={match.homeCode}
            name={match.homeName}
            size={26}
            className="shrink-0"
          />
        </span>
        <span className="net rounded-xl bg-night/5 px-4 py-2 font-display text-lg text-chalk-dim">vs</span>
        <span className="flex min-w-0 flex-1 items-center justify-start gap-1.5 text-sm font-semibold text-chalk sm:gap-2 sm:text-base">
          <Flag
            teamId={match.awayTeamId}
            logoUrl={match.awayLogoUrl}
            code={match.awayCode}
            name={match.awayName}
            size={26}
            className="shrink-0"
          />
          <span className="truncate">{match.awayName}</span>
        </span>
      </div>

      {predictions.length > 0 ? (
        <div className="mt-4 space-y-1.5">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-chalk-dim"><Upfront size={13} /> Your prediction</p>
          {predictions.map((p) => (
            <div key={p.leagueId} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate text-chalk-dim">{p.leagueName}</span>
              {p.pred ? (
                <span className="font-display text-chalk">
                  {p.pred.home}–{p.pred.away}
                </span>
              ) : (
                <Link
                  href={`/leagues/${p.leagueId}/predict`}
                  className="shrink-0 rounded-lg bg-grass/15 px-2.5 py-1 text-xs font-semibold text-grass transition hover:bg-grass/25"
                >
                  Predict →
                </Link>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-center text-xs text-chalk-dim">
          Join a league below to predict this match.
        </p>
      )}
    </div>
  );
}
