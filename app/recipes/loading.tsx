import { PageSkeleton } from "@/components/skeleton";

export default function Loading() {
  return <PageSkeleton title="recipes" rows={5} rowHeight="h-32" />;
}
