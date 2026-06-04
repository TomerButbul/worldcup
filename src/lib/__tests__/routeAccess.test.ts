import { describe, it, expect } from "vitest";
import { isPublicPath, isAuthPath } from "@/lib/routeAccess";

describe("isPublicPath", () => {
  it("lets logged-out visitors reach pre-auth pages", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/signup")).toBe(true);
    expect(isPublicPath("/forgot-password")).toBe(true);
    expect(isPublicPath("/reset-password")).toBe(true);
    expect(isPublicPath("/how-it-works")).toBe(true);
    expect(isPublicPath("/install")).toBe(true);
    expect(isPublicPath("/preview")).toBe(true);
  });

  it("keeps API routes public so they return JSON, not an HTML redirect", () => {
    expect(isPublicPath("/api/sync")).toBe(true);
    expect(isPublicPath("/api/teams/1")).toBe(true);
  });

  // Regression guard for the invite-link bug: /join was missing from the
  // allow-list, so the proxy bounced logged-out invitees to /signup BEFORE the
  // /join route handler could stash the invite cookie. If anyone removes /join
  // here again, this test goes red instead of the bug shipping silently.
  it("keeps invite links public so the /join handler can save the invite cookie", () => {
    expect(isPublicPath("/join")).toBe(true);
    expect(isPublicPath("/join/ABC123")).toBe(true);
    expect(isPublicPath("/join/any-code-here")).toBe(true);
  });

  it("gates protected app routes (logged-out visitors get bounced to sign-up)", () => {
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/leagues/123")).toBe(false);
    expect(isPublicPath("/leagues/123/bracket")).toBe(false);
    expect(isPublicPath("/rankings")).toBe(false);
  });

  it("anchors the prefix at the start (no accidental matches mid-path)", () => {
    expect(isPublicPath("/leagues/join-something")).toBe(false);
    expect(isPublicPath("/dashboard/install")).toBe(false);
  });
});

describe("isAuthPath", () => {
  it("matches the auth screens", () => {
    expect(isAuthPath("/login")).toBe(true);
    expect(isAuthPath("/signup")).toBe(true);
  });
  it("rejects everything else", () => {
    expect(isAuthPath("/")).toBe(false);
    expect(isAuthPath("/dashboard")).toBe(false);
    expect(isAuthPath("/join/ABC")).toBe(false);
  });
});
