import type { Metadata } from "next";
import { KeyRound, LogOut, Plus, X } from "lucide-react";
import { requireHousehold } from "@/lib/household";
import { Nav } from "@/components/nav";
import { weekStartOf, todayET } from "@/lib/dates";
import { signOut } from "@/lib/sign-out";
import { Badge } from "@/components/ui/badge";
import { ButtonAnchor, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { SubmitIconButton } from "@/components/ui/icon-button";
import { addStaple, addUsualStaples, leaveHousehold, removeStaple, saveMember } from "./actions";
import { Appearance } from "./appearance";
import { cookies } from "next/headers";
import { Notice } from "@/components/ui/notice";
import { savePlanSettings } from "../plan/actions";
import { CopyButton } from "./copy-button";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ left?: string }> }) {
  const { left } = await searchParams;
  const themeCookie = (await cookies()).get("theme")?.value;
  const theme = themeCookie === "light" || themeCookie === "dark" ? themeCookie : "auto";
  const { supabase, householdId, inviteCode, householdName, user } = await requireHousehold();
  const { data: members } = await supabase
    .from("household_members")
    .select("user_id, display_name, eats_keto")
    .eq("household_id", householdId)
    .order("created_at");
  const { data: hh } = await supabase
    .from("households")
    .select("default_protein_lbs, dinner_time, kroger_location_id, kroger_store_name, thaw_reminder")
    .eq("id", householdId)
    .single();
  const { data: staples } = await supabase
    .from("pantry_staples")
    .select("name_key, name")
    .eq("household_id", householdId)
    .order("name");

  const { data: conn } = await supabase.from("kroger_connections").select("user_id").maybeSingle();
  const weekStart = weekStartOf(todayET());

  return (
    <>
      <Nav />
      <main id="main" className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        {left === "last" && <Notice tone="warning">You are the only member, so you can&apos;t leave. Invite someone first.</Notice>}
        {left === "failed" && <Notice tone="error">Couldn&apos;t leave the household. Try again.</Notice>}

        <Card as="section" id="household" className="scroll-mt-4 space-y-4" aria-labelledby="h-household">
          <div>
            <h2 id="h-household" className="text-lg font-semibold">
              Household
            </h2>
            <p className="text-sm text-muted">
              {householdName}. Anyone with the invite code can join and will see all of your recipes, plans and
              lists, so only share it with family.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted">Invite code</span>
            <code className="rounded-sm bg-surface-muted px-2 py-1 text-lg font-semibold tracking-wider">
              {inviteCode}
            </code>
            <CopyButton text={inviteCode} />
          </div>

          <ul className="divide-y divide-border rounded-md border border-border text-sm">
            {(members ?? []).map((m) => (
              <li key={m.user_id} className="px-3 py-2">
                <div className="flex min-h-10 items-center gap-2">
                  <span className="flex-1">
                    {m.display_name || "Member"}
                    {m.user_id === user.id && <span className="ml-2 text-xs text-muted">(you)</span>}
                  </span>
                  <Badge tone={m.eats_keto ? "diet-keto" : "neutral"}>
                    {m.eats_keto ? "eats keto" : "eats regular"}
                  </Badge>
                </div>
                {m.user_id === user.id && (
                  <details className="mt-1">
                    <summary className="flex min-h-11 cursor-pointer items-center text-primary-ink underline">Edit my details</summary>
                    <form action={saveMember} className="space-y-3 pb-2">
                      <Field label="Your name">
                        <Input name="display_name" defaultValue={m.display_name ?? ""} maxLength={40} />
                      </Field>
                      <label className="flex min-h-11 items-center gap-3">
                        <input type="checkbox" name="keto" defaultChecked={m.eats_keto} className="size-5 accent-primary" />
                        I eat keto
                      </label>
                      <SubmitButton variant="primary">Save</SubmitButton>
                    </form>
                    <form action={leaveHousehold} className="border-t border-border pt-2">
                      {(members ?? []).length < 2 ? (
                        <p className="text-muted">You are the only member, so you can&apos;t leave. Invite someone first.</p>
                      ) : (
                        <details>
                          <summary className="flex min-h-11 cursor-pointer items-center text-danger-ink">Leave this household</summary>
                          <p className="mb-2 text-muted">
                            You will lose access to its recipes, plans and lists. Someone in the household can invite you back with the code.
                          </p>
                          <SubmitButton variant="danger">Yes, leave</SubmitButton>
                        </details>
                      )}
                    </form>
                  </details>
                )}
              </li>
            ))}
          </ul>

          <form action={savePlanSettings} className="space-y-4 border-t border-border pt-4">
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
            <input type="hidden" name="planning" value="1" />
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                name="thaw"
                defaultChecked={hh?.thaw_reminder ?? false}
                className="mt-0.5 size-5 shrink-0 accent-primary"
              />
              <span>
                <b>Thaw reminder.</b> <span className="text-muted">In the afternoon before a meat dinner, remind me on Home to move the meat to the fridge.</span>
              </span>
            </label>
            <SubmitButton variant="primary">Save</SubmitButton>
          </form>
        </Card>

        <Card as="section" id="staples" className="scroll-mt-4 space-y-4" aria-labelledby="h-staples">
          <div>
            <h2 id="h-staples" className="text-lg font-semibold">
              Things we always have
            </h2>
            <p className="text-sm text-muted">
              These come off the shopping list unchecked, so you don&apos;t reorder olive oil every week. You can
              still check one on for a week when you run out. The name has to match the ingredient name, for
              example &ldquo;olive oil&rdquo;.
            </p>
          </div>

          <ul className="flex flex-wrap gap-2">
            {(staples ?? []).map((s) => (
              <li
                key={s.name_key}
                className="flex items-center rounded-sm border border-border bg-surface-muted pl-3 text-sm"
              >
                <span>{s.name}</span>
                <form action={removeStaple}>
                  <input type="hidden" name="name_key" value={s.name_key} />
                  <SubmitIconButton label={`Remove ${s.name}`} variant="danger" compact>
                    <X aria-hidden className="size-4" />
                  </SubmitIconButton>
                </form>
              </li>
            ))}
            {(staples ?? []).length === 0 && <li className="text-sm text-muted">Nothing yet.</li>}
          </ul>

          <form action={addStaple} className="flex gap-2">
            <Input name="name" required placeholder="Add one (e.g. paprika)" className="min-w-0 flex-1" aria-label="Item to add" />
            <SubmitButton variant="primary">
              <Plus aria-hidden className="size-4" /> Add
            </SubmitButton>
          </form>

          <form action={addUsualStaples}>
            <SubmitButton>Add the usual spices, oils and sauces</SubmitButton>
          </form>
        </Card>

        <Card as="section" className="space-y-3" aria-labelledby="h-kroger">
          <div className="flex items-center gap-2">
            <h2 id="h-kroger" className="text-lg font-semibold">
              Kroger
            </h2>
            <Badge tone={conn ? "success" : "neutral"}>{conn ? "connected" : "not connected"}</Badge>
          </div>
          <p className="text-sm">
            <span className="text-muted">Store: </span>
            {hh?.kroger_location_id ? hh.kroger_store_name : "none chosen yet"}
          </p>
          <div className="flex flex-wrap gap-2">
            <ButtonAnchor href={`/api/kroger/connect?w=${weekStart}`}>{conn ? "Reconnect Kroger" : "Connect Kroger"}</ButtonAnchor>
            <ButtonLink href="/shopping#kroger">{hh?.kroger_location_id ? "Change store" : "Choose a store"}</ButtonLink>
          </div>
        </Card>

        <Card as="section" className="space-y-3" aria-labelledby="h-appearance">
          <div>
            <h2 id="h-appearance" className="text-lg font-semibold">
              Appearance
            </h2>
            <p className="text-sm text-muted">Saved on this phone or computer.</p>
          </div>
          <Appearance initial={theme} />
        </Card>

        <Card as="section" className="space-y-3" aria-labelledby="h-account">
          <h2 id="h-account" className="text-lg font-semibold">
            Account
          </h2>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/reset-password">
              <KeyRound aria-hidden className="size-4" /> Change password
            </ButtonLink>
            <form action={signOut}>
              <SubmitButton>
                <LogOut aria-hidden className="size-4" /> Sign out
              </SubmitButton>
            </form>
          </div>
        </Card>
      </main>
    </>
  );
}
