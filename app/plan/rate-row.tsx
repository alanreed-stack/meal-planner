"use client";

import { useOptimistic } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { useToast } from "@/components/ui/toast";
import { rateMeal } from "./actions";

/** One "How was dinner?" line. The row disappears the moment you answer. */
export function RateRow({ id, when, name }: { id: string; when: string; name: string }) {
  const [gone, setGone] = useOptimistic(false);
  const toast = useToast();

  const answer = (rating: 1 | -1 | 0) => async () => {
    setGone(true);
    const fd = new FormData();
    fd.set("id", id);
    fd.set("rating", String(rating));
    try {
      await rateMeal(fd);
    } catch {
      toast.show({ message: "Couldn't save that rating. Try again.", tone: "error" });
    }
  };

  if (gone) return null;
  return (
    <li className="flex flex-wrap items-center gap-2">
      <span className="min-w-0 flex-1">
        <span className="text-muted">{when}: </span>
        {name}
      </span>
      <div className="flex items-center gap-1">
        <form action={answer(1)}>
          <IconButton type="submit" label="Liked it" variant="secondary">
            <ThumbsUp aria-hidden className="size-5" />
          </IconButton>
        </form>
        <form action={answer(-1)}>
          <IconButton type="submit" label="Not a fan" variant="secondary">
            <ThumbsDown aria-hidden className="size-5" />
          </IconButton>
        </form>
        <form action={answer(0)}>
          <Button type="submit" variant="ghost" size="sm">
            skip
          </Button>
        </form>
      </div>
    </li>
  );
}
