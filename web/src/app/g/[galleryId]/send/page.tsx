import Link from "next/link";

const targets = [
  {
    title: "Home displays",
    description: "Cast to local digital frames and smart TVs.",
    options: ["Living room frame", "Kitchen display", "Studio wall", "Patio screen"],
  },
  {
    title: "Gallery venues",
    description: "Queue for partner venues with certified displays.",
    options: ["Soho Pop-Up", "Berlin Lightbox", "Tokyo Media Lab"],
  },
  {
    title: "Virtual worlds",
    description: "Generate a world from a prompt and place the art inside.",
    options: ["Neon loft", "Desert pavilion", "Sky museum"],
  },
  {
    title: "AI research agent",
    description: "Autogenerate context and citations for each work.",
    options: ["Provenance scan", "Artist bio", "Curatorial statement"],
  },
  {
    title: "Personal surfaces",
    description: "Push to phone lock screen, desktop, or wearable.",
    options: ["iPhone lock screen", "Mac wallpaper", "Apple Watch face"],
  },
];

const extraIdeas = [
  "AR room preview",
  "Timed exhibition playlist",
  "Social teaser reel",
  "Collector PDF catalog",
  "Public QR placard",
  "Ambient audio pairing",
];

export default function GallerySendPage({
  params,
}: {
  params: { galleryId: string };
}) {
  const galleryId = Number(params.galleryId);

  return (
    <main style={{ display: "grid", gap: "16px" }}>
      <Link href={`/g/${galleryId}`} style={{ fontSize: "12px" }}>
        Back to gallery
      </Link>

      <div
        style={{
          display: "grid",
          gap: "8px",
          padding: "12px",
          border: "1px solid var(--border)",
          borderRadius: "10px",
          background: "var(--panel)",
        }}
      >
        <div style={{ fontWeight: 600, fontSize: "16px" }}>
          Send Gallery #{galleryId}
        </div>
        <div style={{ fontSize: "12px", color: "var(--muted)" }}>
          Control center for multi-channel delivery of this gallery.
        </div>
      </div>

      <div className="send-grid">
        <section style={{ display: "grid", gap: "12px" }}>
          {targets.map((target) => (
            <div
              key={target.title}
              style={{
                border: "1px solid var(--border)",
                borderRadius: "10px",
                background: "var(--panel)",
                padding: "12px",
                display: "grid",
                gap: "10px",
              }}
            >
              <div style={{ display: "grid", gap: "4px" }}>
                <div style={{ fontWeight: 600 }}>{target.title}</div>
                <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                  {target.description}
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {target.options.map((option) => (
                  <label
                    key={option}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 8px",
                      borderRadius: "999px",
                      border: "1px solid var(--border)",
                      background: "var(--panel-2)",
                      fontSize: "12px",
                    }}
                  >
                    <input type="checkbox" />
                    {option}
                  </label>
                ))}
              </div>
              {target.title === "Virtual worlds" ? (
                <div style={{ display: "grid", gap: "8px" }}>
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>Presets</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {target.options.map((option) => (
                      <label
                        key={`${option}-preset`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 8px",
                          borderRadius: "8px",
                          border: "1px solid var(--border)",
                          background: "var(--panel-2)",
                          fontSize: "12px",
                        }}
                      >
                        <input type="radio" name="virtualWorldPreset" />
                        {option}
                      </label>
                    ))}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                    Prompt a new world
                  </div>
                  <textarea
                    placeholder="e.g. brutalist sky gallery with floating frames"
                    rows={2}
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: "var(--panel-2)",
                      fontSize: "12px",
                    }}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </section>

        <aside style={{ display: "grid", gap: "12px" }}>
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: "10px",
              background: "var(--panel)",
              padding: "12px",
              display: "grid",
              gap: "10px",
            }}
          >
            <div style={{ fontWeight: 600 }}>Dispatch settings</div>
            <label style={{ display: "grid", gap: "6px", fontSize: "12px" }}>
              Quality
              <select
                defaultValue="ultra"
                style={{
                  padding: "8px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "var(--panel-2)",
                }}
              >
                <option value="preview">Preview</option>
                <option value="balanced">Balanced</option>
                <option value="ultra">Ultra</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: "6px", fontSize: "12px" }}>
              Start time
              <input
                type="datetime-local"
                style={{
                  padding: "8px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "var(--panel-2)",
                }}
              />
            </label>
            <label style={{ display: "grid", gap: "6px", fontSize: "12px" }}>
              Rotation
              <select
                defaultValue="30"
                style={{
                  padding: "8px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "var(--panel-2)",
                }}
              >
                <option value="15">15s per work</option>
                <option value="30">30s per work</option>
                <option value="60">60s per work</option>
              </select>
            </label>
            <button
              type="button"
              style={{
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--text)",
                color: "var(--bg)",
              }}
            >
              Queue delivery
            </button>
          </div>

          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: "10px",
              background: "var(--panel)",
              padding: "12px",
              display: "grid",
              gap: "8px",
            }}
          >
            <div style={{ fontWeight: 600 }}>More options</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {extraIdeas.map((idea) => (
                <span
                  key={idea}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "8px",
                    background: "var(--panel-2)",
                    border: "1px solid var(--border)",
                    fontSize: "11px",
                    lineHeight: 1.2,
                  }}
                >
                  {idea}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
