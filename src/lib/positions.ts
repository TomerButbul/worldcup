// Detailed football positions inferred from a formation's grid. The data feed
// only gives broad lines (G/D/M/F); we derive LW/RW/CB/CDM/CAM/RB/LB/ST… from
// each player's line + lateral slot within the row + how advanced the row is.
// Best-effort: the shape (defence/mid/attack, central/wide) is reliable; exact
// left↔right can mirror depending on the source grid's column convention.

// Labels for one row, in screen order (index 0 = screen-left) for a team
// attacking "up" the pitch. `frac` is the row's depth: 0 = own goal line,
// 1 = the attacking end. Callers reverse the array for a team facing the other
// way (e.g. the top half of a two-team pitch).
export function rowLabels(line: string | null, n: number, frac: number): string[] {
  const L = (line ?? "M").toUpperCase().charAt(0);

  if (L === "G") return Array(n).fill("GK");

  if (L === "D") {
    if (n <= 1) return ["CB"];
    if (n === 2) return ["CB", "CB"];
    if (n === 3) return ["LCB", "CB", "RCB"];
    if (n === 4) return ["LB", "LCB", "RCB", "RB"];
    if (n === 5) return ["LWB", "LCB", "CB", "RCB", "RWB"];
    return Array.from({ length: n }, (_, i) => (i === 0 ? "LB" : i === n - 1 ? "RB" : "CB"));
  }

  if (L === "F") {
    if (n <= 1) return ["ST"];
    if (n === 2) return ["LF", "RF"];
    if (n === 3) return ["LW", "ST", "RW"];
    if (n === 4) return ["LW", "ST", "ST", "RW"];
    return Array.from({ length: n }, (_, i) => (i === 0 ? "LW" : i === n - 1 ? "RW" : "ST"));
  }

  // Midfield: depth decides DM / CM / AM; very advanced wide mids become wingers.
  const central = frac <= 0.5 ? "CDM" : frac >= 0.72 ? "CAM" : "CM";
  const lw = frac >= 0.7 ? "LW" : "LM";
  const rw = frac >= 0.7 ? "RW" : "RM";
  if (n <= 1) return [central];
  if (n === 2) return frac <= 0.5 ? ["CDM", "CDM"] : ["CM", "CM"];
  if (n === 3) return [lw, central, rw];
  if (n === 4) return [lw, "CM", "CM", rw];
  if (n === 5) return [lw, "LCM", central, "RCM", rw];
  return Array.from({ length: n }, (_, i) => (i === 0 ? lw : i === n - 1 ? rw : "CM"));
}
