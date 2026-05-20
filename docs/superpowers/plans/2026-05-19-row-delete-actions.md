# Row-level Delete Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "⋯" actions dropdown to each row of the events table and all three students tables, with a confirm-gated Delete that removes the whole event/student.

**Architecture:** Two server actions (`deleteEventAction`, `deleteStudentAction`) following the existing `vehicles/actions.ts` pattern but without `redirect()` (so the current tab/page/query is preserved via `revalidatePath`). One shared client component `RowActions.tsx` renders the dropdown using fixed positioning to escape the tables' `overflow-x-auto` clipping, gated by a native `confirm()`. DB foreign-key cascades handle dependent-row cleanup.

**Tech Stack:** Next.js 15 (App Router), React 19, Tailwind, Drizzle ORM over libSQL/Turso. No component/icon libraries. Verification via `npm run typecheck`, `npm run build`, and manual testing (no DB test harness exists; tests in `src/lib/__tests__` are pure-logic only).

---

## File Structure

- Create: `src/app/events/actions.ts` — `deleteEventAction` server action.
- Create: `src/app/students/actions.ts` — `deleteStudentAction` server action.
- Create: `src/app/RowActions.tsx` — shared client dropdown component (placed at app root to match the existing shared `src/app/HeaderNav.tsx` convention; there is no `_components` dir).
- Modify: `src/app/events/page.tsx` — add actions column to the events table.
- Modify: `src/app/students/page.tsx` — add actions column to All, Gone cold, and Funnel tables.

---

### Task 1: `deleteEventAction` server action

**Files:**
- Create: `src/app/events/actions.ts`

- [ ] **Step 1: Write the action file**

```ts
"use server";

import { db } from "@/lib/db";
import { events } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";

export async function deleteEventAction(formData: FormData) {
  await requireUser();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;
  await db.delete(events).where(eq(events.id, id));
  revalidatePath("/events");
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors). The relative import `../../../drizzle/schema` matches the import already used in `src/app/events/page.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/app/events/actions.ts
git commit -m "feat: add deleteEventAction server action"
```

---

### Task 2: `deleteStudentAction` server action

**Files:**
- Create: `src/app/students/actions.ts`

- [ ] **Step 1: Write the action file**

```ts
"use server";

import { db } from "@/lib/db";
import { students } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";

export async function deleteStudentAction(formData: FormData) {
  await requireUser();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;
  await db.delete(students).where(eq(students.id, id));
  revalidatePath("/students");
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/students/actions.ts
git commit -m "feat: add deleteStudentAction server action"
```

---

### Task 3: `RowActions` shared client component

**Files:**
- Create: `src/app/RowActions.tsx`

This component renders a `⋯` button and a fixed-positioned menu with a single confirm-gated **Delete** item. Fixed positioning is required because the tables live inside `.overflow-x-auto`, which clips absolutely-positioned children. The menu closes on outside-click, Escape, scroll, and resize.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  id: number;
  deleteAction: (formData: FormData) => Promise<void>;
  confirmMessage: string;
};

export default function RowActions({ id, deleteAction, confirmMessage }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function close() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label="Row actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="btn-ghost px-2 py-1 leading-none"
      >
        ⋯
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 50 }}
          className="card min-w-32 p-1 shadow-lg"
        >
          <form
            action={deleteAction}
            onSubmit={(e) => {
              if (!confirm(confirmMessage)) {
                e.preventDefault();
              } else {
                setOpen(false);
              }
            }}
          >
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              role="menuitem"
              className="block w-full rounded px-3 py-1.5 text-left text-sm text-red-600 hover:bg-black/5 dark:hover:bg-white/5"
            >
              Delete
            </button>
          </form>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS. (The `.card`, `.btn-ghost` classes already exist in globals.css; `min-w-32` and `shadow-lg` are stock Tailwind.)

- [ ] **Step 3: Commit**

```bash
git add src/app/RowActions.tsx
git commit -m "feat: add RowActions dropdown component"
```

---

### Task 4: Wire RowActions into the events table

**Files:**
- Modify: `src/app/events/page.tsx`

- [ ] **Step 1: Add the import**

At the top of `src/app/events/page.tsx`, after the existing `import QuickAdd from "./QuickAdd";` line, add:

```tsx
import RowActions from "../RowActions";
import { deleteEventAction } from "./actions";
```

- [ ] **Step 2: Add the trailing header cell**

In the events `<thead>` (currently ends `<th>Attendees</th>`), add a trailing empty header. Replace:

```tsx
              <th>Attendees</th>
            </tr>
```

with:

```tsx
              <th>Attendees</th>
              <th></th>
            </tr>
```

- [ ] **Step 3: Add the actions cell to each row**

In the `rows.map(...)` body, the row currently ends:

```tsx
                <td>{Number(count)}</td>
              </tr>
```

Replace with:

```tsx
                <td>{Number(count)}</td>
                <td className="text-right">
                  <RowActions
                    id={e.id}
                    deleteAction={deleteEventAction}
                    confirmMessage={`Delete "${e.name}" and its ${Number(count)} attendance record(s)? This can't be undone.`}
                  />
                </td>
              </tr>
```

- [ ] **Step 4: Widen the empty-state colSpan**

Replace:

```tsx
              <tr><td colSpan={5} className="text-center text-black/50 py-8">No events yet. Create one above.</td></tr>
```

with:

```tsx
              <tr><td colSpan={6} className="text-center text-black/50 py-8">No events yet. Create one above.</td></tr>
```

- [ ] **Step 5: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/events/page.tsx
git commit -m "feat: add delete actions dropdown to events table"
```

---

### Task 5: Wire RowActions into the students tables (All, Gone cold, Funnel)

**Files:**
- Modify: `src/app/students/page.tsx`

- [ ] **Step 1: Add the imports**

At the top of `src/app/students/page.tsx`, after `import FunnelSweepButton from "../funnel/FunnelSweepButton";`, add:

```tsx
import RowActions from "../RowActions";
import { deleteStudentAction } from "./actions";
```

- [ ] **Step 2: All tab — add trailing header cell**

In the All-tab `<thead>`, replace:

```tsx
                  <th>Contact</th>
                </tr>
```

with:

```tsx
                  <th>Contact</th>
                  <th></th>
                </tr>
```

- [ ] **Step 3: All tab — add the actions cell**

The All-tab row currently ends:

```tsx
                    <td className="text-sm">{s.primaryContact ?? <span className="text-black/30">—</span>}</td>
                  </tr>
```

Replace with:

```tsx
                    <td className="text-sm">{s.primaryContact ?? <span className="text-black/30">—</span>}</td>
                    <td className="text-right">
                      <RowActions
                        id={s.id}
                        deleteAction={deleteStudentAction}
                        confirmMessage={`Delete ${s.firstName} ${s.lastName ?? ""}? This also removes their attendance and contact history. This can't be undone.`}
                      />
                    </td>
                  </tr>
```

- [ ] **Step 4: All tab — widen empty-state colSpan**

Replace:

```tsx
                  <tr><td colSpan={6} className="text-center text-black/50 py-8">No students yet. Try <Link className="underline" href="/import">/import</Link>.</td></tr>
```

with:

```tsx
                  <tr><td colSpan={7} className="text-center text-black/50 py-8">No students yet. Try <Link className="underline" href="/import">/import</Link>.</td></tr>
```

- [ ] **Step 5: Gone cold tab — add trailing header cell**

Replace the cold-tab header row:

```tsx
                <tr><th>Name</th><th>Year</th><th>Status</th><th>Primary contact</th><th>Last seen</th></tr>
```

with:

```tsx
                <tr><th>Name</th><th>Year</th><th>Status</th><th>Primary contact</th><th>Last seen</th><th></th></tr>
```

- [ ] **Step 6: Gone cold tab — add the actions cell**

The cold-tab row currently ends:

```tsx
                    <td className="text-sm text-black/60">{s.lastSeen}</td>
                  </tr>
```

Replace with:

```tsx
                    <td className="text-sm text-black/60">{s.lastSeen}</td>
                    <td className="text-right">
                      <RowActions
                        id={s.id}
                        deleteAction={deleteStudentAction}
                        confirmMessage={`Delete ${s.firstName} ${s.lastName ?? ""}? This also removes their attendance and contact history. This can't be undone.`}
                      />
                    </td>
                  </tr>
```

- [ ] **Step 7: Funnel tab — add RowActions beside the existing "open" link**

The funnel-tab row currently ends:

```tsx
                        <td className="text-right"><Link href={`/students/${s.id}`} className="text-xs underline">open</Link></td>
                      </tr>
```

Replace with:

```tsx
                        <td className="text-right">
                          <span className="inline-flex items-center gap-2">
                            <Link href={`/students/${s.id}`} className="text-xs underline">open</Link>
                            <RowActions
                              id={s.id}
                              deleteAction={deleteStudentAction}
                              confirmMessage={`Delete ${s.firstName} ${s.lastName ?? ""}? This also removes their attendance and contact history. This can't be undone.`}
                            />
                          </span>
                        </td>
                      </tr>
```

(The funnel empty-state row already uses `colSpan={7}`, which still matches — no change needed.)

- [ ] **Step 8: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/app/students/page.tsx
git commit -m "feat: add delete actions dropdown to students tables"
```

---

### Task 6: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the existing test suite to confirm no regressions**

Run: `npm run test`
Expected: PASS (pre-existing pure-logic tests unaffected).

- [ ] **Step 2: Start the dev server and verify behavior**

Run: `npm run dev` and check:
- Events table: each row shows a `⋯` button; clicking opens a menu that is NOT clipped by the table's horizontal scroll area; menu closes on outside-click, Escape, and scroll.
- Deleting an event shows the confirm with the attendance count; OK removes the row and its attendances; Cancel does nothing.
- Students All / Gone cold / Funnel tabs each show the `⋯` action and delete correctly.
- After deleting a student from `?tab=funnel` or `?page=2`, the view stays on the same tab/page (no redirect to top).

- [ ] **Step 3: Final confirmation**

No commit needed — verification only. Report results.
