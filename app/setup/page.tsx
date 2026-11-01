import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { seedStarterRecipes } from "@/lib/seed-recipes";

async function create(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: hid, error } = await supabase.rpc("create_household", {
    p_name: String(formData.get("name") ?? ""),
    p_display_name: String(formData.get("display_name") ?? ""),
    p_keto: formData.get("keto") === "on",
  });
  if (error) redirect(`/setup?error=${encodeURIComponent(error.message)}`);
  await seedStarterRecipes(supabase, hid as string, user.id);
  redirect("/recipes");
}

async function join(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { error } = await supabase.rpc("join_household", {
    p_code: String(formData.get("code") ?? ""),
    p_display_name: String(formData.get("display_name") ?? ""),
    p_keto: formData.get("keto") === "on",
  });
  if (error) redirect(`/setup?error=${encodeURIComponent(error.message)}`);
  redirect("/recipes");
}

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const input = "rounded-lg border px-3 py-2";
  const btn = "rounded-lg bg-green-700 px-3 py-2 font-medium text-white";
  return (
    <main className="mx-auto max-w-md space-y-8 px-4 py-10">
      <h1 className="text-2xl font-bold">Set up your household</h1>
      {error && <p className="text-sm text-red-700">{error}</p>}

      <form action={create} className="flex flex-col gap-3 rounded-xl border p-4">
        <h2 className="font-semibold">I&apos;m first: create the household</h2>
        <input name="name" placeholder="Household name (e.g. The Reeds)" className={input} />
        <input name="display_name" required placeholder="Your name" className={input} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="keto" /> I eat keto
        </label>
        <button className={btn}>Create and load starter recipes</button>
      </form>

      <form action={join} className="flex flex-col gap-3 rounded-xl border p-4">
        <h2 className="font-semibold">Join with an invite code</h2>
        <input name="code" required placeholder="Invite code" className={input} />
        <input name="display_name" required placeholder="Your name" className={input} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="keto" /> I eat keto
        </label>
        <button className={btn}>Join</button>
      </form>
    </main>
  );
}
