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
  teams: { home: { id: number; winner: boolean | null }; away: { id: number; winner: boolean | null } };
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
  // For a Goal: the assisting player. For a subst: the player coming OFF.
  assist: { id: number | null; name: string | null };
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

// Only currently-live fixtures (scores + status) — one cheap call for the live
// sync. Cache 20s so the per-minute live pinger always gets fresh numbers.
export function fetchLiveFixtures() {
  return apiGet<AfFixture>("/fixtures", { league: LEAGUE(), season: SEASON(), live: "all" }, 20);
}

// A team's most recent fixture in ANY competition — for its "latest lineup".
// Cache 6h (lineups change roughly weekly).
export function fetchTeamLastFixture(teamId: number) {
  return apiGet<AfFixture>("/fixtures", { team: teamId, last: 1 }, 21600);
}

// Goal/card/sub events for a fixture. Long cache for finished matches; pass a
// short revalidate (e.g. 20s) for live ones so the pitch stays current.
export function fetchFixtureEvents(fixtureId: number, revalidateSeconds = 3600) {
  return apiGet<AfFixtureEvent>("/fixtures/events", { fixture: fixtureId }, revalidateSeconds);
}

export interface AfSquad {
  team: { id: number };
  players: {
    id: number;
    name: string;
    age: number | null;
    number: number | null;
    position: string | null;
    photo: string | null;
  }[];
}

// Squad for a team — used so users can predict goal scorers. Cache 24h.
export function fetchSquad(teamId: number) {
  return apiGet<AfSquad>("/players/squads", { team: teamId }, 86400);
}

export interface AfLineupPlayer {
  // grid is "row:col" (row 1 = keeper, higher = more advanced; col = lateral slot).
  player: { id: number; name: string; number: number | null; pos: string | null; grid: string | null };
}
export interface AfLineup {
  team: { id: number; name: string };
  formation: string | null;
  startXI: AfLineupPlayer[];
  substitutes: AfLineupPlayer[];
}

// Official XI + subs for a fixture — only published ~20-40 min before kickoff.
// Cache 10 min: once announced it's stable, and it keeps the picker fresh
// without hammering the API while users sit on the page pre-kickoff.
export function fetchLineups(fixtureId: number) {
  return apiGet<AfLineup>("/fixtures/lineups", { fixture: fixtureId }, 600);
}

// Like apiGet but also returns the total page count (for paginated endpoints).
async function apiGetPaged<T>(
  path: string,
  params: Record<string, string | number>,
  revalidateSeconds: number,
): Promise<{ response: T[]; totalPages: number }> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY is not set");
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    headers: { "x-apisports-key": key },
    next: { revalidate: revalidateSeconds },
  });
  if (!res.ok) throw new Error(`API-Football ${path} -> ${res.status} ${res.statusText}`);
  const json = (await res.json()) as ApiResponse<T> & { paging?: { total?: number } };
  return { response: json.response ?? [], totalPages: json.paging?.total ?? 1 };
}

export interface AfPlayerProfile {
  player: {
    id: number;
    name: string;
    birth: { date: string | null } | null;
    nationality: string | null;
    height: string | null; // e.g. "176" (cm)
    weight: string | null; // e.g. "70" (kg)
  };
}

// Player physical/bio profiles for a team (paginated, ~3 pages/team). Cache 24h.
export function fetchPlayersByTeam(teamId: number, page: number) {
  return apiGetPaged<AfPlayerProfile>("/players", { team: teamId, season: SEASON(), page }, 86400);
}

// One player's per-competition statistics for a season + injury flag — powers
// the player card's club form. One entry per competition (club + country).
export interface AfPlayerStats {
  player: { id: number; injured: boolean | null };
  statistics: {
    team: { id: number; name: string } | null;
    league: { name: string | null } | null;
    games: { appearences: number | null; minutes: number | null; rating: string | null } | null;
    goals: { total: number | null; assists: number | null } | null;
  }[];
}
export function fetchPlayerStats(playerId: number, season: number) {
  return apiGet<AfPlayerStats>("/players", { id: playerId, season }, 86400);
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
