import { redirect } from "next/navigation";
import { requireHousehold } from "@/lib/household";

export default async function Home() {
  await requireHousehold();
  redirect("/recipes");
}
