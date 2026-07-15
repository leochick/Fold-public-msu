"use client";

import { useEffect, useRef, useState, useTransition, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import type { RoleBoardPerson, RoleBoardRow } from "../../../drizzle/schema";
import { DEFAULT_ROLE_COLOR } from "@/lib/role-boards";
import {
  resolveRoleBoardExportRows,
  type RoleBoardExportSnapshot,
} from "@/lib/role-boards-export";
import { updateRoleBoardAction } from "../roles-actions";
import type { RoleBoardDetail, RoleBoardPersonOption } from "@/server/roles";
import PersonPicker from "./PersonPicker";
import RolesHeader from "./RolesHeader";

type ViewOption = {
  id: number;
  name: string;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function RolesEditor({
  board,
  viewName,
  viewFrom,
  viewTo,
  otherViews,
  personOptions,
}: {
  board: RoleBoardDetail;
  viewName: string;
  viewFrom: string;
  viewTo: string;
  otherViews: ViewOption[];
  personOptions: RoleBoardPersonOption[];
}) {
  const router = useRouter();
  const [eventAndStudentDataView, setEventAndStudentDataView] = useState(
    board.eventAndStudentDataView != null ? String(board.eventAndStudentDataView) : ""
  );
  const [personColumnCount, setPersonColumnCount] = useState(board.personColumnCount);
  const [rows, setRows] = useState<RoleBoardRow[]>(board.rows);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextAutosaveRef = useRef(true);
  const savedDataViewRef = useRef(eventAndStudentDataView);
  const latestRef = useRef({
    eventAndStudentDataView,
    personColumnCount,
    rows,
  });

  latestRef.current = { eventAndStudentDataView, personColumnCount, rows };

  useEffect(() => {
    skipNextAutosaveRef.current = true;
    const nextDataView =
      board.eventAndStudentDataView != null ? String(board.eventAndStudentDataView) : "";
    setEventAndStudentDataView(nextDataView);
    setPersonColumnCount(board.personColumnCount);
    setRows(board.rows);
    savedDataViewRef.current = nextDataView;
  }, [board.id]);

  useEffect(() => {
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus("saving");
    setSaveError(null);

    saveTimerRef.current = setTimeout(() => {
      const snapshot = latestRef.current;
      const dataViewId = snapshot.eventAndStudentDataView
        ? Number(snapshot.eventAndStudentDataView)
        : null;
      const dataViewChanged = snapshot.eventAndStudentDataView !== savedDataViewRef.current;

      startTransition(async () => {
        try {
          await updateRoleBoardAction(board.id, {
            eventAndStudentDataView:
              dataViewId != null && Number.isFinite(dataViewId) ? dataViewId : null,
            personColumnCount: snapshot.personColumnCount,
            rows: snapshot.rows,
          });
          savedDataViewRef.current = snapshot.eventAndStudentDataView;
          setSaveStatus("saved");
          if (dataViewChanged) {
            router.refresh();
          }
        } catch (error) {
          setSaveStatus("error");
          setSaveError(error instanceof Error ? error.message : "Could not save");
        }
      });
    }, 450);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [board.id, eventAndStudentDataView, personColumnCount, rows, router]);

  function updateRowName(index: number, name: string) {
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, name } : row))
    );
  }

  function updateRowDescription(index: number, description: string) {
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, description } : row))
    );
  }

  function updateRowColor(index: number, color: string) {
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, color } : row))
    );
  }

  function updatePerson(rowIndex: number, columnIndex: number, person: RoleBoardPerson | null) {
    setRows((current) =>
      current.map((row, index) => {
        if (index !== rowIndex) return row;
        const people = [...row.people];
        people[columnIndex] = person;
        return { ...row, people };
      })
    );
  }

  function addPersonColumn() {
    setPersonColumnCount((count) => count + 1);
    setRows((current) =>
      current.map((row) => ({
        ...row,
        people: [...row.people, null],
      }))
    );
  }

  function addRoleRow() {
    setRows((current) => [
      ...current,
      {
        name: "",
        description: "",
        color: DEFAULT_ROLE_COLOR,
        people: Array.from({ length: personColumnCount }, () => null),
      },
    ]);
  }

  function removeRoleRow(index: number) {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  function reorderRows(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    setRows((current) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= current.length ||
        toIndex >= current.length
      ) {
        return current;
      }
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function handleHandleDragStart(event: DragEvent<HTMLSpanElement>, index: number) {
    setDragFromIndex(index);
    setDragOverIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  }

  function handleRowDragOver(event: DragEvent<HTMLTableRowElement>, index: number) {
    if (dragFromIndex == null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) setDragOverIndex(index);
  }

  function handleRowDrop(event: DragEvent<HTMLTableRowElement>, toIndex: number) {
    event.preventDefault();
    const raw = event.dataTransfer.getData("text/plain");
    const fromIndex = Number(raw);
    if (Number.isFinite(fromIndex)) {
      reorderRows(fromIndex, toIndex);
    }
    setDragFromIndex(null);
    setDragOverIndex(null);
  }

  function handleRowDragEnd() {
    setDragFromIndex(null);
    setDragOverIndex(null);
  }

  const statusLabel =
    saveStatus === "saving" || isPending
      ? "Saving…"
      : saveStatus === "saved"
        ? "Saved"
        : saveStatus === "error"
          ? "Save failed"
          : null;

  const emptyColSpan = personColumnCount + 4;

  const exportSnapshot: RoleBoardExportSnapshot = {
    viewName,
    viewFrom,
    viewTo,
    personColumnCount,
    rows: resolveRoleBoardExportRows(rows, personColumnCount, personOptions),
  };

  return (
    <div className="space-y-6">
      <RolesHeader snapshot={exportSnapshot} />

      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <label htmlFor="roles-event-student-data-view" className="label block mb-1">
              Event and student data from:
            </label>
            <select
              id="roles-event-student-data-view"
              className="input"
              value={eventAndStudentDataView}
              onChange={(event) => setEventAndStudentDataView(event.target.value)}
              disabled={otherViews.length === 0}
            >
              <option value="">{viewName} (current view)</option>
              {otherViews.map((view) => (
                <option key={view.id} value={view.id}>
                  {view.name}
                </option>
              ))}
            </select>
          </div>
          {statusLabel && (
            <p
              className={`text-xs shrink-0 pb-2 ${
                saveStatus === "error"
                  ? "text-red-600 dark:text-red-400"
                  : "text-black/50 dark:text-white/50"
              }`}
            >
              {statusLabel}
            </p>
          )}
        </div>
        {saveError && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-2">{saveError}</p>
        )}
        <p className="text-xs text-black/60 dark:text-white/60 mt-2">
          Role assignments for {viewName}. Changes save automatically. Drag rows to reorder.
        </p>
      </div>

      <div className="card overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th className="w-10" aria-label="Reorder" />
              <th className="min-w-[14rem]">Role</th>
              <th className="min-w-[14rem]">Description</th>
              {Array.from({ length: personColumnCount }, (_, index) => (
                <th key={index} className="min-w-[12rem]">
                  Person {index + 1}
                </th>
              ))}
              <th className="w-12">
                <button
                  type="button"
                  className="btn-ghost px-2 py-1 text-lg leading-none"
                  aria-label="Add person column"
                  title="Add person column"
                  onClick={addPersonColumn}
                >
                  +
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={emptyColSpan}
                  className="text-sm text-black/50 dark:text-white/50"
                >
                  No roles yet. Add a role below.
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => {
                const isDragging = dragFromIndex === rowIndex;
                const isDropTarget =
                  dragOverIndex === rowIndex && dragFromIndex != null && dragFromIndex !== rowIndex;

                return (
                  <tr
                    key={rowIndex}
                    onDragOver={(event) => handleRowDragOver(event, rowIndex)}
                    onDrop={(event) => handleRowDrop(event, rowIndex)}
                    className={[
                      isDragging ? "opacity-40" : "",
                      isDropTarget ? "outline outline-2 outline-accent outline-offset-[-2px]" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <td className="align-middle">
                      <span
                        draggable
                        onDragStart={(event) => handleHandleDragStart(event, rowIndex)}
                        onDragEnd={handleRowDragEnd}
                        className="inline-flex cursor-grab active:cursor-grabbing select-none px-1 text-black/40 dark:text-white/40"
                        title="Drag to reorder"
                        aria-label={`Drag to reorder ${row.name || `role ${rowIndex + 1}`}`}
                      >
                        ⋮⋮
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          className="h-9 w-10 shrink-0 cursor-pointer rounded border border-black/10 bg-transparent p-0.5 dark:border-white/15"
                          value={row.color || DEFAULT_ROLE_COLOR}
                          aria-label={`Color for ${row.name || `role ${rowIndex + 1}`}`}
                          title="Role color"
                          onChange={(event) => updateRowColor(rowIndex, event.target.value)}
                        />
                        <input
                          type="text"
                          className="input min-w-0 flex-1"
                          placeholder="Role name"
                          value={row.name}
                          onChange={(event) => updateRowName(rowIndex, event.target.value)}
                        />
                      </div>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="input"
                        placeholder="Description"
                        value={row.description}
                        onChange={(event) => updateRowDescription(rowIndex, event.target.value)}
                      />
                    </td>
                    {Array.from({ length: personColumnCount }, (_, columnIndex) => (
                      <td key={columnIndex}>
                        <PersonPicker
                          value={row.people[columnIndex] ?? null}
                          options={personOptions}
                          onChange={(person) => updatePerson(rowIndex, columnIndex, person)}
                        />
                      </td>
                    ))}
                    <td>
                      <button
                        type="button"
                        className="btn-ghost px-2 py-1 text-xs"
                        aria-label={`Remove role ${row.name || rowIndex + 1}`}
                        onClick={() => removeRoleRow(rowIndex)}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div className="mt-4">
          <button type="button" className="btn btn-ghost" onClick={addRoleRow}>
            + Add role
          </button>
        </div>
      </div>
    </div>
  );
}
