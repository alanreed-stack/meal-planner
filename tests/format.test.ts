import { describe, expect, it } from "vitest";
import { clockBefore, formatAmount, formatIngredient, formatMinutes, formatQty } from "@/lib/format";

describe("formatQty", () => {
  it("uses kitchen fractions", () => {
    expect(formatQty(1.33)).toBe("1 ⅓");
    expect(formatQty(0.5)).toBe("½");
    expect(formatQty(2.75)).toBe("2 ¾");
    expect(formatQty(3)).toBe("3");
  });
  it("rounds a near-whole number to the whole", () => {
    expect(formatQty(2.97)).toBe("3");
    expect(formatQty(2.02)).toBe("2");
  });
  it("is empty for nothing", () => {
    expect(formatQty(0)).toBe("");
    expect(formatQty(NaN)).toBe("");
  });
});

describe("formatIngredient", () => {
  it("drops 'piece' and pluralizes the name", () => {
    expect(formatIngredient(8, "piece", "bone-in chicken thighs")).toBe("8 bone-in chicken thighs");
    expect(formatIngredient(1, "piece", "avocado")).toBe("1 avocado");
    expect(formatIngredient(2, "piece", "avocado")).toBe("2 avocados");
    expect(formatIngredient(2, "piece", "tomato")).toBe("2 tomatoes");
  });
  it("pluralizes units", () => {
    expect(formatIngredient(1.5, "cup", "shredded cheddar")).toBe("1 ½ cups shredded cheddar");
    expect(formatIngredient(1, "cup", "milk")).toBe("1 cup milk");
  });
  it("hides '(canned)' when it is bought by the can", () => {
    expect(formatIngredient(2, "can", "diced tomatoes (canned)")).toBe("2 cans diced tomatoes");
  });
  it("shows just the name when there is no amount", () => {
    expect(formatIngredient(null, null, "salt")).toBe("salt");
  });
});

describe("formatAmount", () => {
  it("shows the amount alone", () => {
    expect(formatAmount(4, "lb")).toBe("4 lb");
    expect(formatAmount(1.33, "cup")).toBe("1 ⅓ cups");
    expect(formatAmount(2, "piece")).toBe("2 pieces");
  });
});

describe("formatMinutes", () => {
  it("reads like a person would say it", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(60)).toBe("1 hr");
    expect(formatMinutes(245)).toBe("4 hr 5 min");
  });
  it("is 0 min for missing or zero", () => {
    expect(formatMinutes(null)).toBe("0 min");
    expect(formatMinutes(0)).toBe("0 min");
  });
});

describe("clockBefore", () => {
  it("counts back from dinner time", () => {
    expect(clockBefore("18:00:00", 0)).toBe("6:00 PM");
    expect(clockBefore("18:00:00", 490)).toBe("9:50 AM");
  });
  it("handles noon, midnight and wrapping past midnight", () => {
    expect(clockBefore("12:00:00", 0)).toBe("12:00 PM");
    expect(clockBefore("00:00:00", 0)).toBe("12:00 AM");
    expect(clockBefore("00:30:00", 60)).toBe("11:30 PM");
  });
});
