import { describe, expect, it } from "vitest";
import { mainProtein } from "@/lib/protein";

const meat = (name: string, qty: number | null = 2, unit: string | null = "lb") => ({ name, qty, unit, category: "meat" });

describe("mainProtein, with the meat names that are actually in the recipe book", () => {
  const cases: [string, string][] = [
    ["chicken breasts", "chicken"], ["bone-in chicken thighs", "chicken"], ["chicken thighs (boneless)", "chicken"],
    ["chicken tenders", "chicken"], ["ground chicken", "chicken"], ["rotisserie chicken", "chicken"],
    ["ground beef", "beef"], ["ground beef 80/20", "beef"], ["flank steak", "beef"], ["sirloin steak", "beef"],
    ["sirloin or ribeye steak", "beef"], ["shaved or thin-sliced beef", "beef"], ["chuck roast", "beef"],
    ["ground pork", "pork"], ["boneless pork chops", "pork"], ["pork shoulder (Boston butt)", "pork"],
    ["Italian sausage", "pork"], ["smoked sausage", "pork"], ["bacon", "pork"],
    ["ground turkey", "turkey"], ["ground turkey 93%", "turkey"], ["turkey bacon", "turkey"],
    ["large shrimp (peeled)", "shrimp"], ["salmon fillets", "fish"], ["cod fillets", "fish"],
  ];
  it.each(cases)("%s is %s", (name, protein) => {
    expect(mainProtein([meat(name)])).toBe(protein);
  });

  it("picks the meat there is the most of", () => {
    expect(mainProtein([meat("bacon", 0.25), meat("chicken breasts", 2)])).toBe("chicken");
  });
  it("is none when there is no meat", () => {
    expect(mainProtein([{ name: "zucchini", qty: 3, unit: "piece", category: "produce" }])).toBe("none");
  });
});
