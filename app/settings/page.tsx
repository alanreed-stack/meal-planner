import type { Metadata } from "next";
import { requireHousehold } from "@/lib/household";
import { Nav } from "@/components/nav";
import { addStaple, addUsualStaples, removeStaple } from "./actions";
import { CopyButton } from "./copy-button";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase, householdId, inviteCode, householdName, user } = await requireHousehold();
  const { data: members } = await supabase
    .from("household_members")
    .select("user_id, display_name, eats_keto")
    .eq("household_id", householdId)
    .order("created_at");
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

        <section>
          <h2 className="text-lg font-semibold">Household</h2>
          <p className="mb-3 text-sm text-neutral-600">
            {householdName}. Anyone with this code can join and will see all of your recipes, plans and
            lists, so only share it with family.
          </p>
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border bg-white p-3">
            <span className="text-sm text-neutral-600">Invite code</span>
            <code className="rounded bg-neutral-100 px-2 py-1 text-lg font-semibold tracking-wider">
              {inviteCode}
            </code>
            <CopyButton text={inviteCode} />
          </div>
          <ul className="divide-y rounded-xl border bg-white text-sm">
            {(members ?? []).map((m) => (
              <li key={m.user_id} className="flex items-center gap-2 px-3 py-2">
                <span className="flex-1">
                  {m.display_name || "Member"}
                  {m.user_id === user.id && <span className="ml-2 text-xs text-neutral-500">(you)</span>}
                </span>
                <span className="text-xs text-neutral-500">{m.eats_keto ? "eats keto" : "eats regular"}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Things we always have</h2>
          <p className="mb-3 text-sm text-neutral-600">
            These come off the shopping list unchecked, so you don&apos;t reorder olive oil every week. You can
            still check one on for a week when you run out. The name has to match the ingredient name, for
            example &ldquo;olive oil&rdquo;.
          </p>

          <ul className="mb-3 divide-y rounded-xl border bg-white">
            {(staples ?? []).map((s) => (
              <li key={s.name_key} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="flex-1">{s.name}</span>
                <form action={removeStaple}>
                  <input type="hidden" name="name_key" value={s.name_key} />
                  <button className="text-neutral-400 hover:text-red-700" aria-label={`Remove ${s.name}`}>
                    ✕
                  </button>
                </form>
              </li>
            ))}
            {(staples ?? []).length === 0 && (
              <li className="px-3 py-3 text-sm text-neutral-500">Nothing yet.</li>
            )}
          </ul>

          <form action={addStaple} className="mb-3 flex gap-2 text-sm">
            <input
              name="name"
              required
              placeholder="Add one (e.g. paprika)"
              className="w-full min-w-0 flex-1 rounded border px-2 py-1.5"
            />
            <button className="rounded bg-green-700 px-3 py-1.5 text-white">Add</button>
          </form>

          <form action={addUsualStaples}>
            <button className="rounded border px-3 py-1.5 text-sm">Add the usual spices, oils and sauces</button>
          </form>
        </section>
      </main>
    </>
  );
}
