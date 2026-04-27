import fs from "fs";
import path from "path";

export type MockEvent = {
  type: string;
  id?: number;
  [key: string]: unknown;
};

function resolveMockPath() {
  const configured = process.env.MOCK_EVENTS_PATH || "mock/events.json";
  const base = path.join(process.cwd(), "..");
  return path.isAbsolute(configured) ? configured : path.join(base, configured);
}

export function appendMockEvents(events: MockEvent[]) {
  const filePath = resolveMockPath();
  const existing = fs.existsSync(filePath)
    ? (JSON.parse(fs.readFileSync(filePath, "utf8")) as MockEvent[])
    : [];

  const maxId = existing.reduce(
    (acc, event) => (event.id && event.id > acc ? event.id : acc),
    0
  );

  let nextId = maxId + 1;
  const withIds = events.map((event) => ({
    ...event,
    id: event.id ?? nextId++,
  }));

  const updated = existing.concat(withIds).sort((a, b) => (a.id || 0) - (b.id || 0));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));

  return withIds;
}

export function getNextGalleryId() {
  const filePath = resolveMockPath();
  if (!fs.existsSync(filePath)) {
    return 1;
  }
  const existing = JSON.parse(fs.readFileSync(filePath, "utf8")) as MockEvent[];
  let maxId = 0;
  for (const event of existing) {
    if (event.type === "GalleryCreated" && typeof event.galleryId === "number") {
      if (event.galleryId > maxId) {
        maxId = event.galleryId;
      }
    }
  }
  return maxId + 1;
}
