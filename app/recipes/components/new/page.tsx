import type { Metadata } from "next";
import { requireHousehold } from "@/lib/household";
import { Nav } from "@/components/nav";
import { BackLink } from "@/components/ui/back-link";
import { ComponentForm } from "../component-form";

export const metadata: Metadata = { title: "Add a component" };

export default async function NewComponentPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireHousehold();
  const { error } = await searchParams;
  return (
    <>
      <Nav />
      <main id="main" className="mx-auto w-full max-w-2xl px-4 py-6">
        <BackLink href="/recipes/components">Components</BackLink>
        <h1 className="mb-4 mt-2 text-2xl font-bold">Add a component</h1>
        <ComponentForm values={{ name: "", buy_as: "", buy_unit: "jar", ingredients: "" }} error={error} />
      </main>
    </>
  );
}
