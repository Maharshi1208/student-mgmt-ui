import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/* ---------- Storage keys (match your existing pages) ---------- */
const STUDENTS_KEY = "sms.students.v1";
const COURSES_KEY = "sms.courses.v1";
const ENROLLMENTS_KEY = "sms.enrollments.v1";

/* ---------- Types ---------- */
type Student = {
  name: string;
  email: string;
  course: string; // not used as source of truth here
  status: "Active" | "Inactive";
};

type Course = {
  code: string;
  title: string;
  credits: number;
  status: "Active" | "Inactive";
};

type Enrollment = {
  studentEmail: string;
  courseCode: string;
  createdAt: string;
};

/* ---------- Safe loaders ---------- */
function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/* ============================================================= */

export default function Enrollments() {
  // Source data
  const [students, setStudents] = useState<Student[]>(() =>
    loadJSON<Student[]>(STUDENTS_KEY, [])
  );
  const [courses, setCourses] = useState<Course[]>(() =>
    loadJSON<Course[]>(COURSES_KEY, [])
  );

  // Enrollments data
  const [enrollments, setEnrollments] = useState<Enrollment[]>(() =>
    loadJSON<Enrollment[]>(ENROLLMENTS_KEY, [])
  );

  // Keep enrollments persisted
  useEffect(() => {
    localStorage.setItem(ENROLLMENTS_KEY, JSON.stringify(enrollments));
  }, [enrollments]);

  // If Students/Courses change in other pages + refresh here:
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STUDENTS_KEY) {
        setStudents(loadJSON(STUDENTS_KEY, []));
      } else if (e.key === COURSES_KEY) {
        setCourses(loadJSON(COURSES_KEY, []));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Dialog state
  const [open, setOpen] = useState(false);
  const [selectedStudentEmail, setSelectedStudentEmail] = useState("");
  const [selectedCourseCode, setSelectedCourseCode] = useState("");

  // Toolbar (search & pagination)
  const [query, setQuery] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(5);

  // Lookups
  const studentsByEmail = useMemo(() => {
    const m = new Map<string, Student>();
    for (const s of students) m.set(s.email, s);
    return m;
  }, [students]);

  const coursesByCode = useMemo(() => {
    const m = new Map<string, Course>();
    for (const c of courses) m.set(c.code, c);
    return m;
  }, [courses]);

  // Selected objects + guards
  const selectedStudent = selectedStudentEmail ? studentsByEmail.get(selectedStudentEmail) : undefined;
  const selectedCourse = selectedCourseCode ? coursesByCode.get(selectedCourseCode) : undefined;
  const studentIsInactive = selectedStudent && selectedStudent.status === "Inactive";
  const courseIsInactive = selectedCourse && selectedCourse.status === "Inactive";
  const canEnroll =
    !!selectedStudentEmail &&
    !!selectedCourseCode &&
    !studentIsInactive &&
    !courseIsInactive;

  // Filter for search (name/email/course code/title)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return enrollments;
    return enrollments.filter((en) => {
      const s = studentsByEmail.get(en.studentEmail);
      const c = coursesByCode.get(en.courseCode);
      const studentText = s ? `${s.name} ${s.email}`.toLowerCase() : en.studentEmail.toLowerCase();
      const courseText = c ? `${c.code} ${c.title}`.toLowerCase() : en.courseCode.toLowerCase();
      return `${studentText} ${courseText}`.includes(q);
    });
  }, [query, enrollments, studentsByEmail, coursesByCode]);

  // Pagination
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(pageIndex, pageCount - 1);
  const paged = useMemo(() => {
    const start = page * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  // Enroll handler (enforce Active/Active)
  function onEnroll() {
    if (!selectedStudentEmail || !selectedCourseCode) return;

    const s = studentsByEmail.get(selectedStudentEmail);
    const c = coursesByCode.get(selectedCourseCode);

    if (!s || !c) return;

    if (s.status !== "Active") {
      alert("Cannot enroll an INACTIVE student. Please activate the student first.");
      return;
    }
    if (c.status !== "Active") {
      alert("Cannot enroll into an INACTIVE course. Please activate the course first.");
      return;
    }

    // prevent duplicates
    const exists = enrollments.some(
      (e) => e.studentEmail === selectedStudentEmail && e.courseCode === selectedCourseCode
    );
    if (exists) {
      alert("This student is already enrolled in that course.");
      return;
    }

    const next: Enrollment = {
      studentEmail: selectedStudentEmail,
      courseCode: selectedCourseCode,
      createdAt: new Date().toISOString(),
    };
    const updated = [...enrollments, next];
    setEnrollments(updated);

    // Jump to the last page to show new enrollment
    const total = Math.max(1, Math.ceil(updated.length / pageSize));
    setPageIndex(total - 1);

    // reset form
    setSelectedStudentEmail("");
    setSelectedCourseCode("");
    setOpen(false);
  }

  function onDelete(en: Enrollment) {
    if (!confirm("Remove this enrollment?")) return;
    setEnrollments((prev) =>
      prev.filter(
        (e) => !(e.studentEmail === en.studentEmail && e.courseCode === en.courseCode)
      )
    );
  }

  function resetAll() {
    if (!confirm("Clear all enrollments?")) return;
    setEnrollments([]);
    setPageIndex(0);
  }

  // Helper to render a status badge
  const StatusBadge = ({ active }: { active: boolean }) => (
    <span
      className={
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs " +
        (active
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300")
      }
    >
      {active ? "Active" : "Inactive"}
    </span>
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPageIndex(0);
          }}
          placeholder="Search by student or course…"
          className="max-w-md"
        />

        <div className="flex gap-2">
          <Button variant="outline" onClick={resetAll}>Clear enrollments</Button>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Enroll student</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Enroll Student</DialogTitle>
              </DialogHeader>

              {/* Student select */}
              <div className="space-y-2 mt-2">
                <Label htmlFor="student">Student</Label>
                <select
                  id="student"
                  value={selectedStudentEmail}
                  onChange={(e) => setSelectedStudentEmail(e.target.value)}
                  className="w-full border rounded-md p-2 bg-background"
                >
                  <option value="">Select a student…</option>
                  {students.map((s) => (
                    <option
                      key={s.email}
                      value={s.email}
                      disabled={s.status === "Inactive"} // guard: disable inactive
                    >
                      {s.name} — {s.email} {s.status === "Inactive" ? "(inactive)" : ""}
                    </option>
                  ))}
                </select>
                {studentIsInactive && (
                  <p className="text-amber-600 dark:text-amber-400 text-xs">
                    This student is inactive. Activate them before enrolling.
                  </p>
                )}
              </div>

              {/* Course select */}
              <div className="space-y-2">
                <Label htmlFor="course">Course</Label>
                <select
                  id="course"
                  value={selectedCourseCode}
                  onChange={(e) => setSelectedCourseCode(e.target.value)}
                  className="w-full border rounded-md p-2 bg-background"
                >
                  <option value="">Select a course…</option>
                  {courses.map((c) => (
                    <option
                      key={c.code}
                      value={c.code}
                      disabled={c.status === "Inactive"} // guard: disable inactive
                    >
                      {c.code} — {c.title} {c.status === "Inactive" ? "(inactive)" : ""}
                    </option>
                  ))}
                </select>
                {courseIsInactive && (
                  <p className="text-amber-600 dark:text-amber-400 text-xs">
                    This course is inactive. Activate it before enrolling.
                  </p>
                )}
              </div>

              <Button
                className="w-full mt-4"
                onClick={onEnroll}
                disabled={!canEnroll} // guard: disable button if invalid/inactive
              >
                Enroll
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <Th label="Student" />
              <Th label="Email" />
              <Th label="Course" />
              <Th label="Title" />
              <Th label="Statuses" />
              <Th label="Actions" />
            </tr>
          </thead>
          <tbody>
            {paged.map((en, i) => {
              const s = studentsByEmail.get(en.studentEmail);
              const c = coursesByCode.get(en.courseCode);
              return (
                <tr key={`${en.studentEmail}-${en.courseCode}-${i}`} className="border-t">
                  <td className="px-4 py-2 font-medium">{s?.name ?? en.studentEmail}</td>
                  <td className="px-4 py-2">{en.studentEmail}</td>
                  <td className="px-4 py-2">{en.courseCode}</td>
                  <td className="px-4 py-2">{c?.title ?? "-"}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge active={(s?.status ?? "Active") === "Active"} />
                      <StatusBadge active={(c?.status ?? "Active") === "Active"} />
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <Button variant="destructive" onClick={() => onDelete(en)}>
                      Remove
                    </Button>
                  </td>
                </tr>
              );
            })}

            {paged.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No enrollments yet. Click “Enroll student”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          Page <span className="font-medium">{page + 1}</span> of{" "}
          <span className="font-medium">{pageCount}</span> — {filtered.length} total
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm">
            Rows per page:&nbsp;
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPageIndex(0);
              }}
              className="border rounded-md p-1 bg-background"
            >
              {[5, 10, 20].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setPageIndex(0)} disabled={page === 0}>
              {"<<"}
            </Button>
            <Button variant="outline" onClick={() => setPageIndex((p) => Math.max(0, p - 1))} disabled={page === 0}>
              {"<"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1}
            >
              {">"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setPageIndex(pageCount - 1)}
              disabled={page >= pageCount - 1}
            >
              {">>"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Tiny helpers ---------- */
function Th({ label }: { label: string }) {
  return <th className="px-4 py-2 text-left font-semibold">{label}</th>;
}
