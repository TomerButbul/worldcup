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
  venueName: string | null;
  venueCity: string | null;
}

// Predictions are account-level (the same in every league), so we show ONE pick.
// The whole card is a link to that match on the global /predict page (anchored by
// id) so a tap takes you straight to its details + scorer picker.
export default function NextMatchCard({
  match,
  matchId,
  prediction,
  canPredict,
}: {
  match: NextMatchData;
  matchId: number;
  prediction: { home: number; away: number } | null;
  canPredict: boolean;
  // Accepted for call-site compatibility; the card now always opens the match on
  // the Matches page (/predict), which shows its predict / live / result card.
  leagueId?: string;
}) {
  const kickoff = new Date(match.kickoff_at).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Link
      href={`/predict#match-${matchId}`}
      className="block rounded-2xl glass p-4 transition hover:border-grass/50 hover:bg-night/5"
    >
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

      {match.venueName && (
        <p className="mt-2 truncate text-center text-[11px] text-chalk-dim">
          {match.venueName}
          {match.venueCity ? ` · ${match.venueCity}` : ""}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-night/5 pt-3">
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-chalk-dim">
          <Upfront size={13} /> Your prediction
        </p>
        {prediction ? (
          <span className="font-display text-chalk">
            {prediction.home}&ndash;{prediction.away}
          </span>
        ) : canPredict ? (
          <span className="shrink-0 rounded-lg bg-grass/15 px-2.5 py-1 text-xs font-semibold text-grass">
            Predict &rarr;
          </span>
        ) : (
          <span className="text-xs text-chalk-dim">Join a league to predict</span>
        )}
      </div>
    </Link>
  );
}
