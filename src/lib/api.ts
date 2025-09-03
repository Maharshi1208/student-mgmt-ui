// src/lib/api.ts
const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

/* ========= Students ========= */
export type Student = {
  email: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  course?: string | null;
  createdAt?: string;
};

export const studentsApi = {
  list: () => http<Student[]>("/students"),
  create: (s: Student) =>
    http<Student>("/students", { method: "POST", body: JSON.stringify(s) }),
  update: (email: string, patch: Partial<Student>) =>
    http<Student>(`/students/${encodeURIComponent(email)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  remove: (email: string) =>
    fetch(`${BASE_URL}/students/${encodeURIComponent(email)}`, {
      method: "DELETE",
    }).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    }),
};

/* ========= Courses ========= */
export type Course = {
  code: string;
  title: string;
  credits: number;
  status: "ACTIVE" | "INACTIVE";
  createdAt?: string;
};

export const coursesApi = {
  list: () => http<Course[]>("/courses"),
  create: (c: Course) =>
    http<Course>("/courses", { method: "POST", body: JSON.stringify(c) }),
  update: (code: string, patch: Partial<Course>) =>
    http<Course>(`/courses/${encodeURIComponent(code)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  remove: (code: string) =>
    fetch(`${BASE_URL}/courses/${encodeURIComponent(code)}`, {
      method: "DELETE",
    }).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    }),
};

/* ========= Enrollments ========= */
export type Enrollment = {
  id: number;
  studentEmail: string;
  courseCode: string;
  createdAt?: string;
};

export const enrollmentsApi = {
  list: () => http<Enrollment[]>("/enrollments"),
  create: (e: { studentEmail: string; courseCode: string }) =>
    http<Enrollment>("/enrollments", {
      method: "POST",
      body: JSON.stringify(e),
    }),
  update: (id: number, patch: Partial<{ studentEmail: string; courseCode: string }>) =>
    http<Enrollment>(`/enrollments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  remove: (id: number) =>
    fetch(`${BASE_URL}/enrollments/${id}`, {
      method: "DELETE",
    }).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    }),
};
