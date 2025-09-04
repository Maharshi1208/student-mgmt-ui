import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  studentsApi,
  coursesApi,
  enrollmentsApi,
  type Student,
  type Course,
  type Enrollment,
} from "@/lib/api";

/* Recharts */
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Legend,
  LineChart,
  Line,
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

  /* === KPIs === */
  const activeStudents = useMemo(
    () => students.filter((s) => s.status === "ACTIVE").length,
    [students]
  );
  const inactiveStudents = students.length - activeStudents;

  const activeCourses = useMemo(
    () => courses.filter((c) => c.status === "ACTIVE").length,
    [courses]
  );
  const inactiveCourses = courses.length - activeCourses;

  const totalEnrollments = enrollments.length;

  /* === Bar: enrollments per course (top 8) === */
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

  /* === Pie data === */
  const studentsPie = useMemo(
    () => [
      { name: "Active", value: activeStudents },
      { name: "Inactive", value: inactiveStudents },
    ],
    [activeStudents, inactiveStudents]
  );
  const coursesPie = useMemo(
    () => [
      { name: "Active", value: activeCourses },
      { name: "Inactive", value: inactiveCourses },
    ],
    [activeCourses, inactiveCourses]
  );

  /* === Optional: line chart of enrollments over time (by day) === */
  const enrollmentsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of enrollments) {
      const d = new Date(e.createdAt ?? Date.now());
      const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    const rows = Array.from(map.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return rows;
  }, [enrollments]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {err && !loading && (
        <div className="text-sm text-red-600 dark:text-red-400">
          Failed to load: {err}
        </div>
      )}

      {!loading && !err && (
        <>
          {/* KPI cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              title="Students (Active)"
              value={activeStudents}
              sub={`${inactiveStudents} inactive`}
            />
            <Kpi
              title="Courses (Active)"
              value={activeCourses}
              sub={`${inactiveCourses} inactive`}
            />
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

          {/* Two pies: Students & Courses */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <h2 className="text-lg font-medium mb-2">Students — Active vs Inactive</h2>
              {students.length === 0 ? (
                <div className="text-sm text-muted-foreground">No students yet.</div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={studentsPie}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius="80%"
                        label
                      />
                      <Legend />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card className="p-4">
              <h2 className="text-lg font-medium mb-2">Courses — Active vs Inactive</h2>
              {courses.length === 0 ? (
                <div className="text-sm text-muted-foreground">No courses yet.</div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={coursesPie}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius="80%"
                        label
                      />
                      <Legend />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>

          {/* Bar: Enrollments per course */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium">Enrollments per Course</h2>
              <span className="text-xs text-muted-foreground">
                Top {Math.min(8, enrollmentsPerCourse.length)}
              </span>
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
                        const entry = enrollmentsPerCourse.find(
                          (r) => r.code === label
                        );
                        return entry ? `${entry.code} — ${entry.title}` : label;
                      }}
                    />
                    <Bar dataKey="count" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Line: Enrollments per day */}
          <Card className="p-4">
            <h2 className="text-lg font-medium mb-3">Enrollments per Day</h2>
            {enrollmentsByDay.length === 0 ? (
              <div className="text-sm text-muted-foreground">No enrollment activity yet.</div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={enrollmentsByDay}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis allowDecimals={false} />
                    <Tooltip formatter={(v: any) => [v, "Enrollments"]} />
                    <Line type="monotone" dataKey="count" dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({
  title,
  value,
  sub,
}: {
  title: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );
}
