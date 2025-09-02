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

/* ---------------------- Validation ---------------------- */
const studentSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email"),
  course: z.string().optional().default(""), // stores course CODE from Courses page
  status: z.enum(["Active", "Inactive"]),
});
type Student = z.infer<typeof studentSchema>;

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

/* ---------------------- Storage keys -------------------- */
const STUDENTS_KEY = "sms.students.v1";
const COURSES_KEY = "sms.courses.v1";
const ENROLLMENTS_KEY = "sms.enrollments.v1";

/* ---------------------- Seed (only if empty) ------------ */
const SEED: Student[] = [
  { name: "Alice Johnson", email: "alice@example.com", course: "MATH101", status: "Active" },
  { name: "Bob Smith", email: "bob@example.com", course: "SCI201", status: "Inactive" },
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

export default function Students() {
  /* ---------- state ---------- */
  const [students, setStudents] = useState<Student[]>(() => {
    const loaded = loadJSON<Student[]>(STUDENTS_KEY, []);
    return loaded.length ? loaded : SEED;
  });
  const [courses, setCourses] = useState<Course[]>(() =>
    loadJSON<Course[]>(COURSES_KEY, [
      { code: "MATH101", title: "Basic Math", credits: 3, status: "Active" },
      { code: "SCI201", title: "Science Fundamentals", credits: 4, status: "Inactive" },
      { code: "HIST150", title: "World History", credits: 3, status: "Active" },
    ])
  );

  // persist students
  useEffect(() => saveJSON(STUDENTS_KEY, students), [students]);

  // keep courses fresh if changed elsewhere
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === COURSES_KEY) setCourses(loadJSON(COURSES_KEY, []));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /* ---------- search/sort/pagination ---------- */
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<keyof Student>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc" | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(5);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) =>
      `${s.name} ${s.email} ${s.course} ${s.status}`.toLowerCase().includes(q)
    );
  }, [students, query]);

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
  const paged = useMemo(() => {
    const start = page * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  function toggleSort(key: keyof Student) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else {
      setSortDir((prev) => (prev === "asc" ? "desc" : prev === "desc" ? null : "asc"));
    }
  }

  /* ---------- derived ---------- */
  const courseMap = useMemo(() => {
    const m = new Map<string, Course>();
    for (const c of courses) m.set(c.code, c);
    return m;
  }, [courses]);
  function courseLabel(code: string) {
    if (!code) return "-";
    const c = courseMap.get(code);
    return c ? `${c.code} — ${c.title}` : code;
  }

  /* ---------- Add Student dialog ---------- */
  const [openAdd, setOpenAdd] = useState(false);
  const addForm = useForm<Student>({
    resolver: zodResolver(studentSchema),
    defaultValues: { name: "", email: "", course: "", status: "Active" },
  });

  function onAdd(values: Student) {
    // unique email
    if (students.some((s) => s.email.toLowerCase() === values.email.toLowerCase())) {
      alert("A student with this email already exists.");
      return;
    }
    // integrity: chosen course must be Active (or empty)
    if (values.course) {
      const c = courseMap.get(values.course);
      if (!c) {
        alert("Selected course no longer exists.");
        return;
      }
      if (c.status !== "Active") {
        alert("Cannot assign an INACTIVE course. Please choose an active course.");
        return;
      }
    }

    const next = [...students, values];
    setStudents(next);
    setOpenAdd(false);
    addForm.reset();
    const total = Math.max(1, Math.ceil(next.length / pageSize));
    setPageIndex(total - 1);
  }

  /* ---------- Edit Student dialog ---------- */
  const [openEdit, setOpenEdit] = useState(false);
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const editForm = useForm<Student>({
    resolver: zodResolver(studentSchema),
    defaultValues: { name: "", email: "", course: "", status: "Active" },
  });

  function openEditFor(s: Student) {
    setEditingEmail(s.email);
    editForm.reset(s);
    setOpenEdit(true);
  }

  function onEditSubmit(values: Student) {
    if (!editingEmail) return;

    const emailChanged = editingEmail.toLowerCase() !== values.email.toLowerCase();

    // uniqueness
    if (
      emailChanged &&
      students.some((x) => x.email.toLowerCase() === values.email.toLowerCase())
    ) {
      alert("A student with this email already exists.");
      return;
    }

    // integrity: course selected must be Active (or empty)
    if (values.course) {
      const c = courseMap.get(values.course);
      if (!c) {
        alert("Selected course no longer exists.");
        return;
      }
      if (c.status !== "Active") {
        alert("Cannot assign an INACTIVE course. Please choose an active course.");
        return;
      }
    }

    // integrity: switching student to Inactive while they have enrollments → confirm
    const enrollments = loadJSON<Enrollment[]>(ENROLLMENTS_KEY, []);
    const hadEnrollments = enrollments.some(
      (e) => e.studentEmail.toLowerCase() === editingEmail.toLowerCase()
    );
    const turningInactive = values.status === "Inactive";
    if (turningInactive && hadEnrollments) {
      const ok = confirm(
        "This student has enrollments. Marking them Inactive will prevent new enrollments but will NOT delete existing ones. Continue?"
      );
      if (!ok) return;
    }

    // update students
    const updated = students.map((s) => (s.email === editingEmail ? values : s));
    setStudents(updated);

    // propagate email change in enrollments
    if (emailChanged) {
      const updatedEnrollments = enrollments.map((e) =>
        e.studentEmail.toLowerCase() === editingEmail.toLowerCase()
          ? { ...e, studentEmail: values.email }
          : e
      );
      saveJSON(ENROLLMENTS_KEY, updatedEnrollments);
    }

    setOpenEdit(false);
    setEditingEmail(null);
  }

  /* ---------- Delete Student ---------- */
  function onDelete(s: Student) {
    if (!confirm(`Delete ${s.name}? This also removes their enrollments.`)) return;

    const next = students.filter((x) => x.email !== s.email);
    setStudents(next);

    const enrollments = loadJSON<Enrollment[]>(ENROLLMENTS_KEY, []);
    const remaining = enrollments.filter(
      (e) => e.studentEmail.toLowerCase() !== s.email.toLowerCase()
    );
    saveJSON(ENROLLMENTS_KEY, remaining);
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
          placeholder="Search by name, email, course code/title, status…"
          className="max-w-md"
        />

        <div className="flex gap-2">
          <Dialog open={openAdd} onOpenChange={setOpenAdd}>
            <DialogTrigger asChild>
              <Button>Add Student</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Student</DialogTitle>
              </DialogHeader>
              <form onSubmit={addForm.handleSubmit(onAdd)} className="space-y-4 mt-2">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" {...addForm.register("name")} />
                  <ErrorText message={addForm.formState.errors.name?.message} />
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" {...addForm.register("email")} />
                  <ErrorText message={addForm.formState.errors.email?.message} />
                </div>

                <div>
                  <Label htmlFor="course">Course</Label>
                  <select
                    id="course"
                    {...addForm.register("course")}
                    className="w-full border rounded-md p-2 bg-background"
                  >
                    <option value="">No course</option>
                    {courses.map((c) => (
                      <option key={c.code} value={c.code} disabled={c.status === "Inactive"}>
                        {c.code} — {c.title} {c.status === "Inactive" ? "(inactive)" : ""}
                      </option>
                    ))}
                  </select>
                  <ErrorText message={addForm.formState.errors.course?.message} />
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
              <Th onClick={() => toggleSort("name")}   label="Name"   active={sortKey === "name"}   dir={sortDir} />
              <Th onClick={() => toggleSort("email")}  label="Email"  active={sortKey === "email"}  dir={sortDir} />
              <Th onClick={() => toggleSort("course")} label="Course" active={sortKey === "course"} dir={sortDir} />
              <Th onClick={() => toggleSort("status")} label="Status" active={sortKey === "status"} dir={sortDir} />
              <th className="px-4 py-2 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((s) => (
              <tr key={s.email} className="border-t">
                <td className="px-4 py-2 font-medium">{s.name}</td>
                <td className="px-4 py-2">{s.email}</td>
                <td className="px-4 py-2">{courseLabel(s.course ?? "")}</td>
                <td className="px-4 py-2">
                  <span
                    className={
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs " +
                      (s.status === "Active"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300")
                    }
                  >
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => openEditFor(s)}>Edit</Button>
                    <Button variant="destructive" onClick={() => onDelete(s)}>Delete</Button>
                  </div>
                </td>
              </tr>
            ))}

            {paged.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No students found.
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

      {/* Edit dialog */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 mt-2">
            <div>
              <Label htmlFor="name_e">Name</Label>
              <Input id="name_e" {...editForm.register("name")} />
              <ErrorText message={editForm.formState.errors.name?.message} />
            </div>

            <div>
              <Label htmlFor="email_e">Email</Label>
              <Input id="email_e" type="email" {...editForm.register("email")} />
              <p className="text-xs text-muted-foreground mt-1">
                Changing the email will update their enrollments too.
              </p>
              <ErrorText message={editForm.formState.errors.email?.message} />
            </div>

            <div>
              <Label htmlFor="course_e">Course</Label>
              <select
                id="course_e"
                {...editForm.register("course")}
                className="w-full border rounded-md p-2 bg-background"
              >
                <option value="">No course</option>
                {courses.map((c) => (
                  <option key={c.code} value={c.code} disabled={c.status === "Inactive"}>
                    {c.code} — {c.title} {c.status === "Inactive" ? "(inactive)" : ""}
                  </option>
                ))}
              </select>
              <ErrorText message={editForm.formState.errors.course?.message} />
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

/* ---------------------- Small helpers ------------------- */
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
