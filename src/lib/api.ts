const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export type Student = {
  email: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  course?: string | null;
  createdAt?: string;
};

export const studentsApi = {
  list: () => http<Student[]>("/students"),
  create: (s: Student) => http<Student>("/students", { method: "POST", body: JSON.stringify(s) }),
  update: (email: string, patch: Partial<Student>) =>
    http<Student>(`/students/${encodeURIComponent(email)}`, { method: "PATCH", body: JSON.stringify(patch) }),
  remove: (email: string) =>
    fetch(`${BASE_URL}/students/${encodeURIComponent(email)}`, { method: "DELETE" }).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    }),
};
