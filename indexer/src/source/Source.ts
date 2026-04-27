import { GalleryEvent } from "../types";

export interface Source {
  getNextEvents(afterId: number, limit: number): Promise<GalleryEvent[]>;
}
