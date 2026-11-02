import Link from "next/link";
import { requireHousehold } from "@/lib/household";
import { Nav } from "@/components/nav";
import { NewRecipeForm } from "./form";

export default async function NewRecipePage() {
  const { inviteCode } = await requireHousehold();
  return (
    <>
      <Nav inviteCode={inviteCode} />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <Link href="/recipes" className="text-sm text-green-800 underline">
          ← All recipes
        </Link>
        <h1 className="mb-4 mt-2 text-2xl font-bold">Add a recipe</h1>
        <NewRecipeForm />
      </main>
    </>
  );
}
