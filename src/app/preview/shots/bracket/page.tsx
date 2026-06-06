"use client";

// TEMP screenshot route: a FULLY-played mock knockout tree (Brazil crowned) for
// marketing shots — best captured landscape on a wide screen. Deleted after capture.
import KnockoutBracket, { type BracketRound, type BracketTeam } from "@/components/KnockoutBracket";

const f = (iso: string) => `https://flagcdn.com/w80/${iso}.png`;
const T: [number, string, string, string][] = [
  [1, "Brazil", "BRA", "br"], [2, "Argentina", "ARG", "ar"], [3, "France", "FRA", "fr"], [4, "Spain", "ESP", "es"],
  [5, "England", "ENG", "gb-eng"], [6, "Germany", "GER", "de"], [7, "Netherlands", "NED", "nl"], [8, "Portugal", "POR", "pt"],
  [9, "Croatia", "CRO", "hr"], [10, "Belgium", "BEL", "be"], [11, "Uruguay", "URU", "uy"], [12, "Morocco", "MAR", "ma"],
  [13, "Japan", "JPN", "jp"], [14, "USA", "USA", "us"], [15, "Mexico", "MEX", "mx"], [16, "Senegal", "SEN", "sn"],
  [17, "Colombia", "COL", "co"], [18, "Switzerland", "SUI", "ch"], [19, "Denmark", "DEN", "dk"], [20, "South Korea", "KOR", "kr"],
  [21, "Poland", "POL", "pl"], [22, "Serbia", "SRB", "rs"], [23, "Ecuador", "ECU", "ec"], [24, "Ghana", "GHA", "gh"],
  [25, "Canada", "CAN", "ca"], [26, "Australia", "AUS", "au"], [27, "Cameroon", "CMR", "cm"], [28, "Nigeria", "NGA", "ng"],
  [29, "Norway", "NOR", "no"], [30, "Wales", "WAL", "gb-wls"], [31, "Ivory Coast", "CIV", "ci"], [32, "Austria", "AUT", "at"],
];
const teamsById: Record<number, BracketTeam> = {};
for (const [id, name, code, iso] of T) teamsById[id] = { id, name, code, logo_url: f(iso) };

const m = (no: number, home: number, away: number, winner: number) => ({ no, home, away, winner });
const rounds: BracketRound[] = [
  {
    stage: "round_of_32",
    label: "Round of 32",
    matches: [
      m(74, 1, 17, 1), m(77, 12, 18, 12), m(73, 3, 19, 3), m(75, 13, 20, 13), m(83, 5, 21, 5), m(84, 10, 22, 10), m(81, 7, 23, 7), m(82, 14, 24, 14),
      m(76, 2, 25, 2), m(78, 16, 26, 16), m(79, 4, 27, 4), m(80, 9, 28, 9), m(86, 8, 29, 8), m(88, 15, 30, 15), m(85, 6, 31, 6), m(87, 11, 32, 11),
    ],
  },
  { stage: "round_of_16", label: "Round of 16", matches: [m(89, 1, 12, 1), m(90, 3, 13, 3), m(93, 5, 10, 5), m(94, 7, 14, 7), m(91, 2, 16, 2), m(92, 4, 9, 4), m(95, 8, 15, 8), m(96, 6, 11, 6)] },
  { stage: "quarter", label: "Quarter-finals", matches: [m(97, 1, 3, 1), m(98, 5, 7, 5), m(99, 2, 4, 2), m(100, 8, 6, 8)] },
  { stage: "semi", label: "Semi-finals", matches: [m(101, 1, 5, 1), m(102, 2, 8, 2)] },
  { stage: "third_place", label: "3rd-place playoff", matches: [m(103, 5, 8, 5)] },
  { stage: "final", label: "Final", matches: [m(104, 1, 2, 1)] },
];

export default function ShotBracket() {
  return (
    <main className="mx-auto w-full max-w-2xl p-4 lg:max-w-[1600px] lg:p-8">
      <div className="glass-strong rounded-3xl p-3 sm:p-5">
        <KnockoutBracket rounds={rounds} teamsById={teamsById} championNo={104} locked treeOnly actual />
      </div>
    </main>
  );
}
