import { requireHousehold } from "@/lib/household";
import { Nav } from "@/components/nav";
import { BackLink } from "@/components/ui/back-link";
import { NewRecipeForm } from "./form";

export const metadata = { title: "Add a recipe" };

export default async function NewRecipePage() {
  await requireHousehold();
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        <BackLink href="/recipes">All recipes</BackLink>
        <h1 className="mb-4 mt-2 text-2xl font-bold">Add a recipe</h1>
        <NewRecipeForm />
      </main>
    </>
  );
}
