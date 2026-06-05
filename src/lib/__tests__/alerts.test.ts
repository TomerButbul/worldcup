import { describe, it, expect } from "vitest";
import { missingScorers, usersToNudge } from "@/lib/alerts";

describe("missingScorers", () => {
  it("returns the picked scorers that are not in the XI", () => {
    expect(missingScorers({ "10": 1, "20": 2 }, [10, 30])).toEqual([20]);
  });
  it("returns [] when every pick is starting", () => {
    expect(missingScorers({ "10": 1, "20": 2 }, [10, 20, 30])).toEqual([]);
  });
  it("treats an empty XI as every pick missing", () => {
    expect(missingScorers({ "10": 1, "20": 1 }, [])).toEqual([10, 20]);
  });
  it("handles null / empty predictions", () => {
    expect(missingScorers(null, [1, 2])).toEqual([]);
    expect(missingScorers({}, [1, 2])).toEqual([]);
  });
  it("accepts a Set for the XI", () => {
    expect(missingScorers({ "5": 1 }, new Set([5]))).toEqual([]);
  });
});

describe("usersToNudge", () => {
  it("excludes users who already predicted", () => {
    expect(usersToNudge(["a", "b", "c"], ["b"])).toEqual(["a", "c"]);
  });
  it("dedupes eligible ids", () => {
    expect(usersToNudge(["a", "a", "b"], [])).toEqual(["a", "b"]);
  });
  it("returns [] when everyone already predicted", () => {
    expect(usersToNudge(["a", "b"], ["a", "b"])).toEqual([]);
  });
});
