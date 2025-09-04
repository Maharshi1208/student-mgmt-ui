import { useEffect, useRef, useState } from "react";
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
import { coursesApi, type Course } from "@/lib/api";
import { exportToCsv } from "@/lib/exportCsv";
import Papa from "papaparse";

export default function Courses() {
  const navigate = useNavigate();

  const [data, setData] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [credits, setCredits] = useState<number>(3);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editCode, setEditCode] = useState<string | null>(null); // id for PATCH
  const [editTitle, setEditTitle] = useState("");
  const [editCredits, setEditCredits] = useState<number>(3);
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");

  // CSV import
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    let on = true;
    setLoading(true);
    coursesApi
      .list()
      .then((rows) => {
        if (!on) return;
        setData(rows);
        setErr(null);
      })
      .catch((e) => setErr(e.message || "Failed to load"))
      .finally(() => on && setLoading(false));
    return () => {
      on = false;
    };
  }, []);

  async function onAdd() {
    if (!code || !title) return toast.error("Fill all fields");
    try {
      const created = await coursesApi.create({
        code,
        title,
        credits: Number(credits) || 0,
        status: "ACTIVE",
      });
      setData((d) => [...d, created]);
      setCode("");
      setTitle("");
      setCredits(3);
      setAddOpen(false);
      toast.success("Course added");
    } catch (e: any) {
      toast.error(e.message ?? "Create failed");
    }
  }

  function onOpenEdit(c: Course) {
    setEditCode(c.code);
    setEditTitle(c.title);
    setEditCredits(c.credits);
    setEditStatus(c.status);
    setEditOpen(true);
  }

  async function onSaveEdit() {
    if (!editCode) return;
    if (!editTitle) return toast.error("Title is required");
    if (Number.isNaN(editCredits) || editCredits < 0)
      return toast.error("Credits must be >= 0");

    try {
      const updated = await coursesApi.update(editCode, {
        title: editTitle,
        credits: Number(editCredits),
        status: editStatus,
      });
      setData((d) => d.map((c) => (c.code === editCode ? updated : c)));
      setEditOpen(false);
      toast.success("Course updated");
    } catch (e: any) {
      toast.error(e.message ?? "Update failed");
    }
  }

  async function onDelete(code: string) {
    if (!confirm("Delete this course? This will also remove related enrollments."))
      return;
    try {
      await coursesApi.remove(code);
      setData((d) => d.filter((c) => c.code !== code));
      toast.success("Course removed");
    } catch (e: any) {
      toast.error(e.message ?? "Delete failed");
    }
  }

  /* ---------- CSV Import ---------- */
  function triggerImport() {
    fileInputRef.current?.click();
  }

  function parseStatus(v: string | undefined): "ACTIVE" | "INACTIVE" {
    if (!v) return "ACTIVE";
    const s = String(v).trim().toUpperCase();
    if (["ACTIVE", "A", "TRUE", "1"].includes(s)) return "ACTIVE";
    if (["INACTIVE", "I", "FALSE", "0"].includes(s)) return "INACTIVE";
    return "ACTIVE";
  }

  function parseCredits(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
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
        const rows = (result.data as any[]).filter(Boolean);
        if (!Array.isArray(rows) || rows.length === 0) {
          setImporting(false);
          toast.error("CSV appears empty");
          return;
        }

        let ok = 0;
        let fail = 0;
        const newOnes: Course[] = [];

        for (const r of rows) {
          const code = (r.code ?? "").toString().trim();
          const title = (r.title ?? "").toString().trim();
          const credits = parseCredits(r.credits);
          const status = parseStatus(r.status);

          if (!code || !title) {
            fail++;
            continue;
          }

          try {
            const created = await coursesApi.create({
              code,
              title,
              credits,
              status,
            });
            ok++;
            newOnes.push(created);
          } catch (_err) {
            fail++;
          }
        }

        if (ok > 0) setData((d) => [...d, ...newOnes]);
        setImporting(false);

        if (fail === 0) toast.success(`Imported ${ok} courses`);
        else if (ok === 0) toast.error(`No rows imported. ${fail} failed.`);
        else toast.warning(`Imported ${ok} courses, ${fail} failed`);
      },
      error: (err) => {
        setImporting(false);
        toast.error(`Parse error: ${err?.message || "Unknown error"}`);
      },
    });

    // allow picking same file again later
    e.target.value = "";
  }

  function onExportCsv() {
    const headers = ["Code", "Title", "Credits", "Status"];
    const rows = data.map((c) => [c.code, c.title, c.credits, c.status]);
    exportToCsv("courses", headers, rows, { timestamp: true });
    toast.info("CSV exported");
  }

  return (
    <div className="space-y-4">
      {/* Header / toolbar */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Courses</h1>
        <div className="flex gap-2">
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
            onClick={() => navigate("/report/courses?print=1")}
          >
            Print PDF
          </Button>

          {/* Add Course */}
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button>Add Course</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Course</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="MATH101"
                />
                <Label>Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Basic Math"
                />
                <Label>Credits</Label>
                <Input
                  type="number"
                  value={credits}
                  onChange={(e) => setCredits(Number(e.target.value))}
                />
              </div>
              <Button className="mt-4 w-full" onClick={onAdd}>
                Save
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading courses…</div>
      ) : err ? (
        <div className="text-sm text-red-600 dark:text-red-400">
          Failed to load: {err}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left">Code</th>
                <th className="px-4 py-2 text-left">Title</th>
                <th className="px-4 py-2 text-left">Credits</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.code} className="border-t">
                  <td className="px-4 py-2">{c.code}</td>
                  <td className="px-4 py-2">{c.title}</td>
                  <td className="px-4 py-2">{c.credits}</td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs " +
                        (c.status === "ACTIVE"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300")
                      }
                    >
                      {c.status === "ACTIVE" ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => onOpenEdit(c)}>
                        Edit
                      </Button>
                      <Button variant="destructive" onClick={() => onDelete(c.code)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center p-4">
                    No courses
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Course</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Course title"
            />
            <Label>Credits</Label>
            <Input
              type="number"
              value={editCredits}
              onChange={(e) => setEditCredits(Number(e.target.value))}
            />
            <Label>Status</Label>
            <select
              value={editStatus}
              onChange={(e) =>
                setEditStatus(e.target.value as "ACTIVE" | "INACTIVE")
              }
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Inactive courses cannot accept new enrollments (server-enforced).
            </p>
          </div>
          <Button className="mt-2 w-full" onClick={onSaveEdit}>
            Save changes
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
