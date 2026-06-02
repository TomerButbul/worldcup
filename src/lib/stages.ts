import type { MatchStage } from "@/lib/types";

// Human label for a single match's stage. BracketEditor keeps its own plural
// labels ("Quarter-finals") because it names whole rounds, not one fixture.
export const STAGE_LABEL: Record<MatchStage, string> = {
  group: "Group Stage",
  round_of_32: "Round of 32",
  round_of_16: "Round of 16",
  quarter: "Quarter-final",
  semi: "Semi-final",
  third_place: "Third place",
  final: "Final",
};

export const stageLabel = (stage: string): string =>
  STAGE_LABEL[stage as MatchStage] ?? stage;
