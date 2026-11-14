"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { FillInput } from "@/lib/autofill";

const PlanContext = createContext<FillInput | null>(null);

/**
 * Hands the week's recipes and plan to the buttons that suggest things (Swap, the Add meal picker), once for the
 * whole page, instead of repeating it inside every day.
 */
export function PlanProvider({ input, children }: { input: FillInput; children: ReactNode }) {
  return <PlanContext.Provider value={input}>{children}</PlanContext.Provider>;
}

export function usePlanInput(): FillInput | null {
  return useContext(PlanContext);
}
