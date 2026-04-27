"use client";

import { useState } from "react";

export function SummaryToggle({
  summary,
  full,
}: {
  summary: string;
  full: string;
}) {
  const [showFull, setShowFull] = useState(false);
  const text = showFull ? full : summary;

  return (
    <button
      type="button"
      onClick={() => setShowFull((prev) => !prev)}
      title={full}
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        margin: 0,
        color: "inherit",
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      {text}
    </button>
  );
}
