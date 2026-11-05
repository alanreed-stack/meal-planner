import type { Metadata } from "next";
import { X } from "lucide-react";
import { requireHousehold } from "@/lib/household";
import { Nav } from "@/components/nav";
import { Badge } from "@/components/ui/badge";
import { Card, cardStyles } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { SubmitIconButton } from "@/components/ui/icon-button";
import { addStaple, addUsualStaples, removeStaple } from "./actions";
import { savePlanSettings } from "../plan/actions";
import { CopyButton } from "./copy-button";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase, householdId, inviteCode, householdName, user } = await requireHousehold();
  const { data: members } = await supabase
    .from("household_members")
    .select("user_id, display_name, eats_keto")
    .eq("household_id", householdId)
    .order("created_at");
  const { data: hh } = await supabase
    .from("households")
    .select("default_protein_lbs, dinner_time")
    .eq("id", householdId)
    .single();
  const { data: staples } = await supabase
    .from("pantry_staples")
    .select("name_key, name")
    .eq("household_id", householdId)
    .order("name");

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-6">
        <h1 className="text-2xl font-bold">Settings</h1>

        <section id="household" className="scroll-mt-4">
          <h2 className="text-lg font-semibold">Household</h2>
          <p className="mb-3 text-sm text-muted">
            {householdName}. Anyone with this code can join and will see all of your recipes, plans and
            lists, so only share it with family.
          </p>
          <Card className="mb-3 flex flex-wrap items-center gap-3 p-3">
            <span className="text-sm text-muted">Invite code</span>
            <code className="rounded-sm bg-surface-muted px-2 py-1 text-lg font-semibold tracking-wider">
              {inviteCode}
            </code>
            <CopyButton text={inviteCode} />
          </Card>
          <form action={savePlanSettings} className={cardStyles("default", true, "mb-3 space-y-4")}>
            <h3 className="font-semibold">Planning</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Dinner at" hint="Used for the “start by” times on slow-cooker meals.">
                <Input name="time" type="time" defaultValue={String(hh?.dinner_time ?? "18:00:00").slice(0, 5)} />
              </Field>
              <Field label="Usual meat per meal (lb)" hint="Recipes and shopping lists scale to this.">
                <Input
                  name="lbs"
                  type="number"
                  step="0.25"
                  min="0.5"
                  max="10"
                  defaultValue={Number(hh?.default_protein_lbs ?? 2)}
                />
              </Field>
            </div>
            <SubmitButton variant="primary">Save</SubmitButton>
          </form>
          <Card as="ul" padded={false} className="divide-y divide-border text-sm">
            {(members ?? []).map((m) => (
              <li key={m.user_id} className="flex items-center gap-2 px-3 py-3">
                <span className="flex-1">
                  {m.display_name || "Member"}
                  {m.user_id === user.id && <span className="ml-2 text-xs text-muted">(you)</span>}
                </span>
                <Badge tone={m.eats_keto ? "diet-keto" : "neutral"}>
                  {m.eats_keto ? "eats keto" : "eats regular"}
                </Badge>
              </li>
            ))}
          </Card>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Things we always have</h2>
          <p className="mb-3 text-sm text-muted">
            These come off the shopping list unchecked, so you don&apos;t reorder olive oil every week. You can
            still check one on for a week when you run out. The name has to match the ingredient name, for
            example &ldquo;olive oil&rdquo;.
          </p>

          <Card as="ul" padded={false} className="mb-3 divide-y divide-border">
            {(staples ?? []).map((s) => (
              <li key={s.name_key} className="flex items-center gap-3 py-1 pl-3 pr-1 text-sm">
                <span className="flex-1">{s.name}</span>
                <form action={removeStaple}>
                  <input type="hidden" name="name_key" value={s.name_key} />
                  <SubmitIconButton label={`Remove ${s.name}`} variant="danger">
                    <X aria-hidden className="size-5" />
                  </SubmitIconButton>
                </form>
              </li>
            ))}
            {(staples ?? []).length === 0 && <li className="px-3 py-3 text-sm text-muted">Nothing yet.</li>}
          </Card>

          <form action={addStaple} className="mb-3 flex gap-2">
            <Input name="name" required placeholder="Add one (e.g. paprika)" className="min-w-0 flex-1" aria-label="Item to add" />
            <SubmitButton variant="primary">Add</SubmitButton>
          </form>

          <form action={addUsualStaples}>
            <SubmitButton>Add the usual spices, oils and sauces</SubmitButton>
          </form>
        </section>
      </main>
    </>
  );
}
