import { decodePackedRef, hexToBytes } from "@onchain-gallery/shared";
import { GalleryEvent } from "../types";
import {
  removeItem,
  updateGalleryFields,
  updateItemFields,
  upsertGallery,
  upsertItem,
  upsertNote,
} from "./upserts";

type DbClient = {
  execute: (sql: string, params?: unknown[]) => Promise<[unknown, unknown?]>;
};

export async function applyEvent(pool: DbClient, event: GalleryEvent) {
  switch (event.type) {
    case "GalleryCreated":
      await upsertGallery(pool, event.galleryId, event.owner, event.createdAt);
      return;
    case "GalleryFieldsUpdated":
      await updateGalleryFields(
        pool,
        event.galleryId,
        event.title,
        event.description,
        event.updatedAt
      );
      return;
    case "ItemAdded": {
      const packedRef = Buffer.from(hexToBytes(event.packedRefHex));
      const decoded = decodePackedRef(packedRef);
      const kind = decoded.kind === "evm" ? 0 : 1;
      await upsertItem(
        pool,
        event.galleryId,
        event.itemKey,
        kind,
        packedRef,
        event.addedAt
      );
      return;
    }
    case "ItemFieldsUpdated":
      await updateItemFields(
        pool,
        event.galleryId,
        event.itemKey,
        event.displayOrder,
        event.label,
        event.note
      );
      return;
    case "ItemRemoved":
      await removeItem(pool, event.galleryId, event.itemKey, event.removedAt);
      return;
    case "NoteUpdated":
      await upsertNote(
        pool,
        event.galleryId,
        event.scope,
        event.targetKey,
        event.noteText
      );
      return;
    default:
      throw new Error(`Unknown event type: ${(event as GalleryEvent).type}`);
  }
}
