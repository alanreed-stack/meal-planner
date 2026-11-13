export type Diet = "both" | "family" | "keto";

/** The database stores diet as text (limited to these three by a check), so narrow it for the type system. */
export function asDiet(value: string): Diet {
  return value === "family" || value === "keto" ? value : "both";
}
