import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";

type Mode = "light" | "dark";

function getInitialMode(): Mode {
  const saved = (typeof localStorage !== "undefined" && localStorage.getItem("theme")) as Mode | null;
  if (saved === "light" || saved === "dark") return saved;
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

function applyMode(mode: Mode) {
  const root = document.documentElement;
  if (mode === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  localStorage.setItem("theme", mode);
}

export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode>(getInitialMode);

  useEffect(() => {
    applyMode(mode);
  }, [mode]);

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setMode((m) => (m === "dark" ? "light" : "dark"))}
      className="relative"
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
}
