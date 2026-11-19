-- What to do with an ingredient ("diced") and how big the package is ("15 oz"), shown on the recipe and in cook mode.
-- They are only for reading, so the shopping list and Kroger matching still use the plain name.
alter table public.recipe_ingredients add column note text;
alter table public.recipe_ingredients add column size text;
