"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GalleryNote } from "../lib/queries";
import { SummaryToggle } from "./SummaryToggle";

function resolveMediaUrl(url: string | null | undefined) {
  if (!url || typeof url !== "string") return null;
  if (url.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${url.replace("ipfs://", "")}`;
  }
  if (url.startsWith("ar://")) {
    return `https://arweave.net/${url.replace("ar://", "")}`;
  }
  return url;
}

function isVideoUrl(url: string | null | undefined) {
  if (!url) return false;
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);
}

export function FrameViewer({
  items,
  galleryNote,
  itemNotes,
  intervalSeconds,
}: {
  items: Array<{
    itemKey: string;
    packedRefHex: string;
    summary: string;
    fullSummary?: string;
    imageUrl?: string | null;
    name?: string | null;
    description?: string | null;
    label?: string | null;
    note?: string | null;
    metadataJson?: unknown | null;
  }>;
  galleryNote?: GalleryNote;
  itemNotes?: GalleryNote[];
  intervalSeconds: number;
}) {
  const [index, setIndex] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [playVideosToEnd, setPlayVideosToEnd] = useState(true);
  const [localInterval, setLocalInterval] = useState(intervalSeconds);
  const fullscreenRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (items.length === 0) return;
      if (event.key === "ArrowRight") {
        setIndex((prev) => (prev + 1) % items.length);
      } else if (event.key === "ArrowLeft") {
        setIndex((prev) => (prev - 1 + items.length) % items.length);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [items.length]);

  useEffect(() => {
    function handleFsChange() {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      if (active) setShowOverlay(true);
      setControlsVisible(true);
    }
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  useEffect(() => {
    if (!isFullscreen) {
      setControlsVisible(true);
      return;
    }

    let timeout: NodeJS.Timeout | null = null;
    const show = () => {
      setControlsVisible(true);
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => setControlsVisible(false), 2000);
    };

    const handler = () => show();
    window.addEventListener("mousemove", handler);
    window.addEventListener("touchstart", handler);
    show();

    return () => {
      window.removeEventListener("mousemove", handler);
      window.removeEventListener("touchstart", handler);
      if (timeout) clearTimeout(timeout);
    };
  }, [isFullscreen]);

  const current = items[index];
  const animationUrl = useMemo(() => {
    if (!current?.metadataJson) return null;
    const raw =
      (current.metadataJson as any)?.animation_url ||
      (current.metadataJson as any)?.animationUrl ||
      null;
    return resolveMediaUrl(raw);
  }, [current]);
  const imageUrl = useMemo(() => resolveMediaUrl(current?.imageUrl), [current]);
  const imageIsVideo = useMemo(() => isVideoUrl(imageUrl), [imageUrl]);
  const isVideo = useMemo(() => {
    if (!animationUrl) return false;
    const format = (current?.metadataJson as any)?.animation_details?.format?.toLowerCase?.();
    if (format === "html") return false;
    if (format === "mp4" || format === "video") return true;
    if (/\.(html)(\?|#|$)/i.test(animationUrl)) return false;
    if (/\.(mp4|webm|mov)(\?|#|$)/i.test(animationUrl)) return true;
    return true;
  }, [animationUrl, current]);
  const isHtml = useMemo(() => {
    if (!animationUrl) return false;
    const format = (current?.metadataJson as any)?.animation_details?.format?.toLowerCase?.();
    if (format === "html") return true;
    return /\.(html)(\?|#|$)/i.test(animationUrl);
  }, [animationUrl, current]);
  useEffect(() => {
    if (items.length === 0) return;
    if (playVideosToEnd && isVideo) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % items.length);
    }, localInterval * 1000);
    return () => clearInterval(timer);
  }, [items.length, localInterval, playVideosToEnd, isVideo]);
  const note = useMemo(() => {
    if (!current) return undefined;
    return (itemNotes || []).find((n) => n.targetKey === current.itemKey);
  }, [current, itemNotes]);

  if (!current) {
    return <div>No items.</div>;
  }

  return (
    <div
      ref={fullscreenRef}
      style={{
        position: "relative",
        cursor: isFullscreen && !controlsVisible ? "none" : "auto",
      }}
    >
      <div
        style={{
          position: isFullscreen ? "fixed" : "relative",
          top: isFullscreen ? "16px" : "auto",
          left: isFullscreen ? "16px" : "auto",
          right: isFullscreen ? "16px" : "auto",
          zIndex: 10,
          display: "flex",
          gap: "10px",
          marginBottom: isFullscreen ? "0" : "10px",
          opacity: controlsVisible ? 1 : 0,
          transition: "opacity 250ms ease",
          pointerEvents: controlsVisible ? "auto" : "none",
        }}
      >
        <button
          type="button"
          onClick={async () => {
            if (!document.fullscreenElement && fullscreenRef.current) {
              await fullscreenRef.current.requestFullscreen();
            } else {
              await document.exitFullscreen();
            }
          }}
          style={{
            padding: "6px 10px",
            borderRadius: "6px",
            border: "1px solid var(--border)",
            background: "var(--panel)",
            color: "var(--text)",
          }}
        >
          {isFullscreen ? "Exit full screen" : "Full screen artwork"}
        </button>
        <button
          type="button"
          onClick={() => setShowOverlay((prev) => !prev)}
          style={{
            padding: "6px 10px",
            borderRadius: "6px",
            border: "1px solid var(--border)",
            background: "var(--panel)",
            color: "var(--text)",
          }}
        >
          {showOverlay ? "Hide info" : "Show info"}
        </button>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            padding: "4px 8px",
          }}
        >
          Interval
          <select
            value={localInterval}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (Number.isFinite(next)) setLocalInterval(next);
            }}
            style={{
              background: "transparent",
              color: "inherit",
              border: "none",
              fontSize: "12px",
            }}
          >
            <option value={10}>10s</option>
            <option value={20}>20s</option>
            <option value={30}>30s</option>
            <option value={45}>45s</option>
            <option value={60}>60s</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => setPlayVideosToEnd((prev) => !prev)}
          style={{
            padding: "6px 10px",
            borderRadius: "6px",
            border: "1px solid var(--border)",
            background: playVideosToEnd ? "var(--text)" : "var(--panel)",
            color: playVideosToEnd ? "var(--bg)" : "var(--text)",
          }}
        >
          {playVideosToEnd ? "Play videos fully" : "Timed videos"}
        </button>
      </div>
      <div
        style={{
          display: "grid",
          gap: "16px",
          minHeight: "70vh",
          alignContent: "start",
        }}
      >
        {!isFullscreen ? (
          <>
            <div style={{ fontSize: "24px", fontWeight: 600 }}>Frame View</div>
            <div style={{ fontSize: "18px" }}>{current.summary}</div>
            {current.label ? <div style={{ fontWeight: 600 }}>{current.label}</div> : null}
            {current.name ? <div style={{ fontWeight: 600 }}>{current.name}</div> : null}
          </>
        ) : null}
        {isHtml && animationUrl ? (
          <div
            className="artwork-frame"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#000",
              padding: isFullscreen ? "0" : "6px",
              borderRadius: isFullscreen ? "0" : "12px",
              width: isFullscreen ? "100vw" : "auto",
              height: isFullscreen ? "100vh" : "auto",
            }}
          >
            <iframe
              src={animationUrl}
              title={current.name || current.label || "Interactive NFT"}
              sandbox="allow-scripts"
              style={{
                width: isFullscreen ? "100vw" : "min(86vw, 980px)",
                height: isFullscreen ? "100vh" : "80vh",
                border: "none",
                borderRadius: isFullscreen ? "0" : "10px",
                background: "#000",
              }}
            />
          </div>
        ) : isVideo && animationUrl ? (
          <div
            className="artwork-frame"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#000",
              padding: isFullscreen ? "0" : "6px",
              borderRadius: isFullscreen ? "0" : "12px",
              width: isFullscreen ? "100vw" : "auto",
              height: isFullscreen ? "100vh" : "auto",
            }}
          >
            <video
              src={animationUrl}
              autoPlay
              loop={!playVideosToEnd}
              muted
              playsInline
              controls={!isFullscreen}
              onEnded={() => {
                if (!playVideosToEnd) return;
                setIndex((prev) => (prev + 1) % items.length);
              }}
              style={{
                width: isFullscreen ? "100vw" : "min(86vw, 980px)",
                height: isFullscreen ? "100vh" : "auto",
                maxHeight: isFullscreen ? "100vh" : "80vh",
                borderRadius: isFullscreen ? "0" : "10px",
                objectFit: "contain",
                background: "#000",
              }}
            />
          </div>
        ) : imageIsVideo && imageUrl ? (
          <div
            className="artwork-frame"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#000",
              padding: isFullscreen ? "0" : "6px",
              borderRadius: isFullscreen ? "0" : "12px",
              width: isFullscreen ? "100vw" : "auto",
              height: isFullscreen ? "100vh" : "auto",
            }}
          >
            <video
              src={imageUrl}
              autoPlay
              loop={!playVideosToEnd}
              muted
              playsInline
              controls={!isFullscreen}
              onEnded={() => {
                if (!playVideosToEnd) return;
                setIndex((prev) => (prev + 1) % items.length);
              }}
              style={{
                width: isFullscreen ? "100vw" : "min(86vw, 980px)",
                height: isFullscreen ? "100vh" : "auto",
                maxHeight: isFullscreen ? "100vh" : "80vh",
                borderRadius: isFullscreen ? "0" : "10px",
                objectFit: "contain",
                background: "#000",
              }}
            />
          </div>
        ) : imageUrl ? (
          <div
            className="artwork-frame"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#000",
              padding: isFullscreen ? "0" : "6px",
              borderRadius: isFullscreen ? "0" : "12px",
              width: isFullscreen ? "100vw" : "auto",
              height: isFullscreen ? "100vh" : "auto",
            }}
          >
            <img
              src={imageUrl}
              alt={current.name || "NFT"}
              style={{
                width: isFullscreen ? "100vw" : "min(86vw, 980px)",
                height: isFullscreen ? "100vh" : "auto",
                maxHeight: isFullscreen ? "100vh" : "80vh",
                borderRadius: isFullscreen ? "0" : "10px",
                objectFit: "contain",
              }}
            />
          </div>
        ) : null}
        {!isFullscreen ? (
          <>
            {current.description ? <div>{current.description}</div> : null}
            {current.note ? <div>{current.note}</div> : null}
            <div style={{ fontSize: "12px", color: "#666" }}>{current.itemKey}</div>
            {note ? <div>Item note: {note.noteText}</div> : null}
            {galleryNote ? <div>Gallery note: {galleryNote.noteText}</div> : null}
            <div style={{ fontSize: "12px", color: "#999" }}>
              {index + 1} / {items.length}
            </div>
          </>
        ) : null}
      </div>
      {showOverlay ? (
        <div
          style={{
            position: "fixed",
            right: "16px",
            bottom: "16px",
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
            padding: "10px 12px",
            borderRadius: "8px",
            maxWidth: "320px",
          }}
        >
          <div style={{ fontWeight: 600 }}>{current.label || current.name || "Item"}</div>
          <div style={{ fontSize: "12px", opacity: 0.85 }}>
            <SummaryToggle
              summary={current.summary}
              full={current.fullSummary || current.summary}
            />
          </div>
          {(() => {
            const meta = current.metadataJson as any;
            const artist =
              meta?.artist ||
              meta?.creator ||
              meta?.created_by ||
              meta?.attributes?.find?.(
                (attr: any) => attr?.trait_type?.toLowerCase?.() === "artist"
              )?.value;
            return artist ? (
              <div style={{ fontSize: "12px", opacity: 0.85 }}>Artist: {artist}</div>
            ) : null;
          })()}
          {current.name && current.label ? (
            <div style={{ fontSize: "12px", opacity: 0.85 }}>Artwork: {current.name}</div>
          ) : null}
          {current.description ? (
            <div style={{ fontSize: "12px", opacity: 0.85 }}>{current.description}</div>
          ) : null}
          {current.note ? (
            <div style={{ fontSize: "12px", opacity: 0.85 }}>
              Curator note: {current.note}
            </div>
          ) : null}
          {galleryNote ? (
            <div style={{ fontSize: "12px", opacity: 0.85 }}>
              Gallery note: {galleryNote.noteText}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
