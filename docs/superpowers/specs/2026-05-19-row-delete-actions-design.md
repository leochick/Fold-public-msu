# Row-level delete via "⋯" actions dropdown

**Date:** 2026-05-19
**Status:** Approved, ready for implementation plan

## Goal

Let users take action on a specific row in the events table and the students tables — starting with deleting an entire event or student — via a small "⋯" actions dropdown at the end of each row. Deletion requires confirmation because it cascades.

## Scope

- Events table (`/events`)
- Students tables, all three tabs: **All**, **Gone cold**, **Funnel** (`/students`)

Out of scope (deliberately): bulk select, undo, edit/duplicate menu items, custom styled modal.

## Existing patterns this builds on

- **Delete server action**: `src/app/vehicles/actions.ts` → `deleteVehicleAction` (`requireUser` → validate id → `db.delete` → `revalidatePath` → `redirect`).
- **Tech stack**: Next.js 15 App Router, React 19, Tailwind, Drizzle ORM over libSQL/Turso. No component or icon libraries — Unicode symbols and server actions only.
- **Button classes** (globals.css): `.btn-ghost`, `.btn-danger`, `.btn`.
- **Cascade rules** (drizzle/schema.ts): deleting an event/student cascades to `attendances`, ride-session members, and contact attempts (`onDelete: "cascade"`); inviter/driver references are `onDelete: "set null"`. The DB handles all of this, so the action only deletes the single row.

## Components

### 1. Server actions (2 new files)

`src/app/events/actions.ts`:

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

`src/app/students/actions.ts`: identical shape with `deleteStudentAction`, deleting from `students`, revalidating `/students`.

**Difference from vehicles pattern:** no `redirect()`. `revalidatePath` alone re-renders the current route in place, preserving the students tab / pagination / search query in the URL (`?tab=funnel`, `?page=2`, `?q=...`).

### 2. Shared client component

`src/app/_components/RowActions.tsx` (`"use client"`).

Props:

```ts
{
  id: number;
  deleteAction: (formData: FormData) => Promise<void>; // server action passed from RSC
  confirmMessage: string;
}
```

Behavior:
- Renders a `⋯` (U+22EF) `btn-ghost` button at the end of the row.
- Clicking toggles a small menu containing one item: **Delete** (red text). Structured so future items (Edit, Duplicate) can be added, but ships Delete-only.
- Delete item is a `<form action={deleteAction}>` with a hidden `<input name="id">`. An `onSubmit` handler calls `confirm(confirmMessage)`; if the user cancels, `e.preventDefault()` aborts.
- **Overflow handling:** the tables live inside `.overflow-x-auto`, which clips an absolutely-positioned menu. The menu therefore uses **fixed positioning**, measured from the button's `getBoundingClientRect()` when opened.
- Menu closes on: outside click, `Escape` key, window scroll, and window resize (listeners attached only while open, cleaned up on close/unmount).

### 3. Table wiring

Add a trailing actions column to each table.

| Table | Header change | Cell added | Confirm message | Empty-state colSpan |
|-------|---------------|------------|-----------------|---------------------|
| Events | `+ <th></th>` | `<RowActions id={e.id} deleteAction={deleteEventAction} confirmMessage={...}/>` | `Delete "{name}" and its {count} attendance record(s)? This can't be undone.` (count already computed per row) | 5 → 6 |
| Students — All | `+ <th></th>` | `deleteStudentAction` | `Delete {firstName} {lastName}? This also removes their attendance and contact history. This can't be undone.` | 6 → 7 |
| Students — Gone cold | `+ <th></th>` | `deleteStudentAction` | same as All | n/a (no empty-state row) |
| Students — Funnel | reuse existing trailing cell | add `⋯` menu beside the existing "open" link | same as All | already 7 |

## Data flow

1. RSC page renders rows and passes the server action + per-row `id`/`confirmMessage` to `<RowActions>`.
2. User clicks `⋯` → fixed-positioned menu opens.
3. User clicks **Delete** → native `confirm()`; on OK the form posts to the server action.
4. Action validates auth, deletes the row (DB cascades dependents), `revalidatePath` re-renders the current route in place.

## Error handling

- Non-numeric/missing `id` → action returns without deleting (no-op).
- Unauthorized → `requireUser()` throws/redirects per existing auth behavior.
- `confirm()` cancel → submit aborted client-side, no request sent.

## Testing

- Manual: delete an event with attendances → row gone, attendances cascade, attendee counts elsewhere update; cancel confirm → nothing happens.
- Manual: delete a student from each tab → stays on the same tab/page/query after deletion.
- Verify the menu is not clipped by the table's horizontal scroll container, and closes on outside click / Escape / scroll.
- Existing test setup: Vitest (`vitest.config.ts`). Add a unit test for the delete actions if a DB test harness exists; otherwise rely on manual verification (note in plan).
