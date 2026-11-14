import { describe, expect, it } from "vitest";
import { pickImage } from "@/lib/kroger";

const img = (perspective: string, sizes: Record<string, string>) => ({
  perspective,
  sizes: Object.entries(sizes).map(([size, url]) => ({ size, url })),
});

describe("pickImage", () => {
  it("takes the small front photo", () => {
    expect(
      pickImage([img("back", { small: "https://x/back.jpg" }), img("front", { thumbnail: "https://x/t.jpg", small: "https://x/s.jpg", large: "https://x/l.jpg" })])
    ).toBe("https://x/s.jpg");
  });
  it("falls back to the thumbnail, then any size", () => {
    expect(pickImage([img("front", { thumbnail: "https://x/t.jpg", large: "https://x/l.jpg" })])).toBe("https://x/t.jpg");
    expect(pickImage([img("front", { xlarge: "https://x/xl.jpg" })])).toBe("https://x/xl.jpg");
  });
  it("uses the first photo when none is marked front", () => {
    expect(pickImage([img("left", { small: "https://x/left.jpg" })])).toBe("https://x/left.jpg");
  });
  it("ignores missing or non-https photos", () => {
    expect(pickImage(undefined)).toBeNull();
    expect(pickImage([])).toBeNull();
    expect(pickImage([img("front", { small: "http://x/insecure.jpg" })])).toBeNull();
  });
});
