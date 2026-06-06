import { describe, it, expect } from "vitest";
import { resolveActualBracket, type ActualMatch } from "@/lib/actual-bracket";

// A fully-played group where ids[0] finishes 1st … ids[3] last: each team beats
// every team listed after it 1-0 (so points 9/6/3/0, GD +3/+1/-1/-3).
function completeGroup(group: string, ids: number[], startId: number): ActualMatch[] {
  const ms: ActualMatch[] = [];
  let mid = startId;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      ms.push({
        id: mid++,
        stage: "group",
        group_label: group,
        status: "finished",
        home_team_id: ids[i],
        away_team_id: ids[j],
        home_goals: 1,
        away_goals: 0,
        winner_team_id: null,
      });
    }
  }
  return ms;
}

const ko = (
  no: string,
  stage: string,
  home: number,
  away: number,
  hg: number | null,
  ag: number | null,
  winner: number | null = null,
  status = "finished",
): ActualMatch => ({
  id: Number(no),
  stage,
  group_label: null,
  status,
  home_team_id: home,
  away_team_id: away,
  home_goals: hg,
  away_goals: ag,
  winner_team_id: winner,
});

describe("resolveActualBracket", () => {
  it("renders the full empty skeleton before any result exists", () => {
    const { rounds, champion, runnerUp, third } = resolveActualBracket([]);
    expect(rounds.map((r) => r.stage)).toEqual([
      "round_of_32",
      "round_of_16",
      "quarter",
      "semi",
      "third_place",
      "final",
    ]);
    expect(rounds[0].matches).toHaveLength(16); // R32
    const finalRound = rounds.find((r) => r.stage === "final")!;
    expect(finalRound.matches).toHaveLength(1);
    expect(finalRound.matches[0].no).toBe(104);
    expect(rounds.every((r) => r.matches.every((m) => m.home === null && m.away === null && m.winner === null))).toBe(true);
    expect(champion).toBeNull();
    expect(runnerUp).toBeNull();
    expect(third).toBeNull();
  });

  it("resolves a Round-of-32 tie from settled groups and reads its real winner", () => {
    // Groups A and B complete → match 73 = runner(A) v runner(B) = team 2 v team 12.
    const groups = [...completeGroup("A", [1, 2, 3, 4], 1000), ...completeGroup("B", [11, 12, 13, 14], 2000)];
    const r32 = ko("73", "round_of_32", 2, 12, 2, 1); // 2A beats 2B 2-1
    const { rounds } = resolveActualBracket([...groups, r32]);
    const m73 = rounds[0].matches.find((m) => m.no === 73)!;
    expect(m73.home).toBe(2);
    expect(m73.away).toBe(12);
    expect(m73.winner).toBe(2);
  });

  it("propagates a winner into the next round's feeder slot", () => {
    // 90 = W(73) v W(75) per BRACKET_TREE. With only A & B settled, 75 stays TBD.
    const groups = [...completeGroup("A", [1, 2, 3, 4], 1000), ...completeGroup("B", [11, 12, 13, 14], 2000)];
    const r32 = ko("73", "round_of_32", 2, 12, 0, 3); // 2B (12) advances
    const { rounds } = resolveActualBracket([...groups, r32]);
    const r16 = rounds.find((r) => r.stage === "round_of_16")!;
    const m90 = r16.matches.find((m) => m.no === 90)!;
    expect(m90.home).toBe(12); // winner of 73 fed in
    expect(m90.away).toBeNull(); // winner of 75 not yet known
  });

  it("uses winner_team_id for shootouts (level scoreline)", () => {
    const groups = [...completeGroup("A", [1, 2, 3, 4], 1000), ...completeGroup("B", [11, 12, 13, 14], 2000)];
    const r32 = ko("73", "round_of_32", 2, 12, 1, 1, 12); // 1-1, 12 wins on pens
    const { rounds } = resolveActualBracket([...groups, r32]);
    expect(rounds[0].matches.find((m) => m.no === 73)!.winner).toBe(12);
  });

  it("takes the 3rd-place result from the real third_place fixture", () => {
    const tp = ko("103", "third_place", 5, 6, 2, 0); // team 5 wins bronze
    const { rounds, third } = resolveActualBracket([tp]);
    const tpRound = rounds.find((r) => r.stage === "third_place")!;
    expect(tpRound.matches[0]).toMatchObject({ no: 103, home: 5, away: 6, winner: 5 });
    expect(third).toBe(5);
  });

  it("crowns the champion and runner-up from a finished final", () => {
    const final = ko("104", "final", 7, 9, 3, 1); // 7 champion, 9 runner-up
    const { champion, runnerUp } = resolveActualBracket([final]);
    expect(champion).toBe(7);
    expect(runnerUp).toBe(9);
  });
});
