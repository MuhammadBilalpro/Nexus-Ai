"use client";

import { useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark" | "system";
const OPTIONS: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "system", icon: Monitor, label: "System" },
  { value: "dark", icon: Moon, label: "Dark" },
];

function apply(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

export function ThemeToggle({ className }: { className?: string }) {
  // Lazy initialiser runs on the client only; the menu that contains this
  // control mounts after hydration, so reading storage here is safe.
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    try {
      const saved = localStorage.getItem("nexus-theme") as Theme | null;
      if (saved === "light" || saved === "dark" || saved === "system") return saved;
    } catch {
      /* storage unavailable */
    }
    return "system";
  });

  const choose = (t: Theme) => {
    setTheme(t);
    try {
      localStorage.setItem("nexus-theme", t);
    } catch {
      /* ignore */
    }
    apply(t);
  };

  return (
    <div role="radiogroup" aria-label="Theme" className={cn("inline-flex items-center rounded-md border border-line bg-surface-2 p-0.5", className)}>
      {OPTIONS.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
          title={label}
          onClick={() => choose(value)}
          className={cn("flex h-6 w-7 items-center justify-center rounded-[5px] transition-colors", theme === value ? "bg-surface text-fg shadow-sm" : "text-fg-subtle hover:text-fg")}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </button>
      ))}
    </div>
  );
}
