import { ChainEvent, GalleryEvent } from "../types";

export interface Source {
  getNextEvents(afterId: number, limit: number): Promise<Array<GalleryEvent | ChainEvent>>;
}
