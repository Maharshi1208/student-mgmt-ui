import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { exportToCsv } from "@/lib/exportCsv";

/* storage keys */
const STUDENTS_KEY = "sms.students.v1";
const COURSES_KEY = "sms.courses.v1";

/* types */
type Student = { name: string; email: string; course?: string; status: "Active" | "Inactive" };
type Course  = { code: string; title: string };

function loadJSON<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function saveJSON<T>(key: string, value: T) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }

export default function Students() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>(() => loadJSON(STUDENTS_KEY, []));
  const [courses]  = useState<Course[]>(() => loadJSON(COURSES_KEY, []));
  const courseMap = new Map(courses.map(c => [c.code, c]));

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => saveJSON(STUDENTS_KEY, students), [students]);

  function addStudent() {
    if (!name || !email) { toast.error("Fill all fields"); return; }
    if (students.some(s => s.email.trim().toLowerCase() === email.trim().toLowerCase())) {
      toast.error("Email already exists"); return;
    }
    setStudents([...students, { name, email, status: "Active" }]);
    setName(""); setEmail(""); setOpen(false);
    toast.success("Student added");
  }

  function removeStudent(email: string) {
    if (!confirm("Delete student?")) return;
    setStudents(students.filter(s => s.email !== email));
    toast.success("Removed");
  }

  function onExportCsv() {
    const headers = ["Name", "Email", "Course Code", "Course Title", "Status"];
    const rows = students.map(s => [
      s.name,
      s.email,
      s.course ?? "",
      (s.course ? courseMap.get(s.course)?.title : "") ?? "",
      s.status,
    ]);
    exportToCsv("students", headers, rows, { timestamp: true });
    toast.info("CSV exported");
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Students</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onExportCsv}>Export CSV</Button>
          <Button variant="outline" onClick={() => navigate("/report/students?print=1")}>Print PDF</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button>Add Student</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Student</DialogTitle></DialogHeader>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} />
                <Label>Email</Label>
                <Input value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <Button className="mt-4 w-full" onClick={addStudent}>Save</Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full text-sm">
          <thead>
            <tr><th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Actions</th></tr>
          </thead>
          <tbody>
            {students.map(s => (
              <tr key={s.email} className="border-t">
                <td className="px-4 py-2">{s.name}</td>
                <td className="px-4 py-2">{s.email}</td>
                <td className="px-4 py-2">{s.status}</td>
                <td className="px-4 py-2">
                  <Button variant="destructive" onClick={() => removeStudent(s.email)}>Delete</Button>
                </td>
              </tr>
            ))}
            {students.length === 0 && <tr><td colSpan={4} className="text-center p-4">No students</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
