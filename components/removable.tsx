"use client";

import { createContext, useContext, useState, type ElementType, type ReactNode } from "react";
import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { useToast } from "@/components/ui/toast";

const RemoveContext = createContext<(() => void) | null>(null);

/**
 * A row that can be removed with undo. Tapping the remove button hides the row at once and shows
 * "Removed. Undo" for a few seconds. The real delete (the server action) only runs if Undo isn't tapped.
 */
export function Removable({
  as: Tag = "li",
  id,
  label,
  action,
  className,
  children,
}: {
  as?: ElementType;
  id: string;
  /** What to call it in the toast, e.g. "Taco Night". */
  label: string;
  /** A server action that takes FormData with an `id` field. */
  action: (formData: FormData) => Promise<void>;
  className?: string;
  children: ReactNode;
}) {
  const toast = useToast();
  const [removed, setRemoved] = useState(false);

  function remove() {
    setRemoved(true);
    toast.undoable({
      message: `Removed ${label}`,
      onUndo: () => setRemoved(false),
      onCommit: async () => {
        const fd = new FormData();
        fd.set("id", id);
        try {
          await action(fd);
        } catch {
          // The delete didn't go through, so bring the row back instead of pretending it worked.
          setRemoved(false);
          toast.show({ message: `Couldn't remove ${label}. Try again.`, tone: "error" });
        }
      },
    });
  }

  if (removed) return null;
  return (
    <RemoveContext.Provider value={remove}>
      <Tag className={className}>{children}</Tag>
    </RemoveContext.Provider>
  );
}

/** The ✕ inside a <Removable>. */
export function RemoveTrigger({ label }: { label: string }) {
  const remove = useContext(RemoveContext);
  return (
    <IconButton label={label} variant="danger" onClick={() => remove?.()}>
      <X aria-hidden className="size-5" />
    </IconButton>
  );
}

/** "Remove" as a row inside a ⋯ menu. Same undo behavior as the ✕. */
export function RemoveMenuItem({ label = "Remove" }: { label?: string }) {
  const remove = useContext(RemoveContext);
  return (
    <Button variant="danger" className="w-full" data-menu-close onClick={() => remove?.()}>
      <Trash2 aria-hidden className="size-4" /> {label}
    </Button>
  );
}
