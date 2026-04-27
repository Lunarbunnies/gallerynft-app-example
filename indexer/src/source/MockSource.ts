import fs from "fs";
import path from "path";
import { GalleryEvent } from "../types";
import { Source } from "./Source";

export class MockSource implements Source {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = path.resolve(filePath);
  }

  async getNextEvents(afterId: number, limit: number): Promise<GalleryEvent[]> {
    const data = fs.readFileSync(this.filePath, "utf8");
    const events = JSON.parse(data) as GalleryEvent[];
    events.sort((a, b) => a.id - b.id);
    const next = events.filter((event) => event.id > afterId);
    return next.slice(0, limit);
  }
}
