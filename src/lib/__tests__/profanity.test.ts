import { describe, it, expect } from "vitest";
import { containsProfanity } from "@/lib/profanity";

describe("containsProfanity", () => {
  it("blocks obvious profanity and slurs", () => {
    for (const bad of ["fuck", "Shit Happens", "you bitch", "Nazi Germany", "f4ggot"]) {
      expect(containsProfanity(bad)).toBe(true);
    }
  });

  it("catches simple leetspeak + spacing/punctuation evasion", () => {
    for (const bad of ["5h1t", "f u c k", "F.U.C.K", "b!tch", "$h1t"]) {
      expect(containsProfanity(bad)).toBe(true);
    }
  });

  it("allows innocent names, incl. football names that share substrings", () => {
    for (const ok of [
      "Arsenal", "Dickson", "Torpedo Moscow", "Real Madrid", "Titans FC",
      "The Assassins", "Cocktail FC", "Grape Crushers", "Cucumber XI", "tomer",
    ]) {
      expect(containsProfanity(ok)).toBe(false);
    }
  });
});
