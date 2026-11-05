import { SubmitButton } from "./submit-button";

/**
 * A two-or-three-way switch inside a server-action form. Each option submits its value under `name`.
 * The chosen one is filled in. Needs to be inside a <form action={...}>.
 */
export function Segmented({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex w-full gap-1 rounded-md bg-surface-muted p-1 sm:w-auto">
      {options.map((o) => (
        <SubmitButton
          key={o.value}
          name={name}
          value={o.value}
          aria-pressed={o.value === value}
          variant={o.value === value ? "primary" : "ghost"}
          className="min-h-10 flex-1 sm:flex-none sm:px-6"
        >
          {o.label}
        </SubmitButton>
      ))}
    </div>
  );
}
