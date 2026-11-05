import { PageSkeleton } from "@/components/skeleton";

export default function Loading() {
  return <PageSkeleton title="shopping list" rows={6} rowHeight="h-14" />;
}
