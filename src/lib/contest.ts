// Single source of truth for "The TopCorner Invitational" — the free, skill-based
// cash-prize best-bracket contest. Reused by the signup invite banner, /invitational,
// /rules, the dashboard card and the admin vetting view so the wording, prize and
// dates never drift between surfaces.

export const INVITATIONAL_NAME = "The TopCorner Invitational";
export const INVITATIONAL_TAGLINE = "Invite a friend. Build your bracket. Best one wins.";

// The contest awards a cash prize. The amount isn't fixed yet — it depends on how
// many players join — so nothing hardcodes a figure. Copy uses this label inline
// ("wins a cash prize"); when you settle on an amount, set it to e.g. "$150" and the
// surrounding sentences still read naturally ("wins $150").
export const PRIZE_LABEL = "a cash prize";

// Sponsor + contact. The contact address doubles as the free alternative means of
// entry (AMOE) described in the official rules.
export const SPONSOR_NAME = "TopCorner";
export const CONTACT_EMAIL = "tomerbutbuleast@gmail.com";

// The contest runs over the World Cup. Brackets lock at kickoff; the winner is the
// single highest bracket score once the tournament is decided.
export const CONTEST_LOCK_LABEL = "World Cup kickoff (June 11, 2026)";
export const CONTEST_END_LABEL = "the World Cup 2026 Final (July 19, 2026)";

// Who may receive the cash prize. Eligibility to COMPETE is separate (referral —
// see prizeEligibility.ts); this is the legal floor for actually being paid.
export const MIN_AGE = 18;
