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
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { exportToCsv } from "@/lib/exportCsv";

/* ---------------------- Validation ---------------------- */
const courseSchema = z.object({
  code: z.string().min(2, "Code is required"),
  title: z.string().min(2, "Title is required"),
  credits: z.coerce.number().min(1, "Credits must be >= 1"),
  status: z.enum(["Active", "Inactive"]),
});
type Course = z.infer<typeof courseSchema>;

type Student = {
  name: string;
  email: string;
  course: string;
  status: "Active" | "Inactive";
};
type Enrollment = {
  studentEmail: string;
  courseCode: string;
  createdAt: string;
};

/* ---------------------- Storage keys -------------------- */
const COURSES_KEY = "sms.courses.v1";
const STUDENTS_KEY = "sms.students.v1";
const ENROLLMENTS_KEY = "sms.enrollments.v1";

/* ---------------------- Seed ---------------------------- */
const SEED: Course[] = [
  { code: "MATH101", title: "Basic Math", credits: 3, status: "Active" },
  { code: "SCI201", title: "Science Fundamentals", credits: 4, status: "Inactive" },
  { code: "HIST150", title: "World History", credits: 3, status: "Active" },
];

/* ---------------------- Helpers ------------------------- */
function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function saveJSON<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

/* ======================================================== */

export default function Courses() {
  const [data, setData] = useState<Course[]>(() => loadJSON<Course[]>(COURSES_KEY, SEED));
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<keyof Course>("code");
  const [sortDir, setSortDir] = useState<"asc" | "desc" | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(5);

  useEffect(() => saveJSON(COURSES_KEY, data), [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((c) =>
      `${c.code} ${c.title} ${c.credits} ${c.status}`.toLowerCase().includes(q)
    );
  }, [data, query]);

  const sorted = useMemo(() => {
    if (!sortDir) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = String(a[sortKey]).toLowerCase();
      const bv = String(b[sortKey]).toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [filtered, sortDir, sortKey]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = Math.min(pageIndex, pageCount - 1);
  const paged = sorted.slice(page * pageSize, page * pageSize + pageSize);

  function toggleSort(key: keyof Course) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else {
      setSortDir((prev) => (prev === "asc" ? "desc" : prev === "desc" ? null : "asc"));
    }
  }

  /* ----- Add Course ----- */
  const [openAdd, setOpenAdd] = useState(false);
  const addForm = useForm<Course>({
    resolver: zodResolver(courseSchema),
    defaultValues: { code: "", title: "", credits: 3, status: "Active" },
  });

  function onAdd(values: Course) {
    if (data.some((c) => c.code.toLowerCase() === values.code.toLowerCase())) {
      alert("A course with this code already exists.");
      return;
    }
    const next = [...data, values];
    setData(next);
    setOpenAdd(false);
    addForm.reset();
    setPageIndex(Math.max(1, Math.ceil(next.length / pageSize)) - 1);
  }

  /* ----- Edit Course ----- */
  const [openEdit, setOpenEdit] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const editForm = useForm<Course>({
    resolver: zodResolver(courseSchema),
    defaultValues: { code: "", title: "", credits: 3, status: "Active" },
  });

  function openEditFor(c: Course) {
    setEditingCode(c.code);
    editForm.reset(c);
    setOpenEdit(true);
  }

  function onEditSubmit(values: Course) {
    if (!editingCode) return;

    const codeChanged = editingCode.toLowerCase() !== values.code.toLowerCase();
    if (
      codeChanged &&
      data.some((x) => x.code.toLowerCase() === values.code.toLowerCase())
    ) {
      alert("A course with this code already exists.");
      return;
    }

    const enrollments = loadJSON<Enrollment[]>(ENROLLMENTS_KEY, []);
    const hasEnrollments = enrollments.some(
      (e) => e.courseCode.toLowerCase() === editingCode.toLowerCase()
    );
    const turningInactive = values.status === "Inactive";
    if (turningInactive && hasEnrollments) {
      const ok = confirm(
        "This course has enrollments. Marking it Inactive will prevent new enrollments but will NOT delete existing ones. Continue?"
      );
      if (!ok) return;
    }

    const updatedCourses = data.map((c) => (c.code === editingCode ? values : c));
    setData(updatedCourses);

    if (codeChanged) {
      const students = loadJSON<Student[]>(STUDENTS_KEY, []);
      const studentsUpdated = students.map((s) =>
        (s.course ?? "").toLowerCase() === editingCode.toLowerCase()
          ? { ...s, course: values.code }
          : s
      );
      saveJSON(STUDENTS_KEY, studentsUpdated);

      const updatedEnrollments = enrollments.map((e) =>
        e.courseCode.toLowerCase() === editingCode.toLowerCase()
          ? { ...e, courseCode: values.code }
          : e
      );
      saveJSON(ENROLLMENTS_KEY, updatedEnrollments);
    }

    setOpenEdit(false);
    setEditingCode(null);
  }

  /* ----- Delete Course ----- */
  function onDelete(c: Course) {
    const enrollments = loadJSON<Enrollment[]>(ENROLLMENTS_KEY, []);
    const hasEnrollments = enrollments.some(
      (e) => e.courseCode.toLowerCase() === c.code.toLowerCase()
    );
    const extra = hasEnrollments
      ? "\n\nThis will also remove related enrollments and clear the course on affected students."
      : "";
    if (!confirm(`Delete ${c.code} — ${c.title}?${extra}`)) return;

    const remainingCourses = data.filter((x) => x.code !== c.code);
    setData(remainingCourses);

    const remainingEnrollments = enrollments.filter(
      (e) => e.courseCode.toLowerCase() !== c.code.toLowerCase()
    );
    saveJSON(ENROLLMENTS_KEY, remainingEnrollments);

    const students = loadJSON<Student[]>(STUDENTS_KEY, []);
    const clearedStudents = students.map((s) =>
      (s.course ?? "").toLowerCase() === c.code.toLowerCase() ? { ...s, course: "" } : s
    );
    saveJSON(STUDENTS_KEY, clearedStudents);
  }

  /* ----- Export CSV ----- */
  function onExportCsv() {
    const headers = ["Code", "Title", "Credits", "Status"];
    const rows = data.map((c) => [c.code, c.title, c.credits, c.status]);
    exportToCsv("courses.csv", headers, rows);
  }

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
          placeholder="Search by code, title, credits, status…"
          className="max-w-md"
        />

        <div className="flex gap-2">
          <Button variant="outline" onClick={onExportCsv}>Export CSV</Button>

          <Dialog open={openAdd} onOpenChange={setOpenAdd}>
            <DialogTrigger asChild>
              <Button>Add Course</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Course</DialogTitle>
              </DialogHeader>
              <form onSubmit={addForm.handleSubmit(onAdd)} className="space-y-4 mt-2">
                <div>
                  <Label htmlFor="code">Code</Label>
                  <Input id="code" {...addForm.register("code")} />
                  <ErrorText message={addForm.formState.errors.code?.message} />
                </div>
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" {...addForm.register("title")} />
                  <ErrorText message={addForm.formState.errors.title?.message} />
                </div>
                <div>
                  <Label htmlFor="credits">Credits</Label>
                  <Input id="credits" type="number" {...addForm.register("credits")} />
                  <ErrorText message={addForm.formState.errors.credits?.message} />
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    {...addForm.register("status")}
                    className="w-full border rounded-md p-2 bg-background"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                  <ErrorText message={addForm.formState.errors.status?.message} />
                </div>
                <Button type="submit" className="w-full">Save</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <Th onClick={() => toggleSort("code")} label="Code" active={sortKey === "code"} dir={sortDir} />
              <Th onClick={() => toggleSort("title")} label="Title" active={sortKey === "title"} dir={sortDir} />
              <Th onClick={() => toggleSort("credits")} label="Credits" active={sortKey === "credits"} dir={sortDir} />
              <Th onClick={() => toggleSort("status")} label="Status" active={sortKey === "status"} dir={sortDir} />
              <th className="px-4 py-2 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((c) => (
              <tr key={c.code} className="border-t">
                <td className="px-4 py-2 font-medium">{c.code}</td>
                <td className="px-4 py-2">{c.title}</td>
                <td className="px-4 py-2">{c.credits}</td>
                <td className="px-4 py-2">
                  <span
                    className={
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs " +
                      (c.status === "Active"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300")
                    }
                  >
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => openEditFor(c)}>Edit</Button>
                    <Button variant="destructive" onClick={() => onDelete(c)}>Delete</Button>
                  </div>
                </td>
              </tr>
            ))}

            {paged.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No courses found.
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
          <span className="font-medium">{pageCount}</span> — {sorted.length} total
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
          <DialogHeader>
            <DialogTitle>Edit Course</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 mt-2">
            <div>
              <Label htmlFor="code_e">Code</Label>
              <Input id="code_e" {...editForm.register("code")} />
              <ErrorText message={editForm.formState.errors.code?.message} />
            </div>
            <div>
              <Label htmlFor="title_e">Title</Label>
              <Input id="title_e" {...editForm.register("title")} />
              <ErrorText message={editForm.formState.errors.title?.message} />
            </div>
            <div>
              <Label htmlFor="credits_e">Credits</Label>
              <Input id="credits_e" type="number" {...editForm.register("credits")} />
              <ErrorText message={editForm.formState.errors.credits?.message} />
            </div>
            <div>
              <Label htmlFor="status_e">Status</Label>
              <select
                id="status_e"
                {...editForm.register("status")}
                className="w-full border rounded-md p-2 bg-background"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
              <ErrorText message={editForm.formState.errors.status?.message} />
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1">Save</Button>
              <Button type="button" variant="outline" className="flex-1" onClick={() => setOpenEdit(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------------- Helpers ----------------------- */
function ErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-red-500 text-xs mt-1">{message}</p>;
}
function Th({
  onClick,
  label,
  active,
  dir,
}: {
  onClick: () => void;
  label: string;
  active: boolean;
  dir: "asc" | "desc" | null;
}) {
  return (
    <th className="px-4 py-2 text-left font-semibold">
      <button className="inline-flex items-center gap-1 hover:underline" onClick={onClick}>
        {label}
        <span aria-hidden className={active ? "" : "opacity-40"}>
          {dir === "asc" ? "▲" : dir === "desc" ? "▼" : "↕"}
        </span>
      </button>
    </th>
  );
}
