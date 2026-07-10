import Link from "next/link";
import { db } from "@/lib/db";
import { students } from "../../../drizzle/schema";
import QuickAddStudents from "./QuickAddStudents";
import StudentsAllList from "./StudentsAllList";

export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  const allRows = await db.select().from(students).orderBy(students.firstName);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Students</h1>
        <Link href="/students/new" className="btn-primary">+ New student</Link>
      </div>

      <QuickAddStudents />

      <StudentsAllList students={allRows} />
    </div>
  );
}
