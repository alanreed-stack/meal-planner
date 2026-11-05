import type { Metadata } from "next";
import { requireHousehold } from "@/lib/household";
import { Nav } from "@/components/nav";
import { addStaple, addUsualStaples, removeStaple } from "./actions";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase, householdId, inviteCode } = await requireHousehold();
  const { data: staples } = await supabase
    .from("pantry_staples")
    .select("name_key, name")
    .eq("household_id", householdId)
    .order("name");

  return (
    <>
      <Nav inviteCode={inviteCode} />
      <main className="mx-auto max-w-2xl space-y-8 px-4 py-6">
        <h1 className="text-2xl font-bold">Settings</h1>

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
              className="min-w-0 flex-1 rounded border px-2 py-1.5"
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
