import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { studentsApi, type Student } from "@/lib/api";

export default function Students() {
  const navigate = useNavigate();
  const [data, setData] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    let on = true;
    setLoading(true);
    studentsApi.list()
      .then(rows => { if (!on) return; setData(rows); setErr(null); })
      .catch(e => setErr(e.message || "Failed to load"))
      .finally(() => on && setLoading(false));
    return () => { on = false; };
  }, []);

  async function onAdd() {
    if (!name || !email) return toast.error("Fill all fields");
    try {
      const created = await studentsApi.create({ name, email, status: "ACTIVE", course: null });
      setData(d => [...d, created]);
      setName(""); setEmail(""); setOpen(false);
      toast.success("Student added");
    } catch (e: any) { toast.error(e.message ?? "Create failed"); }
  }

  async function onDelete(email: string) {
    if (!confirm("Delete this student? This will also remove their enrollments.")) return;
    try {
      await studentsApi.remove(email);
      setData(d => d.filter(s => s.email !== email));
      toast.success("Student removed");
    } catch (e: any) { toast.error(e.message ?? "Delete failed"); }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Students</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/report/students?print=1")}>Print PDF</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button>Add Student</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Student</DialogTitle></DialogHeader>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Alice Johnson" />
                <Label>Email</Label>
                <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="alice@example.com" type="email" />
              </div>
              <Button className="mt-4 w-full" onClick={onAdd}>Save</Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading students…</div>
      ) : err ? (
        <div className="text-sm text-red-600 dark:text-red-400">Failed to load: {err}</div>
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
              {data.map(s => (
                <tr key={s.email} className="border-t">
                  <td className="px-4 py-2">{s.name}</td>
                  <td className="px-4 py-2">{s.email}</td>
                  <td className="px-4 py-2">
                    <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-xs " + (s.status === "ACTIVE"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300")}>
                      {s.status === "ACTIVE" ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <Button variant="destructive" onClick={() => onDelete(s.email)}>Delete</Button>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr><td colSpan={4} className="text-center p-4">No students</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
