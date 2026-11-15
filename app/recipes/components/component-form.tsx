import { saveComponent } from "./actions";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";

export type ComponentFormValues = { id?: string; name: string; buy_as: string; buy_unit: string; ingredients: string };

export function ComponentForm({ values, error }: { values: ComponentFormValues; error?: string }) {
  return (
    <form action={saveComponent} className="space-y-4">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      {error && <Notice tone="error">{error}</Notice>}
      <Field label="Name" hint="This is what you type after the @ in a recipe.">
        <Input name="name" required maxLength={80} defaultValue={values.name} placeholder="Pico de gallo" autoComplete="off" />
      </Field>
      <Field
        label="Ingredients for one batch"
        hint="One per line, like a recipe. If a recipe makes it from scratch, these go on the shopping list."
      >
        <Textarea
          name="ingredients"
          rows={7}
          required
          defaultValue={values.ingredients}
          placeholder={"4 tomatoes\n1/2 white onion\n1 bunch cilantro\n2 tbsp lime juice"}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Or buy it as" hint="What to look for at the store.">
          <Input name="buy_as" maxLength={80} defaultValue={values.buy_as} placeholder="pico de gallo" />
        </Field>
        <Field label="Sold as a" hint="jar, tub, bag...">
          <Input name="buy_unit" maxLength={20} defaultValue={values.buy_unit} placeholder="jar" />
        </Field>
      </div>
      <SubmitButton variant="primary" className="w-full">
        Save
      </SubmitButton>
    </form>
  );
}
