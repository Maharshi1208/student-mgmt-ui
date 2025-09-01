import { ReactNode } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import { NavLink, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

export default function AppLayout({ children }: Props) {
  const { pathname } = useLocation();

  const titleMap: Record<string, string> = {
    "/": "Dashboard",
    "/students": "Students",
    "/courses": "Courses",
    "/enrollments": "Enrollments",
  };
  const title = titleMap[pathname] ?? "Dashboard";

  const LinkBtn = ({ to, label }: { to: string; label: string }) => (
    <Button
      asChild
      variant={pathname === to ? "secondary" : "ghost"}
      className="w-full justify-start"
    >
      <NavLink to={to}>{label}</NavLink>
    </Button>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card p-4 hidden md:block">
        <h2 className="text-xl font-bold mb-6">StudentMgmt</h2>
        <nav className="space-y-2">
          <LinkBtn to="/" label="Dashboard" />
          <LinkBtn to="/students" label="Students" />
          <LinkBtn to="/courses" label="Courses" />
          <LinkBtn to="/enrollments" label="Enrollments" />
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 p-6">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <ThemeToggle />
        </header>
        {children}
      </main>
    </div>
  );
}

