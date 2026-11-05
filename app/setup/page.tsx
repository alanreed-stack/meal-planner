import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { seedStarterRecipes } from "@/lib/seed-recipes";
import { cardStyles } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";

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

export const metadata = { title: "Set up your household" };

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto w-full max-w-md space-y-6 px-4 py-10">
      <h1 className="text-2xl font-bold">Set up your household</h1>
      {error && <Notice tone="error">{error}</Notice>}

      <form action={create} className={cardStyles("default", true, "flex flex-col gap-4")}>
        <h2 className="font-semibold">I&apos;m first: create the household</h2>
        <Field label="Household name">
          <Input name="name" placeholder="e.g. The Reeds" />
        </Field>
        <Field label="Your name">
          <Input name="display_name" required />
        </Field>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" name="keto" className="size-5 accent-primary" /> I eat keto
        </label>
        <SubmitButton variant="primary">Create and load starter recipes</SubmitButton>
      </form>

      <form action={join} className={cardStyles("default", true, "flex flex-col gap-4")}>
        <h2 className="font-semibold">Join with an invite code</h2>
        <Field label="Invite code">
          <Input name="code" required />
        </Field>
        <Field label="Your name">
          <Input name="display_name" required />
        </Field>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" name="keto" className="size-5 accent-primary" /> I eat keto
        </label>
        <SubmitButton variant="primary">Join</SubmitButton>
      </form>
    </main>
  );
}
