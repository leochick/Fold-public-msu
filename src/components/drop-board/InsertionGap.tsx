"use client";

function InsertionGap({
  show,
  onDragEnter,
}: {
  show: boolean;
  /** Kept for API compatibility; hit-target height is always reserved. */
  active?: boolean;
  onDragEnter?: () => void;
}) {
  return (
    <div
      onDragEnter={(event) => {
        if (!onDragEnter) return;
        event.preventDefault();
        onDragEnter();
      }}
      onDragOver={(event) => {
        if (!onDragEnter) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        onDragEnter();
      }}
      // Fixed height so highlighting a gap never shifts cards under the cursor.
      className="h-3 flex items-center"
      aria-hidden={!show}
    >
      <div
        className={`w-full h-1.5 rounded-full border-2 border-dashed border-accent/60 bg-accent/10 transition-opacity duration-150 ${
          show ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}

export default InsertionGap;
