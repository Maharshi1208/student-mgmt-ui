import { Link, NavLink, Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import { Toaster } from "@/components/ui/sonner";

export default function AppLayout() {
  const navLink =
    "px-3 py-2 rounded-md text-sm font-medium hover:bg-muted aria-[current=page]:bg-muted";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <Link to="/" className="font-semibold">Student Mgmt</Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={navLink}>Dashboard</NavLink>
            <NavLink to="/students" className={navLink}>Students</NavLink>
            <NavLink to="/courses" className={navLink}>Courses</NavLink>
            <NavLink to="/enrollments" className={navLink}>Enrollments</NavLink>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>

      {/* Toast portal */}
      <Toaster richColors position="top-center" closeButton />
    </div>
  );
}
