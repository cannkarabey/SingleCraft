"use client";

import { X } from "lucide-react";
import { useId, useState } from "react";

/** Chip list editor: Enter or comma adds a term, × removes it; optional suggestion chips. */
export function TermInput({
  label,
  value,
  onChange,
  suggestions = [],
  placeholder,
  removeLabel,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  removeLabel: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const add = (term: string) => {
    const t = term.trim();
    if (
      t &&
      !value.some((v) => v.toLowerCase() === t.toLowerCase()) &&
      value.length < 20
    ) {
      onChange([...value, t]);
    }
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm">
        {label}
      </label>
      <ul className="flex flex-wrap gap-1.5">
        {value.map((term) => (
          <li
            key={term}
            className="bg-surface-2 flex items-center gap-1 rounded border px-2 py-0.5 text-sm"
          >
            {term}
            <button
              type="button"
              aria-label={`${removeLabel}: ${term}`}
              onClick={() => onChange(value.filter((v) => v !== term))}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </li>
        ))}
      </ul>
      <input
        id={id}
        value={draft}
        maxLength={40}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(draft);
          }
        }}
        onBlur={() => draft && add(draft)}
        className="bg-surface-1 focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
      />
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions
            .filter(
              (s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()),
            )
            .map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => add(s)}
                className="text-muted-foreground hover:text-foreground rounded-full border px-2.5 py-0.5 text-xs"
              >
                + {s}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
