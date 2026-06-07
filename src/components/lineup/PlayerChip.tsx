"use client";

import PlayerAvatar from "@/components/PlayerAvatar";
import { PlayerCardButton } from "@/components/PlayerCard";
import { GoalMark, AssistMark, CardMark } from "./badges";
import type { PlayerMatchStat } from "@/lib/formation";

// One player tile on a formation pitch — the single shared chip used by the team
// profile, the predict scorer pitch, and the two-team match centre. Photo + position
// + name; OVR lives on the player card (tapped) to keep the pitch uncluttered.
//   • match centre  → pass `stat`/`subOn` for live goal/assist/card/▲ badges
//   • predict picker → pass `interactive` so tapping the face adds a goal
//   • team profile  → neither (static)
export default function PlayerChip({
  playerId,
  name,
  label,
  tone = "neutral",
  size = 30,
  stat,
  subOn = false,
  interactive,
}: {
  playerId: number;
  name: string;
  label?: string;
  tone?: "home" | "away" | "neutral";
  size?: number;
  stat?: PlayerMatchStat;
  subOn?: boolean;
  // Predict scorer picker: tap the face to add a goal. `count` = goals picked so far,
  // `atCap` disables adding once the predicted scoreline is reached.
  interactive?: { count: number; atCap: boolean; onAdd: () => void };
}) {
  const lastName = name.split(" ").slice(-1)[0] ?? name;
  const ring = tone === "home" ? "border-grass" : "border-white/85";
  const hasBadges = !interactive && !!stat && (stat.goals > 0 || stat.assists > 0 || stat.yellow > 0 || stat.red > 0);
  const count = interactive?.count ?? 0;

  const avatar = (
    <span className="relative inline-block">
      <PlayerAvatar playerId={playerId} name={name} size={size} className={`border-2 ${ring} shadow`} />

      {hasBadges && (
        <span className="pointer-events-none absolute -left-2 -top-2 flex flex-col items-start gap-0.5">
          {stat!.goals > 0 && <GoalMark count={stat!.goals} />}
          {stat!.assists > 0 && <AssistMark />}
          {stat!.red > 0 ? <CardMark color="red" /> : stat!.yellow > 0 ? <CardMark color="yellow" /> : null}
        </span>
      )}

      {interactive && count > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-grass px-0.5 text-[10px] font-bold leading-none text-night shadow">
          {count}
        </span>
      )}

      {subOn && (
        <span
          title="Substituted on"
          className="absolute -bottom-1 -right-1.5 flex h-[15px] w-[15px] items-center justify-center rounded-full border border-white/80 bg-grass text-[8px] font-black leading-none text-night shadow"
        >
          ▲
        </span>
      )}
    </span>
  );

  const labels = (
    <>
      {label && (
        <span className="rounded bg-night/70 px-1 text-[8px] font-bold uppercase leading-tight text-gold">{label}</span>
      )}
      <span className="max-w-[3.75rem] truncate rounded bg-night/45 px-1 text-[8px] leading-tight text-white">
        {lastName}
      </span>
    </>
  );

  // Predict picker: two clear targets — tap the FACE to add a goal, tap the NAME for
  // the player card (which also offers an "add a goal" action).
  if (interactive) {
    const { atCap, onAdd } = interactive;
    const disabled = atCap && count === 0;
    return (
      <div className="flex w-full flex-col items-center gap-0.5">
        <button
          type="button"
          onClick={onAdd}
          disabled={disabled}
          aria-label={`Add a goal for ${name}`}
          className={`rounded-full ${disabled ? "opacity-50" : "transition active:scale-95"}`}
        >
          {avatar}
        </button>
        <PlayerCardButton
          playerId={playerId}
          name={name}
          detailPos={label}
          action={atCap ? undefined : { label: count > 0 ? "⚽ Add another goal" : "⚽ Add a goal", run: onAdd }}
          className="flex flex-col items-center gap-0.5"
        >
          {labels}
        </PlayerCardButton>
      </div>
    );
  }

  // Static / match-centre: the whole tile opens the player card.
  return (
    <PlayerCardButton
      playerId={playerId}
      name={name}
      detailPos={label}
      className="flex w-full flex-col items-center gap-0.5"
    >
      {avatar}
      {labels}
    </PlayerCardButton>
  );
}
