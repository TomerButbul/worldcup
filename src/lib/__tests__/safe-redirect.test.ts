import { describe, it, expect } from "vitest";
import { safeRelativePath } from "@/lib/safe-redirect";

describe("safeRelativePath", () => {
  it("keeps a normal same-site path", () => {
    expect(safeRelativePath("/reset-password")).toBe("/reset-password");
    expect(safeRelativePath("/dashboard")).toBe("/dashboard");
    expect(safeRelativePath("/leagues/abc?x=1")).toBe("/leagues/abc?x=1");
  });
  it("falls back when missing", () => {
    expect(safeRelativePath(null)).toBe("/dashboard");
    expect(safeRelativePath(undefined)).toBe("/dashboard");
    expect(safeRelativePath("")).toBe("/dashboard");
  });
  it("rejects off-site / open-redirect attempts", () => {
    expect(safeRelativePath("//evil.com")).toBe("/dashboard");
    expect(safeRelativePath("https://evil.com")).toBe("/dashboard");
    expect(safeRelativePath("http://evil.com")).toBe("/dashboard");
    expect(safeRelativePath("/\\evil.com")).toBe("/dashboard");
    expect(safeRelativePath("evil.com")).toBe("/dashboard");
  });
  it("honors a custom fallback", () => {
    expect(safeRelativePath(null, "/login")).toBe("/login");
  });
});
