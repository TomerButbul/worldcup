// Curated details for the 16 host stadiums of the 2026 World Cup — capacity +
// country, which the fixture feed doesn't carry. Matched to the synced venue by a
// normalized name (with aliases for names the feed might use). Name + city come
// from the fixture; the photo comes from the venue id.

export type VenueInfo = {
  id: number | null;
  name: string;
  city: string | null;
  country: string | null;
  capacity: number | null;
  image: string | null; // null → the UI shows a styled fallback
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

// Keyed by normalized stadium name. `aliases` covers alternate names the feed may
// return (sponsor changes, "host-city stadium" naming, etc.).
const CURATED: Record<string, { country: string; capacity: number; aliases?: string[] }> = {
  mercedesbenzstadium: { country: "USA", capacity: 71000, aliases: ["atlantastadium"] },
  gillettestadium: { country: "USA", capacity: 65000, aliases: ["bostonstadium", "foxboroughstadium"] },
  attstadium: { country: "USA", capacity: 80000, aliases: ["dallasstadium", "cowboysstadium", "arlingtonstadium"] },
  nrgstadium: { country: "USA", capacity: 72000, aliases: ["houstonstadium"] },
  arrowheadstadium: { country: "USA", capacity: 76000, aliases: ["gehaarrowheadstadium", "kansascitystadium"] },
  sofistadium: { country: "USA", capacity: 70000, aliases: ["losangelesstadium", "inglewoodstadium"] },
  hardrockstadium: { country: "USA", capacity: 65000, aliases: ["miamistadium"] },
  metlifestadium: { country: "USA", capacity: 82500, aliases: ["newyorkstadium", "newyorknewjerseystadium", "eastrutherfordstadium"] },
  lincolnfinancialfield: { country: "USA", capacity: 69000, aliases: ["philadelphiastadium"] },
  levisstadium: { country: "USA", capacity: 68500, aliases: ["sanfranciscostadium", "bayareastadium", "santaclarastadium"] },
  lumenfield: { country: "USA", capacity: 69000, aliases: ["seattlestadium"] },
  estadioazteca: { country: "Mexico", capacity: 87000, aliases: ["estadiobanorte", "estadioguillermocanedo", "aztecastadium", "mexicocitystadium"] },
  estadioakron: { country: "Mexico", capacity: 49000, aliases: ["estadiochivas", "guadalajarastadium", "zapopanstadium"] },
  estadiobbva: { country: "Mexico", capacity: 53500, aliases: ["estadiobbvabancomer", "monterreystadium", "estadiobbvamonterrey"] },
  bmofield: { country: "Canada", capacity: 45000, aliases: ["torontostadium"] },
  bcplace: { country: "Canada", capacity: 54500, aliases: ["bcplacestadium", "vancouverstadium"] },
};

// Flatten aliases into one lookup.
const LOOKUP: Record<string, { country: string; capacity: number }> = {};
for (const [k, v] of Object.entries(CURATED)) {
  LOOKUP[k] = { country: v.country, capacity: v.capacity };
  for (const a of v.aliases ?? []) LOOKUP[norm(a)] = { country: v.country, capacity: v.capacity };
}

export function venueImage(id: number | null | undefined): string | null {
  return id ? `https://media.api-sports.io/football/venues/${id}.png` : null;
}

// Merge a synced fixture venue (id/name/city) with curated capacity/country.
export function resolveVenue(
  v: { id?: number | null; name?: string | null; city?: string | null } | null | undefined,
): VenueInfo | null {
  if (!v || !v.name) return null;
  const c = LOOKUP[norm(v.name)];
  return {
    id: v.id ?? null,
    name: v.name,
    city: v.city ?? null,
    country: c?.country ?? null,
    capacity: c?.capacity ?? null,
    image: venueImage(v.id),
  };
}
