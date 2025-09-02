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
import { exportToCsv } from "@/lib/exportCsv";

/* ---------- Storage keys ---------- */
const STUDENTS_KEY = "sms.students.v1";
const COURSES_KEY = "sms.courses.v1";
const ENROLLMENTS_KEY = "sms.enrollments.v1";

/* ---------- Types ---------- */
type Student = { name: string; email: string; course: string; status: "Active" | "Inactive" };
type Course = { code: string; title: string; credits: number; status: "Active" | "Inactive" };
type Enrollment = { studentEmail: string; courseCode: string; createdAt: string };

/* ---------- Helpers ---------- */
function loadJSON<T>(k: string, fb: T): T {
  try { const r = localStorage.getItem(k); return r ? (JSON.parse(r) as T) : fb; } catch { return fb; }
}
function saveJSON<T>(k: string, v: T) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

/* ======================================================= */

export default function Enrollments() {
  const [students, setStudents] = useState<Student[]>(() => loadJSON(STUDENTS_KEY, []));
  const [courses, setCourses] = useState<Course[]>(() => loadJSON(COURSES_KEY, []));
  const [enrollments, setEnrollments] = useState<Enrollment[]>(() => loadJSON(ENROLLMENTS_KEY, []));

  useEffect(() => saveJSON(ENROLLMENTS_KEY, enrollments), [enrollments]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STUDENTS_KEY) setStudents(loadJSON(STUDENTS_KEY, []));
      if (e.key === COURSES_KEY) setCourses(loadJSON(COURSES_KEY, []));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /* ---------- lookups ---------- */
  const studentsByEmail = useMemo(() => new Map(students.map(s => [s.email, s])), [students]);
  const coursesByCode  = useMemo(() => new Map(courses.map(c => [c.code, c])), [courses]);

  /* ---------- search / paging ---------- */
  const [query, setQuery] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(5);

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

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(pageIndex, pageCount - 1);
  const paged = useMemo(() => filtered.slice(page * pageSize, page * pageSize + pageSize), [filtered, page, pageSize]);

  /* ---------- create dialog ---------- */
  const [open, setOpen] = useState(false);
  const [selectedStudentEmail, setSelectedStudentEmail] = useState("");
  const [selectedCourseCode, setSelectedCourseCode] = useState("");

  const selStudent = selectedStudentEmail ? studentsByEmail.get(selectedStudentEmail) : undefined;
  const selCourse  = selectedCourseCode ?  coursesByCode.get(selectedCourseCode)  : undefined;
  const studentInactive = selStudent?.status === "Inactive";
  const courseInactive  = selCourse?.status === "Inactive";
  const canEnroll = !!selectedStudentEmail && !!selectedCourseCode && !studentInactive && !courseInactive;

  function onEnroll() {
    const s = selStudent, c = selCourse;
    if (!s || !c) return;
    if (s.status !== "Active") return alert("Cannot enroll an INACTIVE student.");
    if (c.status !== "Active") return alert("Cannot enroll into an INACTIVE course.");
    if (enrollments.some(e => e.studentEmail === s.email && e.courseCode === c.code)) {
      return alert("This student is already enrolled in that course.");
    }
    const next = [...enrollments, { studentEmail: s.email, courseCode: c.code, createdAt: new Date().toISOString() }];
    setEnrollments(next);
    setPageIndex(Math.max(1, Math.ceil(next.length / pageSize)) - 1);
    setSelectedStudentEmail(""); setSelectedCourseCode(""); setOpen(false);
  }

  /* ---------- edit dialog ---------- */
  const [openEdit, setOpenEdit] = useState(false);
  const [editing, setEditing] = useState<Enrollment | null>(null);
  const [editStudentEmail, setEditStudentEmail] = useState("");
  const [editCourseCode, setEditCourseCode] = useState("");

  const editStudent = editStudentEmail ? studentsByEmail.get(editStudentEmail) : undefined;
  const editCourse  = editCourseCode ?  coursesByCode.get(editCourseCode)  : undefined;
  const editStudentInactive = editStudent?.status === "Inactive";
  const editCourseInactive  = editCourse?.status === "Inactive";
  const canSaveEdit = !!editStudentEmail && !!editCourseCode && !editStudentInactive && !editCourseInactive;

  function openEditFor(en: Enrollment) {
    setEditing(en);
    setEditStudentEmail(en.studentEmail);
    setEditCourseCode(en.courseCode);
    setOpenEdit(true);
  }

  function onSaveEdit() {
    if (!editing) return;
    const s = editStudent, c = editCourse;
    if (!s || !c) return;
    if (s.status !== "Active") return alert("Cannot set enrollment to an INACTIVE student.");
    if (c.status !== "Active") return alert("Cannot set enrollment into an INACTIVE course.");

    const duplicate = enrollments.some(
      (e) => e !== editing && e.studentEmail === editStudentEmail && e.courseCode === editCourseCode
    );
    if (duplicate) return alert("Another identical enrollment already exists.");

    const updated = enrollments.map((e) =>
      e === editing ? { ...e, studentEmail: editStudentEmail, courseCode: editCourseCode } : e
    );
    setEnrollments(updated);
    setOpenEdit(false);
    setEditing(null);
  }

  /* ---------- delete / reset ---------- */
  function onDelete(en: Enrollment) {
    if (!confirm("Remove this enrollment?")) return;
    setEnrollments(prev => prev.filter(e => !(e.studentEmail === en.studentEmail && e.courseCode === en.courseCode)));
  }
  function resetAll() {
    if (!confirm("Clear all enrollments?")) return;
    setEnrollments([]); setPageIndex(0);
  }

  /* ---------- export CSV ---------- */
  function onExportCsv() {
    const headers = [
      "Student Name",
      "Student Email",
      "Course Code",
      "Course Title",
      "Student Status",
      "Course Status",
      "Created At",
    ];
    const rows = enrollments.map((en) => {
      const s = studentsByEmail.get(en.studentEmail);
      const c = coursesByCode.get(en.courseCode);
      return [
        s?.name ?? "",
        en.studentEmail,
        en.courseCode,
        c?.title ?? "",
        s?.status ?? "",
        c?.status ?? "",
        en.createdAt,
      ];
    });
    exportToCsv("enrollments.csv", headers, rows);
  }

  /* ---------- UI ---------- */
  const StatusBadge = ({ active }: { active: boolean }) => (
    <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-xs " +
      (active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300")}>
      {active ? "Active" : "Inactive"}
    </span>
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPageIndex(0); }}
          placeholder="Search by student or course…"
          className="max-w-md"
        />

        <div className="flex gap-2">
          <Button variant="outline" onClick={onExportCsv}>Export CSV</Button>
          <Button variant="outline" onClick={resetAll}>Clear enrollments</Button>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button>Enroll student</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Enroll Student</DialogTitle></DialogHeader>

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
                    <option key={s.email} value={s.email} disabled={s.status === "Inactive"}>
                      {s.name} — {s.email} {s.status === "Inactive" ? "(inactive)" : ""}
                    </option>
                  ))}
                </select>
                {studentInactive && (
                  <p className="text-amber-600 dark:text-amber-400 text-xs">
                    This student is inactive. Activate them before enrolling.
                  </p>
                )}
              </div>

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
                    <option key={c.code} value={c.code} disabled={c.status === "Inactive"}>
                      {c.code} — {c.title} {c.status === "Inactive" ? "(inactive)" : ""}
                    </option>
                  ))}
                </select>
                {courseInactive && (
                  <p className="text-amber-600 dark:text-amber-400 text-xs">
                    This course is inactive. Activate it before enrolling.
                  </p>
                )}
              </div>

              <Button className="w-full mt-4" onClick={onEnroll} disabled={!canEnroll}>
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
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => openEditFor(en)}>Edit</Button>
                      <Button variant="destructive" onClick={() => onDelete(en)}>Remove</Button>
                    </div>
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
              onChange={(e) => { setPageSize(Number(e.target.value)); setPageIndex(0); }}
              className="border rounded-md p-1 bg-background"
            >
              {[5, 10, 20].map((n) => (<option key={n} value={n}>{n}</option>))}
            </select>
          </label>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setPageIndex(0)} disabled={page === 0}>{"<<"}</Button>
            <Button variant="outline" onClick={() => setPageIndex((p) => Math.max(0, p - 1))} disabled={page === 0}>{"<"}</Button>
            <Button variant="outline" onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1}>{">"}</Button>
            <Button variant="outline" onClick={() => setPageIndex(pageCount - 1)} disabled={page >= pageCount - 1}>{">>"}</Button>
          </div>
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Enrollment</DialogTitle></DialogHeader>

          <div className="space-y-2 mt-2">
            <Label htmlFor="student_e">Student</Label>
            <select
              id="student_e"
              value={editStudentEmail}
              onChange={(e) => setEditStudentEmail(e.target.value)}
              className="w-full border rounded-md p-2 bg-background"
            >
              <option value="">Select a student…</option>
              {students.map((s) => (
                <option key={s.email} value={s.email} disabled={s.status === "Inactive"}>
                  {s.name} — {s.email} {s.status === "Inactive" ? "(inactive)" : ""}
                </option>
              ))}
            </select>
            {editStudentInactive && (
              <p className="text-amber-600 dark:text-amber-400 text-xs">
                This student is inactive. Activate them before saving.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="course_e">Course</Label>
            <select
              id="course_e"
              value={editCourseCode}
              onChange={(e) => setEditCourseCode(e.target.value)}
              className="w-full border rounded-md p-2 bg-background"
            >
              <option value="">Select a course…</option>
              {courses.map((c) => (
                <option key={c.code} value={c.code} disabled={c.status === "Inactive"}>
                  {c.code} — {c.title} {c.status === "Inactive" ? "(inactive)" : ""}
                </option>
              ))}
            </select>
            {editCourseInactive && (
              <p className="text-amber-600 dark:text-amber-400 text-xs">
                This course is inactive. Activate it before saving.
              </p>
            )}
          </div>

          <div className="flex gap-2 mt-2">
            <Button className="flex-1" onClick={onSaveEdit} disabled={!canSaveEdit}>Save</Button>
            <Button variant="outline" className="flex-1" onClick={() => setOpenEdit(false)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Tiny helpers ---------- */
function Th({ label }: { label: string }) {
  return <th className="px-4 py-2 text-left font-semibold">{label}</th>;
}
