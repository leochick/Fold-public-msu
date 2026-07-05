import { listChangelog } from "@/server/changelog";
import ChangelogTable from "./ChangelogTable";

export const dynamic = "force-dynamic";

export default async function ChangelogPage() {
  const { entries, hasMore, nextOffset } = await listChangelog(0, 20);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Changelog</h1>
        <p className="text-sm text-black/60 mt-1">
          A running history of student and event edits, newest first.
        </p>
      </div>
      <ChangelogTable
        initialEntries={entries}
        initialHasMore={hasMore}
        initialNextOffset={nextOffset}
      />
    </div>
  );
}
