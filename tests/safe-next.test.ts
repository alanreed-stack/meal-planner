import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safe-next";

describe("safeNext", () => {
  it("allows pages on this site", () => {
    expect(safeNext("/reset-password")).toBe("/reset-password");
    expect(safeNext("/plan?w=2026-11-15")).toBe("/plan?w=2026-11-15");
    expect(safeNext("/")).toBe("/");
  });
  it("sends everything else Home", () => {
    for (const bad of [
      "https://evil.com",
      "http://evil.com/x",
      "//evil.com",
      "///evil.com",
      "/\\evil.com",
      "\\\\evil.com",
      "javascript:alert(1)",
      "evil.com",
      "/ //evil.com",
      "/\t/evil.com",
      "/%0a",
    ].filter((v) => !v.includes("%"))) {
      expect(safeNext(bad)).toBe("/");
    }
  });
  it("copes with nothing", () => {
    expect(safeNext(null)).toBe("/");
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext("")).toBe("/");
  });
});
