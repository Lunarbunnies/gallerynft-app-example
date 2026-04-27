export type GalleryCreatedEvent = {
  type: "GalleryCreated";
  id: number;
  galleryId: number;
  owner: string;
  createdAt: number;
};

export type GalleryFieldsUpdatedEvent = {
  type: "GalleryFieldsUpdated";
  id: number;
  galleryId: number;
  title: string;
  description: string;
  updatedAt: number;
};

export type ItemAddedEvent = {
  type: "ItemAdded";
  id: number;
  galleryId: number;
  packedRefHex: string;
  itemKey: string;
  addedAt: number;
};

export type ItemFieldsUpdatedEvent = {
  type: "ItemFieldsUpdated";
  id: number;
  galleryId: number;
  itemKey: string;
  displayOrder: number | null;
  label: string;
  note: string;
};

export type ItemRemovedEvent = {
  type: "ItemRemoved";
  id: number;
  galleryId: number;
  itemKey: string;
  removedAt: number;
};

export type NoteUpdatedEvent = {
  type: "NoteUpdated";
  id: number;
  galleryId: number;
  scope: number;
  targetKey: string;
  noteText: string;
};

export type GalleryEvent =
  | GalleryCreatedEvent
  | GalleryFieldsUpdatedEvent
  | ItemAddedEvent
  | ItemFieldsUpdatedEvent
  | ItemRemovedEvent
  | NoteUpdatedEvent;
