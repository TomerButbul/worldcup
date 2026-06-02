// Thin client for API-Football v3 (direct api-sports.io endpoint).
// Docs: https://www.api-football.com/documentation-v3

const BASE = "https://v3.football.api-sports.io";

interface ApiResponse<T> {
  response: T[];
  errors: unknown;
  results: number;
}

async function apiGet<T>(
  path: string,
  params: Record<string, string | number>,
  revalidateSeconds: number,
): Promise<T[]> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY is not set");

  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const res = await fetch(url, {
    headers: { "x-apisports-key": key },
    // Cache to respect the free-tier rate limit.
    next: { revalidate: revalidateSeconds },
  });
  if (!res.ok) {
    throw new Error(`API-Football ${path} -> ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as ApiResponse<T>;
  return json.response ?? [];
}

const LEAGUE = () => Number(process.env.API_FOOTBALL_LEAGUE_ID ?? 1);
const SEASON = () => Number(process.env.API_FOOTBALL_SEASON ?? 2026);

// --- Response shapes (only the fields we use) ---
export interface AfTeam {
  team: { id: number; name: string; code: string | null; logo: string };
}

export interface AfFixture {
  fixture: { id: number; date: string; status: { short: string } };
  league: { round: string };
  teams: { home: { id: number }; away: { id: number } };
  goals: { home: number | null; away: number | null };
}

export interface AfStanding {
  team: { id: number };
  // group name like "Group A"
}

export interface AfFixtureEvent {
  type: string; // "Goal", "Card", "subst", "Var"
  detail: string; // "Normal Goal" | "Penalty" | "Own Goal" | "Yellow Card" | "Red Card" | "Second Yellow card"
  player: { id: number | null; name: string | null };
  team: { id: number };
  time: { elapsed: number | null; extra: number | null };
}

// Teams change rarely — cache 12h.
export function fetchTeams() {
  return apiGet<AfTeam>("/teams", { league: LEAGUE(), season: SEASON() }, 43200);
}

// Standings give the group label per team — cache 1h.
export function fetchStandings() {
  return apiGet<{ league: { standings: { group: string; team: { id: number } }[][] } }>(
    "/standings",
    { league: LEAGUE(), season: SEASON() },
    3600,
  );
}

// Fixtures: cache short (60s) so live results stay fresh.
export function fetchFixtures() {
  return apiGet<AfFixture>("/fixtures", { league: LEAGUE(), season: SEASON() }, 60);
}

// Goal events for a single finished fixture — cache long once final.
export function fetchFixtureEvents(fixtureId: number) {
  return apiGet<AfFixtureEvent>("/fixtures/events", { fixture: fixtureId }, 3600);
}

export interface AfSquad {
  team: { id: number };
  players: { id: number; name: string }[];
}

// Squad for a team — used so users can predict goal scorers. Cache 24h.
export function fetchSquad(teamId: number) {
  return apiGet<AfSquad>("/players/squads", { team: teamId }, 86400);
}

// Map API-Football round strings to our match_stage enum.
export function mapStage(round: string): string {
  const r = round.toLowerCase();
  if (r.includes("group")) return "group";
  if (r.includes("round of 32")) return "round_of_32";
  if (r.includes("round of 16")) return "round_of_16";
  if (r.includes("quarter")) return "quarter";
  if (r.includes("semi")) return "semi";
  if (r.includes("3rd place") || r.includes("third place")) return "third_place";
  if (r.includes("final")) return "final";
  return "group";
}

// Map API-Football fixture status to our match_status.
export function mapStatus(short: string): string {
  // Finished states
  if (["FT", "AET", "PEN"].includes(short)) return "finished";
  // In-play states
  if (["1H", "2H", "HT", "ET", "P", "LIVE", "BT"].includes(short)) return "live";
  return "scheduled";
}
