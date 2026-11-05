"use client";

import { useOptimistic } from "react";
import { Star, ThumbsDown, ThumbsUp } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { useToast } from "@/components/ui/toast";
import { rateRecipe, toggleFavorite } from "./actions";

/** The favorite star. It fills in the instant you tap it; the save happens behind it. */
export function FavoriteButton({ id, favorite, className }: { id: string; favorite: boolean; className?: string }) {
  const [on, setOn] = useOptimistic(favorite);
  const toast = useToast();
  return (
    <form
      className={className}
      action={async () => {
        setOn(!on);
        const fd = new FormData();
        fd.set("id", id);
        fd.set("favorite", String(on));
        try {
          await toggleFavorite(fd);
        } catch {
          toast.show({ message: "Couldn't save that. Try again.", tone: "error" });
        }
      }}
    >
      <IconButton type="submit" label={on ? "Remove from favorites" : "Add to favorites"} pressed={on}>
        <Star aria-hidden className={on ? "size-5 fill-current" : "size-5"} />
      </IconButton>
    </form>
  );
}

/** Thumbs up and down on a recipe. Tap the same one again to clear it. */
export function RatingButtons({ id, rating }: { id: string; rating: number | null }) {
  const [on, setOn] = useOptimistic<number | null>(rating);
  const toast = useToast();

  const rate = (value: 1 | -1) => async () => {
    const next = on === value ? 0 : value;
    setOn(next === 0 ? null : next);
    const fd = new FormData();
    fd.set("id", id);
    fd.set("rating", String(next));
    try {
      await rateRecipe(fd);
    } catch {
      toast.show({ message: "Couldn't save that rating. Try again.", tone: "error" });
    }
  };

  return (
    <div className="flex items-center gap-1">
      <form action={rate(1)}>
        <IconButton type="submit" label="Liked it" variant="secondary" pressed={on === 1}>
          <ThumbsUp aria-hidden className="size-5" />
        </IconButton>
      </form>
      <form action={rate(-1)}>
        <IconButton type="submit" label="Not a fan" variant="secondary" pressed={on === -1} pressedTone="danger">
          <ThumbsDown aria-hidden className="size-5" />
        </IconButton>
      </form>
    </div>
  );
}
