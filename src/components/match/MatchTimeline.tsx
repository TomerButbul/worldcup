import type { EventRow } from "@/app/leagues/[id]/matches/[matchId]/Pitch";

// Chronological match-events timeline (goals/cards/subs) as a centre-rail list:
// home events to the left, away to the right, minute down the middle, with the
// assist/own-goal/penalty note beneath a goal. Shared by the match page and the
// live card so both read identically. Returns null when there are no events.
type TimelineItem = {
  side: "home" | "away" | null;
  icon: string;
  minute: number | null;
  primary: string;
  secondary: string | null;
};

export default function MatchTimeline({
  events,
  homeTeamId,
  awayTeamId,
  playerById,
}: {
  events: EventRow[];
  homeTeamId: number | null;
  awayTeamId: number | null;
  playerById: ReadonlyMap<number, { name: string }>;
}) {
  const timeline: TimelineItem[] = events.map((e) => {
    const side: "home" | "away" | null =
      e.team_id === homeTeamId ? "home" : e.team_id === awayTeamId ? "away" : null;
    const detail = (e.detail ?? "").toLowerCase();
    const name = e.player_name ?? (e.player_id != null ? playerById.get(e.player_id)?.name : null) ?? "—";
    let icon = "•";
    let secondary: string | null = null;
    if (e.type === "goal") {
      const isOwn = detail.includes("own");
      icon = "⚽️";
      const assist = e.related_name ?? (e.related_id != null ? playerById.get(e.related_id)?.name : null);
      secondary = isOwn ? "own goal" : detail.includes("pen") ? "penalty" : assist ? `assist · ${assist}` : null;
    } else if (e.type === "card") {
      icon = detail.includes("red") || detail.includes("second yellow") ? "🟥" : "🟨";
    } else if (e.type === "subst") {
      icon = "🔄";
      const off = e.related_name ?? (e.related_id != null ? playerById.get(e.related_id)?.name : null);
      secondary = off ? `↓ ${off}` : null;
    }
    return { side, icon, minute: e.minute, primary: name, secondary };
  });

  if (timeline.length === 0) return null;

  return (
    <ul className="glass relative space-y-3 rounded-2xl p-4">
      {/* centre rail */}
      <span className="pointer-events-none absolute inset-y-4 left-1/2 w-px -translate-x-1/2 bg-night/10" />
      {timeline.map((t, i) => (
        <li key={i} className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
          <div className={`min-w-0 ${t.side === "home" ? "text-right text-chalk" : "text-right text-transparent"}`}>
            {t.side === "home" && (
              <>
                <span className="font-semibold">{t.icon} {t.primary}</span>
                {t.secondary && <span className="block text-[11px] text-chalk-dim">{t.secondary}</span>}
              </>
            )}
          </div>
          <span className="z-10 shrink-0 rounded-full bg-night/5 px-2 py-0.5 font-display text-[11px] tabular-nums text-chalk-dim">
            {t.minute != null ? `${t.minute}'` : "·"}
          </span>
          <div className={`min-w-0 ${t.side === "away" ? "text-left text-chalk" : "text-left text-transparent"}`}>
            {t.side === "away" && (
              <>
                <span className="font-semibold">{t.primary} {t.icon}</span>
                {t.secondary && <span className="block text-[11px] text-chalk-dim">{t.secondary}</span>}
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
