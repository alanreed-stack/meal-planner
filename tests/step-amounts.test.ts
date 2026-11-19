import { describe, expect, it } from "vitest";
import { amountsByStep } from "@/lib/step-amounts";

const ing = (name: string, text: string) => ({ name, text });
const list = [
  ing("ground beef", "2 lb ground beef"),
  ing("garlic", "4 cloves garlic"),
  ing("chicken breasts", "2 chicken breasts"),
  ing("chicken broth", "1 cup chicken broth"),
  ing("olive oil", "2 tbsp olive oil"),
  ing("shredded cheddar cheese", "1 cup shredded cheddar cheese"),
];

describe("amountsByStep", () => {
  it("finds ingredients named in a step", () => {
    const r = amountsByStep(["Heat the oil, then brown the beef and garlic."], list);
    expect(r[0].map((x) => x.text)).toEqual(["2 lb ground beef", "4 cloves garlic"]);
  });
  it("shows each ingredient once, at its first step", () => {
    const r = amountsByStep(["Add the garlic.", "Stir the garlic again."], list);
    expect(r[0]).toHaveLength(1);
    expect(r[1]).toHaveLength(0);
  });
  it("does not guess when two ingredients share a noun", () => {
    const r = amountsByStep(["Add the chicken and stir."], list);
    expect(r[0]).toEqual([]);
  });
  it("matches a full name when the noun is shared", () => {
    const r = amountsByStep(["Pour in the chicken broth."], list);
    expect(r[0].map((x) => x.text)).toEqual(["1 cup chicken broth"]);
  });
  it("handles plurals and extra words", () => {
    const r = amountsByStep(["Top with the cheddar cheese, then bake."], list);
    expect(r[0].map((x) => x.text)).toEqual(["1 cup shredded cheddar cheese"]);
  });
  it("handles 'or' options and a lone distinctive word", () => {
    const l = [ing("sirloin or ribeye steak", "2 lb steak"), ing("parsley or Italian seasoning", "1 tsp parsley"), ing("Frank's RedHot", "1/2 cup Frank's")];
    const r = amountsByStep(["Sear the steak.", "Toss with the parsley and Frank's."], l);
    expect(r[0].map((x) => x.text)).toEqual(["2 lb steak"]);
    expect(r[1].map((x) => x.text)).toEqual(["1 tsp parsley", "1/2 cup Frank's"]);
  });
  it("returns an empty list per step when nothing matches", () => {
    expect(amountsByStep(["Let it rest."], list)).toEqual([[]]);
  });
});
