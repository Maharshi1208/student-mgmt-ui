import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { exportToCsv } from "@/lib/exportCsv";

/* storage key */
const COURSES_KEY = "sms.courses.v1";

type Course = { code: string; title: string; credits: number; status: "Active" | "Inactive" };

function loadJSON<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function saveJSON<T>(key: string, value: T) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }

export default function Courses() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>(() => loadJSON(COURSES_KEY, []));
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [credits, setCredits] = useState(3);

  useEffect(() => saveJSON(COURSES_KEY, courses), [courses]);

  function addCourse() {
    if (!code || !title) { toast.error("Fill all fields"); return; }
    if (courses.some(c => c.code.trim().toUpperCase() === code.trim().toUpperCase())) {
      toast.error("Code already exists"); return;
    }
    setCourses([...courses, { code, title, credits, status: "Active" }]);
    setCode(""); setTitle(""); setCredits(3); setOpen(false);
    toast.success("Course added");
  }

  function removeCourse(code: string) {
    if (!confirm("Delete course?")) return;
    setCourses(courses.filter(c => c.code !== code));
    toast.success("Removed");
  }

  function onExportCsv() {
    const headers = ["Code", "Title", "Credits", "Status"];
    const rows = courses.map(c => [c.code, c.title, c.credits, c.status]);
    exportToCsv("courses", headers, rows, { timestamp: true });
    toast.info("CSV exported");
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Courses</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onExportCsv}>Export CSV</Button>
          <Button variant="outline" onClick={() => navigate("/report/courses?print=1")}>Print PDF</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button>Add Course</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Course</DialogTitle></DialogHeader>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input value={code} onChange={e => setCode(e.target.value)} />
                <Label>Title</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} />
                <Label>Credits</Label>
                <Input type="number" value={credits} onChange={e => setCredits(Number(e.target.value))} />
              </div>
              <Button className="mt-4 w-full" onClick={addCourse}>Save</Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full text-sm">
          <thead>
            <tr><th className="px-4 py-2 text-left">Code</th>
                <th className="px-4 py-2 text-left">Title</th>
                <th className="px-4 py-2 text-left">Credits</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Actions</th></tr>
          </thead>
          <tbody>
            {courses.map(c => (
              <tr key={c.code} className="border-t">
                <td className="px-4 py-2">{c.code}</td>
                <td className="px-4 py-2">{c.title}</td>
                <td className="px-4 py-2">{c.credits}</td>
                <td className="px-4 py-2">{c.status}</td>
                <td className="px-4 py-2">
                  <Button variant="destructive" onClick={() => removeCourse(c.code)}>Delete</Button>
                </td>
              </tr>
            ))}
            {courses.length === 0 && <tr><td colSpan={5} className="text-center p-4">No courses</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
