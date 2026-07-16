"use client";

import { useLayoutEffect, useRef, type KeyboardEvent } from "react";

export default function ResponsibilitiesListEditor({
  value,
  onChange,
  "aria-label": ariaLabel = "Responsibilities",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  "aria-label"?: string;
}) {
  const items = value.length === 0 ? [""] : value;
  const focusIndexRef = useRef<number | null>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useLayoutEffect(() => {
    const index = focusIndexRef.current;
    if (index == null) return;
    const el = inputRefs.current[index];
    if (el) {
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
    focusIndexRef.current = null;
  });

  function commit(next: string[]) {
    onChange(next);
  }

  function updateItem(index: number, text: string) {
    const next = [...items];
    next[index] = text;
    commit(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key === "Enter") {
      event.preventDefault();
      const next = [...items];
      next.splice(index + 1, 0, "");
      focusIndexRef.current = index + 1;
      commit(next);
      return;
    }

    if (
      event.key === "Backspace" &&
      items[index] === "" &&
      items.length > 1 &&
      (event.currentTarget.selectionStart ?? 0) === 0
    ) {
      event.preventDefault();
      const next = items.filter((_, itemIndex) => itemIndex !== index);
      focusIndexRef.current = Math.max(0, index - 1);
      commit(next);
    }
  }

  return (
    <ul className="m-0 list-none space-y-1 p-0" aria-label={ariaLabel}>
      {items.map((item, index) => (
        <li key={index}>
          <input
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            className="input"
            placeholder={index === 0 ? "Add responsibility…" : ""}
            value={item}
            aria-label={`Responsibility ${index + 1}`}
            onChange={(event) => updateItem(index, event.target.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
          />
        </li>
      ))}
    </ul>
  );
}
