import { Bar } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-3 px-4 py-6" aria-busy="true">
      <Bar className="h-8 w-56" />
      <Bar className="h-24 w-full" />
      <Bar className="h-24 w-full" />
    </div>
  );
}
