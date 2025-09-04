import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  enrollmentsApi,
  studentsApi,
  coursesApi,
  type Enrollment,
  type Student,
  type Course,
} from "@/lib/api";
import { exportToCsv } from "@/lib/exportCsv";
import Papa from "papaparse";

export default function Enrollments() {
  const navigate = useNavigate();

  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [rows, setRows] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // simple search
  const [q, setQ] = useState("");

  // dialog state (add/edit)
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editId, setEditId] = useState<number | null>(null);
  const [studentEmail, setStudentEmail] = useState("");
  const [courseCode, setCourseCode] = useState("");

  // CSV import
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);

  // maps for quick lookups
  const studentMap = useMemo(() => {
    const m = new Map<string, Student>();
    students.forEach((s) => m.set(s.email, s));
    return m;
  }, [students]);

  const courseMap = useMemo(() => {
    const m = new Map<string, Course>();
    courses.forEach((c) => m.set(c.code, c));
    return m;
  }, [courses]);

  useEffect(() => {
    let on = true;
    setLoading(true);
    Promise.all([studentsApi.list(), coursesApi.list(), enrollmentsApi.list()])
      .then(([ss, cc, ee]) => {
        if (!on) return;
        setStudents(ss);
        setCourses(cc);
        setRows(ee);
        setErr(null);
      })
      .catch((e) => setErr(e.message || "Failed to load"))
      .finally(() => on && setLoading(false));
    return () => {
      on = false;
    };
  }, []);

  function resetForm() {
    setStudentEmail("");
    setCourseCode("");
    setEditId(null);
    setMode("create");
  }

  function openCreate() {
    resetForm();
    setMode("create");
    setOpen(true);
  }

  function openEdit(e: Enrollment) {
    setEditId(e.id);
    setStudentEmail(e.studentEmail);
    setCourseCode(e.courseCode);
    setMode("edit");
    setOpen(true);
  }

  async function onSave() {
    if (!studentEmail || !courseCode) return toast.error("Choose student and course");

    // UI guard (server will re-check)
    const s = studentMap.get(studentEmail);
    const c = courseMap.get(courseCode);
    if (!s || !c) return toast.error("Invalid student or course");
    if (s.status !== "ACTIVE") return toast.error("Student is INACTIVE");
    if (c.status !== "ACTIVE") return toast.error("Course is INACTIVE");

    try {
      if (mode === "create") {
        const created = await enrollmentsApi.create({ studentEmail, courseCode });
        setRows((r) => [created, ...r]);
        toast.success("Enrollment added");
      } else if (editId != null) {
        const updated = await enrollmentsApi.update(editId, { studentEmail, courseCode });
        setRows((r) => r.map((x) => (x.id === editId ? updated : x)));
        toast.success("Enrollment updated");
      }
      setOpen(false);
      resetForm();
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    }
  }

  async function onRemove(id: number) {
    if (!confirm("Remove this enrollment?")) return;
    try {
      await enrollmentsApi.remove(id);
      setRows((r) => r.filter((x) => x.id !== id));
      toast.success("Enrollment removed");
    } catch (e: any) {
      toast.error(e.message ?? "Delete failed");
    }
  }

  function onExportCsv() {
    const headers = ["Student", "Email", "Course", "Title", "StudentStatus", "CourseStatus"];
    const csvRows = rows.map((r) => {
      const s = studentMap.get(r.studentEmail);
      const c = courseMap.get(r.courseCode);
      return [
        s?.name ?? r.studentEmail,
        r.studentEmail,
        r.courseCode,
        c?.title ?? "",
        s?.status ?? "",
        c?.status ?? "",
      ];
    });
    exportToCsv("enrollments", headers, csvRows, { timestamp: true });
    toast.info("CSV exported");
  }

  /* ---------- CSV Import ---------- */
  function triggerImport() {
    fileInputRef.current?.click();
  }

  function normalizeEmail(s: unknown): string {
    return String(s ?? "").trim().toLowerCase();
  }
  function normalizeCode(s: unknown): string {
    return String(s ?? "").trim().toUpperCase();
  }

  async function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: async (result) => {
        const rowsCsv = (result.data as any[]).filter(Boolean);
        if (!Array.isArray(rowsCsv) || rowsCsv.length === 0) {
          setImporting(false);
          toast.error("CSV appears empty");
          return;
        }

        let ok = 0;
        let fail = 0;
        const createdBatch: Enrollment[] = [];

        // Import sequentially to keep rate low and errors readable
        for (const r of rowsCsv) {
          const email = normalizeEmail(r.studentEmail ?? r.studentemail ?? r.email);
          const code = normalizeCode(r.courseCode ?? r.coursecode ?? r.code);

          if (!email || !code) {
            fail++;
            continue;
          }

          // Optional pre-check (helps avoid obvious errors before hitting server)
          const s = studentMap.get(email);
          const c = courseMap.get(code);
          if (!s || !c) {
            fail++;
            continue;
          }
          if (s.status !== "ACTIVE" || c.status !== "ACTIVE") {
            // server would reject anyway
            fail++;
            continue;
          }

          try {
            const created = await enrollmentsApi.create({
              studentEmail: email,
              courseCode: code,
            });
            createdBatch.push(created);
            ok++;
          } catch (_err) {
            fail++;
          }
        }

        if (ok > 0) setRows((r) => [...createdBatch, ...r]);
        setImporting(false);

        if (fail === 0) toast.success(`Imported ${ok} enrollments`);
        else if (ok === 0) toast.error(`No rows imported. ${fail} failed.`);
        else toast.warning(`Imported ${ok} enrollments, ${fail} failed`);
      },
      error: (err) => {
        setImporting(false);
        toast.error(`Parse error: ${err?.message || "Unknown error"}`);
      },
    });

    // allow same file again later
    e.target.value = "";
  }

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const term = q.toLowerCase();
    return rows.filter((r) => {
      const s = studentMap.get(r.studentEmail);
      const c = courseMap.get(r.courseCode);
      return (
        r.studentEmail.toLowerCase().includes(term) ||
        r.courseCode.toLowerCase().includes(term) ||
        (s?.name ?? "").toLowerCase().includes(term) ||
        (c?.title ?? "").toLowerCase().includes(term)
      );
    });
  }, [q, rows, studentMap, courseMap]);

  const studentOptions = students.slice().sort((a, b) => a.name.localeCompare(b.name));
  const courseOptions = courses.slice().sort((a, b) => a.code.localeCompare(b.code));

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <h1 className="text-2xl font-semibold">Enrollments</h1>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search by student or course..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-72"
          />

          {/* Hidden file input for CSV */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleCsvFile}
            className="hidden"
          />
          <Button variant="outline" onClick={triggerImport} disabled={importing}>
            {importing ? "Importing…" : "Import CSV"}
          </Button>

          <Button variant="outline" onClick={onExportCsv}>
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/report/enrollments?print=1")}
          >
            Print PDF
          </Button>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>Enroll student</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {mode === "create" ? "Enroll student" : "Edit enrollment"}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Student</Label>
                  <select
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select student…</option>
                    {studentOptions.map((s) => (
                      <option
                        key={s.email}
                        value={s.email}
                        disabled={s.status !== "ACTIVE"}
                      >
                        {s.name} ({s.email}) {s.status !== "ACTIVE" ? "— INACTIVE" : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Only <strong>ACTIVE</strong> students can be enrolled.
                  </p>
                </div>

                <div className="space-y-1">
                  <Label>Course</Label>
                  <select
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select course…</option>
                    {courseOptions.map((c) => (
                      <option
                        key={c.code}
                        value={c.code}
                        disabled={c.status !== "ACTIVE"}
                      >
                        {c.code} — {c.title} {c.status !== "ACTIVE" ? "— INACTIVE" : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Only <strong>ACTIVE</strong> courses can be selected.
                  </p>
                </div>

                <Button className="w-full" onClick={onSave}>
                  {mode === "create" ? "Enroll" : "Save changes"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading enrollments…</div>
      ) : err ? (
        <div className="text-sm text-red-600 dark:text-red-400">
          Failed to load: {err}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left">Student</th>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Course</th>
                <th className="px-4 py-2 text-left">Title</th>
                <th className="px-4 py-2 text-left">Statuses</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const s = studentMap.get(e.studentEmail);
                const c = courseMap.get(e.courseCode);
                const sBadge =
                  s?.status === "ACTIVE"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
                const cBadge =
                  c?.status === "ACTIVE"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";

                return (
                  <tr key={e.id} className="border-t">
                    <td className="px-4 py-2">{s?.name ?? e.studentEmail}</td>
                    <td className="px-4 py-2">{e.studentEmail}</td>
                    <td className="px-4 py-2">{e.courseCode}</td>
                    <td className="px-4 py-2">{c?.title ?? ""}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs mr-1 ${sBadge}`}>
                        {s?.status ?? ""}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${cBadge}`}>
                        {c?.status ?? ""}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => openEdit(e)}>Edit</Button>
                        <Button variant="destructive" onClick={() => onRemove(e.id)}>Remove</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center p-4">
                    No enrollments
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
