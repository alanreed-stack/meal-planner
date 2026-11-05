import { Bar } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-xl space-y-3 px-4 py-6" aria-busy="true">
      <Bar className="h-8 w-40" />
      {Array.from({ length: 6 }, (_, i) => (
        <Bar key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}
