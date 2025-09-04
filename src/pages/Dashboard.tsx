import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { studentsApi, coursesApi, enrollmentsApi, type Student, type Course, type Enrollment } from "@/lib/api";

/* Recharts */
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function Dashboard() {
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    setLoading(true);
    Promise.all([studentsApi.list(), coursesApi.list(), enrollmentsApi.list()])
      .then(([ss, cc, ee]) => {
        if (!on) return;
        setStudents(ss);
        setCourses(cc);
        setEnrollments(ee);
        setErr(null);
      })
      .catch((e) => setErr(e.message || "Failed to load"))
      .finally(() => on && setLoading(false));
    return () => {
      on = false;
    };
  }, []);

  const activeStudents = useMemo(() => students.filter((s) => s.status === "ACTIVE").length, [students]);
  const inactiveStudents = students.length - activeStudents;

  const activeCourses = useMemo(() => courses.filter((c) => c.status === "ACTIVE").length, [courses]);
  const inactiveCourses = courses.length - activeCourses;

  const totalEnrollments = enrollments.length;

  // bar chart: enrollments per course (top 8 by count)
  const enrollmentsPerCourse = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of enrollments) {
      counts.set(e.courseCode, (counts.get(e.courseCode) ?? 0) + 1);
    }
    const rows = Array.from(counts.entries()).map(([code, count]) => {
      const title = courses.find((c) => c.code === code)?.title ?? "";
      return { code, title, count };
    });
    rows.sort((a, b) => b.count - a.count);
    return rows.slice(0, 8);
  }, [enrollments, courses]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {/* Loading / error */}
      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {err && !loading && (
        <div className="text-sm text-red-600 dark:text-red-400">Failed to load: {err}</div>
      )}

      {/* KPI cards */}
      {!loading && !err && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi title="Students (Active)" value={activeStudents} sub={`${inactiveStudents} inactive`} />
            <Kpi title="Courses (Active)" value={activeCourses} sub={`${inactiveCourses} inactive`} />
            <Kpi title="Enrollments" value={totalEnrollments} />
            <Kpi
              title="Avg. Enrollments / Active Course"
              value={
                activeCourses > 0
                  ? Math.round((totalEnrollments / activeCourses) * 10) / 10
                  : 0
              }
            />
          </div>

          {/* Chart */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium">Enrollments per Course</h2>
              <span className="text-xs text-muted-foreground">Top {Math.min(8, enrollmentsPerCourse.length)}</span>
            </div>
            {enrollmentsPerCourse.length === 0 ? (
              <div className="text-sm text-muted-foreground">No enrollments yet.</div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={enrollmentsPerCourse}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="code" />
                    <YAxis allowDecimals={false} />
                    <Tooltip
                      formatter={(val: any) => [val, "Enrollments"]}
                      labelFormatter={(label) => {
                        const entry = enrollmentsPerCourse.find((r) => r.code === label);
                        return entry ? `${entry.code} — ${entry.title}` : label;
                      }}
                    />
                    <Bar dataKey="count" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({ title, value, sub }: { title: string; value: number | string; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );
}
