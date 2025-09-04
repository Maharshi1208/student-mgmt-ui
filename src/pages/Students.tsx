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
import { studentsApi, type Student } from "@/lib/api";
import Papa from "papaparse";

export default function Students() {
  const navigate = useNavigate();

  const [data, setData] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Add dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editEmail, setEditEmail] = useState<string | null>(null); // id for PATCH
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");

  // CSV import
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);

  // Fetch list on mount
  useEffect(() => {
    let on = true;
    setLoading(true);
    studentsApi
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
    if (!name || !email) return toast.error("Fill all fields");
    try {
      const created = await studentsApi.create({
        name,
        email,
        status: "ACTIVE",
        course: null,
      });
      setData((d) => [...d, created]);
      setName("");
      setEmail("");
      setAddOpen(false);
      toast.success("Student added");
    } catch (e: any) {
      toast.error(e.message ?? "Create failed");
    }
  }

  function onOpenEdit(s: Student) {
    setEditEmail(s.email);
    setEditName(s.name);
    setEditStatus(s.status);
    setEditOpen(true);
  }

  async function onSaveEdit() {
    if (!editEmail) return;
    if (!editName) return toast.error("Name is required");
    try {
      const updated = await studentsApi.update(editEmail, {
        name: editName,
        status: editStatus,
      });
      setData((d) => d.map((s) => (s.email === editEmail ? updated : s)));
      setEditOpen(false);
      toast.success("Student updated");
    } catch (e: any) {
      toast.error(e.message ?? "Update failed");
    }
  }

  async function onDelete(email: string) {
    if (!confirm("Delete this student? This will also remove their enrollments.")) return;
    try {
      await studentsApi.remove(email);
      setData((d) => d.filter((s) => s.email !== email));
      toast.success("Student removed");
    } catch (e: any) {
      toast.error(e.message ?? "Delete failed");
    }
  }

  /* ---------- CSV Import ---------- */
  function triggerImport() {
    fileInputRef.current?.click();
  }

  function parseBooleanishStatus(v: string | undefined): "ACTIVE" | "INACTIVE" {
    if (!v) return "ACTIVE";
    const s = String(v).trim().toUpperCase();
    if (s === "ACTIVE" || s === "A" || s === "TRUE" || s === "1") return "ACTIVE";
    if (s === "INACTIVE" || s === "I" || s === "FALSE" || s === "0") return "INACTIVE";
    return "ACTIVE";
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
        // rows expected to have: name, email, status?
        const rows = (result.data as any[]).filter(Boolean);
        if (!Array.isArray(rows) || rows.length === 0) {
          setImporting(false);
          toast.error("CSV appears empty");
          return;
        }

        let ok = 0;
        let fail = 0;
        const newOnes: Student[] = [];

        // create students sequentially to keep UX simple & avoid flooding server
        for (const r of rows) {
          const name = (r.name ?? "").toString().trim();
          const email = (r.email ?? "").toString().trim();
          const status = parseBooleanishStatus(r.status);

          if (!name || !email) {
            fail++;
            continue;
          }

          try {
            const created = await studentsApi.create({
              name,
              email,
              status,
              course: null,
            });
            ok++;
            newOnes.push(created);
          } catch (_err) {
            // could be duplicate/validation error
            fail++;
          }
        }

        if (ok > 0) setData((d) => [...d, ...newOnes]);
        setImporting(false);

        if (fail === 0) toast.success(`Imported ${ok} students`);
        else if (ok === 0) toast.error(`No rows imported. ${fail} failed.`);
        else toast.warning(`Imported ${ok} students, ${fail} failed`);
      },
      error: (err) => {
        setImporting(false);
        toast.error(`Parse error: ${err?.message || "Unknown error"}`);
      },
    });

    // clear input so same file can be picked again if needed
    e.target.value = "";
  }

  return (
    <div className="space-y-4">
      {/* Header / toolbar */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Students</h1>
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

          <Button
            variant="outline"
            onClick={() => navigate("/report/students?print=1")}
          >
            Print PDF
          </Button>

          {/* Add Student */}
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button>Add Student</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Student</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alice Johnson"
                />
                <Label>Email</Label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alice@example.com"
                  type="email"
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
        <div className="text-sm text-muted-foreground">Loading students…</div>
      ) : err ? (
        <div className="text-sm text-red-600 dark:text-red-400">
          Failed to load: {err}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.email} className="border-t">
                  <td className="px-4 py-2">{s.name}</td>
                  <td className="px-4 py-2">{s.email}</td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs " +
                        (s.status === "ACTIVE"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300")
                      }
                    >
                      {s.status === "ACTIVE" ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => onOpenEdit(s)}>
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => onDelete(s.email)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center p-4">
                    No students
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
            <DialogTitle>Edit Student</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Full name"
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
              Inactive students cannot be enrolled (server-enforced).
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
