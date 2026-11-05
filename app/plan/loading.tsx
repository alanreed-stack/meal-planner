import { PageSkeleton } from "@/components/skeleton";

export default function Loading() {
  return <PageSkeleton title="this week" rows={5} rowHeight="h-28" />;
}
