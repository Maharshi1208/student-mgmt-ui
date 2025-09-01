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
  course: z.string().min(1, "Course is required"),
  status: z.enum(["Active", "Inactive"]),
});
type Student = z.infer<typeof studentSchema>;

/* ---------------------- Seed Data ----------------------- */
const SEED: Student[] = [
  { name: "Alice Johnson", email: "alice@example.com", course: "Math", status: "Active" },
  { name: "Bob Smith", email: "bob@example.com", course: "Science", status: "Inactive" },
  { name: "Carla Diaz", email: "carla@example.com", course: "History", status: "Active" },
  { name: "Derek Lee", email: "derek@example.com", course: "Physics", status: "Active" },
  { name: "Eve Patel", email: "eve@example.com", course: "Biology", status: "Inactive" },
  { name: "Farah Khan", email: "farah@example.com", course: "Chemistry", status: "Active" },
];

/* ---------------------- Storage helpers ----------------- */
const STORAGE_KEY = "sms.students.v1";

function loadStudents(): Student[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED;
    const parsed = JSON.parse(raw) as unknown;
    // Light validation – if anything's off, fall back to seed
    if (!Array.isArray(parsed)) return SEED;
    // optional: ensure required fields exist
    const ok = (s: any) =>
      s && typeof s.name === "string" && typeof s.email === "string" &&
      typeof s.course === "string" && (s.status === "Active" || s.status === "Inactive");
    if (!parsed.every(ok)) return SEED;
    return parsed as Student[];
  } catch {
    return SEED;
  }
}

/* ---------------------- Component ----------------------- */
export default function Students() {
  // ---- state
  const [data, setData] = useState<Student[]>(() => loadStudents());
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<keyof Student>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc" | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(5);

  // ---- persist to localStorage whenever data changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* ignore write errors (e.g., storage quota) */
    }
  }, [data]);

  // ---- filtering / sorting / paging
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((s) =>
      `${s.name} ${s.email} ${s.course} ${s.status}`.toLowerCase().includes(q)
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
  const paged = useMemo(() => {
    const start = page * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  function toggleSort(key: keyof Student) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
      return;
    }
    setSortDir((prev) => (prev === "asc" ? "desc" : prev === "desc" ? null : "asc"));
  }

  /* ----- Add Student dialog + form ----- */
  const [open, setOpen] = useState(false);
  const form = useForm<Student>({
    resolver: zodResolver(studentSchema),
    defaultValues: { name: "", email: "", course: "", status: "Active" },
  });

  const onSubmit = (values: Student) => {
    const next = [...data, values];
    setData(next);
    setOpen(false);
    form.reset();
    // Jump to the last page to show the new row
    const nextCount = Math.max(1, Math.ceil(next.length / pageSize));
    setPageIndex(nextCount - 1);
  };

  // optional: reset to seed (helpful while testing)
  function resetToSeed() {
    setData(SEED);
    setPageIndex(0);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPageIndex(0); // reset on new search
            }}
            placeholder="Search by name, email, course, status…"
            className="max-w-md"
          />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={resetToSeed}>Reset data</Button>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Add Student</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Student</DialogTitle>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" {...form.register("name")} />
                  <ErrorText message={form.formState.errors.name?.message} />
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" {...form.register("email")} />
                  <ErrorText message={form.formState.errors.email?.message} />
                </div>

                <div>
                  <Label htmlFor="course">Course</Label>
                  <Input id="course" {...form.register("course")} />
                  <ErrorText message={form.formState.errors.course?.message} />
                </div>

                <div>
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    {...form.register("status")}
                    className="w-full border rounded-md p-2 bg-background"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                  <ErrorText message={form.formState.errors.status?.message} />
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
            </tr>
          </thead>
          <tbody>
            {paged.map((s, i) => (
              <tr key={`${s.email}-${i}`} className="border-t">
                <td className="px-4 py-2 font-medium">{s.name}</td>
                <td className="px-4 py-2">{s.email}</td>
                <td className="px-4 py-2">{s.course}</td>
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
              </tr>
            ))}

            {paged.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
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
                const n = Number(e.target.value);
                setPageSize(n);
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
