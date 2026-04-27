"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof document === "undefined") return "light";
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "dark" || current === "light") return current;
    const stored = window.localStorage.getItem("gallery-theme");
    if (stored === "dark" || stored === "light") return stored;
    return "light";
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("gallery-theme", theme);
  }, [theme]);

  function toggle() {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      style={{
        position: "fixed",
        right: "16px",
        top: "16px",
        zIndex: 100,
        padding: "6px 10px",
        borderRadius: "6px",
        border: "1px solid var(--border)",
        background: "var(--panel)",
        color: "var(--text)",
      }}
    >
      <span suppressHydrationWarning>
        {mounted ? (theme === "dark" ? "Light" : "Dark") : "Theme"}
      </span>
    </button>
  );
}
