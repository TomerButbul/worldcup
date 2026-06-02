// Draft side-game: 48 teams tiered into three pots (1 = best). A pot's array
// order IS its draft "slot" order — slot N (1-based) is the team at index N-1,
// matching draft_picks.slot in migration 0010. Flags are emoji so the draft runs
// before real tournament teams are synced from the API.

export interface DraftTeam {
  name: string;
  flag: string;
}

export type Pot = 1 | 2 | 3;

export const DRAFT_POTS: Record<Pot, DraftTeam[]> = {
  1: [
    { name: "Argentina", flag: "🇦🇷" },
    { name: "France", flag: "🇫🇷" },
    { name: "Spain", flag: "🇪🇸" },
    { name: "England", flag: "🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}" },
    { name: "Brazil", flag: "🇧🇷" },
    { name: "Portugal", flag: "🇵🇹" },
    { name: "Germany", flag: "🇩🇪" },
    { name: "Netherlands", flag: "🇳🇱" },
    { name: "Uruguay", flag: "🇺🇾" },
    { name: "Croatia", flag: "🇭🇷" },
    { name: "Belgium", flag: "🇧🇪" },
    { name: "Colombia", flag: "🇨🇴" },
    { name: "Morocco", flag: "🇲🇦" },
    { name: "Senegal", flag: "🇸🇳" },
    { name: "Japan", flag: "🇯🇵" },
    { name: "Norway", flag: "🇳🇴" },
  ],
  2: [
    { name: "Mexico", flag: "🇲🇽" },
    { name: "Switzerland", flag: "🇨🇭" },
    { name: "USA", flag: "🇺🇸" },
    { name: "Sweden", flag: "🇸🇪" },
    { name: "Austria", flag: "🇦🇹" },
    { name: "Türkiye", flag: "🇹🇷" },
    { name: "Ecuador", flag: "🇪🇨" },
    { name: "Ghana", flag: "🇬🇭" },
    { name: "Algeria", flag: "🇩🇿" },
    { name: "Côte d'Ivoire", flag: "🇨🇮" },
    { name: "Paraguay", flag: "🇵🇾" },
    { name: "South Korea", flag: "🇰🇷" },
    { name: "Czechia", flag: "🇨🇿" },
    { name: "Canada", flag: "🇨🇦" },
    { name: "Australia", flag: "🇦🇺" },
    { name: "Scotland", flag: "🏴\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}" },
  ],
  3: [
    { name: "South Africa", flag: "🇿🇦" },
    { name: "Qatar", flag: "🇶🇦" },
    { name: "Bosnia & Herzegovina", flag: "🇧🇦" },
    { name: "Haiti", flag: "🇭🇹" },
    { name: "Iran", flag: "🇮🇷" },
    { name: "Curaçao", flag: "🇨🇼" },
    { name: "Tunisia", flag: "🇹🇳" },
    { name: "Egypt", flag: "🇪🇬" },
    { name: "New Zealand", flag: "🇳🇿" },
    { name: "Cape Verde", flag: "🇨🇻" },
    { name: "Saudi Arabia", flag: "🇸🇦" },
    { name: "Iraq", flag: "🇮🇶" },
    { name: "Jordan", flag: "🇯🇴" },
    { name: "Uzbekistan", flag: "🇺🇿" },
    { name: "DR Congo", flag: "🇨🇩" },
    { name: "Panama", flag: "🇵🇦" },
  ],
};

export const POT_LABELS: Record<Pot, string> = {
  1: "Pot 1 · Top tier",
  2: "Pot 2 · Mid tier",
  3: "Pot 3 · Long shots",
};

export const SEATS = 16;
export const TOTAL_PICKS = SEATS * 3; // 48

export interface DraftTurn {
  pot: Pot;
  seat: number; // 1..16
}

// Global pick index 0..47 -> whose turn it is. Snake order: pot 1 ascends seats
// 1->16, pots 2 & 3 descend 16->1. Mirrors draft_seat_for_index() in SQL.
export function turnFor(index: number): DraftTurn {
  const within = index % SEATS;
  const pot = (Math.floor(index / SEATS) + 1) as Pot;
  const seat = pot === 1 ? within + 1 : SEATS - within;
  return { pot, seat };
}

// Resolve a stored pick's (pot, slot) to its team. slot is 1-based.
export function teamAt(pot: number, slot: number): DraftTeam | undefined {
  return DRAFT_POTS[pot as Pot]?.[slot - 1];
}
