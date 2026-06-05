// Lightweight name moderation for a family-friendly app. It blocks the obvious
// stuff on names shown publicly (display + team names), including simple
// leetspeak and spacing/punctuation evasion. Deliberately NOT exhaustive — the
// list is curated toward unambiguous terms to avoid false positives on innocent
// names (e.g. it uses "arsehole"/"dickhead" not bare "arse"/"dick", so Arsenal
// and Dickson are fine; "pedophil" not "pedo", so Torpedo is fine).

const BANNED = [
  // profanity
  "fuck", "motherfuck", "fucker", "shit", "bullshit", "bitch", "cunt",
  "bastard", "asshole", "arsehole", "dickhead", "wanker", "twat",
  "slut", "whore", "skank",
  // sexual
  "pussy", "penis", "vagina", "blowjob", "handjob", "boobs", "titties",
  "tits", "porn", "boner", "horny", "masturbat", "ejaculat", "rapist",
  "pedophil", "paedophil", "jizz", "cumshot",
  // slurs / hate — never wanted on a kids-friendly board
  "nigger", "nigga", "faggot", "retard", "tranny", "kike", "gook",
  "wetback", "spastic", "nazi", "hitler", "kkk",
];

// Common leetspeak → letters, applied before stripping non-letters.
const LEET: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "6": "g",
  "7": "t", "8": "b", "9": "g", "@": "a", "$": "s", "!": "i", "|": "i", "+": "t",
};

// Collapse a name to a comparison string: lowercase, strip accents, map leetspeak
// to letters, then drop everything that isn't a–z. So "F.u_c k", "Ｓhít", "5h1t"
// all collapse to a plain run of letters we can scan ("fuck", "shit", "shit").
function collapse(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split("")
    .map((c) => LEET[c] ?? c)
    .join("")
    .replace(/[^a-z]/g, "");
}

// True if the name contains a banned term (after evasion-resistant normalization).
export function containsProfanity(name: string): boolean {
  if (!name) return false;
  const c = collapse(name);
  if (!c) return false;
  return BANNED.some((w) => c.includes(w));
}
