import { RecipeTile } from "./recipe-tile";
import { cn } from "@/lib/cn";

/** A small recipe picture for a row: the photo if there is one, otherwise the colored tile for its main meat. */
export function RecipeThumb({
  image,
  protein,
  size = "sm",
}: {
  image: string | null;
  protein: string;
  size?: "sm" | "md";
}) {
  if (!image) return <RecipeTile compact size={size} protein={protein} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      className={cn("shrink-0 rounded-md object-cover", size === "md" ? "size-14" : "size-10")}
    />
  );
}
