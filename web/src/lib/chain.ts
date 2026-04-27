import {
  fetchGalleries,
  fetchGalleryDetail,
  fetchFramePayload,
  type GalleryNote,
} from "./queries";

export type ChainGallery = {
  galleryId: number;
  owner: string;
  title: string | null;
  description: string | null;
  createdAt: number;
  updatedAt: number;
};

export type ChainItem = {
  galleryId: number;
  itemKey: string;
  kind: number;
  packedRefHex: string;
  addedAt: number;
  removedAt: number;
  displayOrder: number | null;
  label: string | null;
  note: string | null;
  tokenUri?: string | null;
  metadataJson?: unknown | null;
  imageUrl?: string | null;
  name?: string | null;
  description?: string | null;
};

export type ChainReader = {
  listGalleries(): Promise<ChainGallery[]>;
  getGallery(galleryId: number): Promise<ChainGallery | null>;
  getGalleryItems(galleryId: number): Promise<ChainItem[]>;
  getFramePayload(galleryId: number): Promise<{
    gallery: ChainGallery | null;
    items: ChainItem[];
    galleryNote?: GalleryNote;
    itemNotes: GalleryNote[];
  }>;
};

// Mock-first reader that uses the DB cache (projected from events).
export const reader: ChainReader = {
  async listGalleries() {
    const galleries = await fetchGalleries();
    return galleries.map((g) => ({
      galleryId: g.galleryId,
      owner: g.owner,
      title: g.title ?? null,
      description: g.description ?? null,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    }));
  },
  async getGallery(galleryId) {
    const detail = await fetchGalleryDetail(galleryId);
    if (!detail.gallery) return null;
    return {
      galleryId: detail.gallery.galleryId,
      owner: detail.gallery.owner,
      title: detail.gallery.title ?? null,
      description: detail.gallery.description ?? null,
      createdAt: detail.gallery.createdAt,
      updatedAt: detail.gallery.updatedAt,
    };
  },
  async getGalleryItems(galleryId) {
    const detail = await fetchGalleryDetail(galleryId);
    return detail.items.map((item) => ({
      galleryId: item.galleryId,
      itemKey: item.itemKey,
      kind: item.kind,
      packedRefHex: item.packedRefHex,
      addedAt: item.addedAt,
      removedAt: item.removedAt ?? 0,
      displayOrder: item.displayOrder ?? null,
      label: item.label ?? null,
      note: item.note ?? null,
      tokenUri: item.tokenUri ?? null,
      metadataJson: item.metadataJson ?? null,
      imageUrl: item.imageUrl ?? null,
      name: item.name ?? null,
      description: item.description ?? null,
    }));
  },
  async getFramePayload(galleryId) {
    const payload = await fetchFramePayload(galleryId);
    if (!payload.gallery) {
      return { gallery: null, items: [], itemNotes: [] };
    }
    const gallery: ChainGallery = {
      galleryId: payload.gallery.galleryId,
      owner: payload.gallery.owner,
      title: payload.gallery.title ?? null,
      description: payload.gallery.description ?? null,
      createdAt: payload.gallery.createdAt,
      updatedAt: payload.gallery.updatedAt,
    };
    const items = payload.items.map((item) => ({
      galleryId: item.galleryId,
      itemKey: item.itemKey,
      kind: item.kind,
      packedRefHex: item.packedRefHex,
      addedAt: item.addedAt,
      removedAt: item.removedAt ?? 0,
      displayOrder: item.displayOrder ?? null,
      label: item.label ?? null,
      note: item.note ?? null,
      tokenUri: item.tokenUri ?? null,
      metadataJson: item.metadataJson ?? null,
      imageUrl: item.imageUrl ?? null,
      name: item.name ?? null,
      description: item.description ?? null,
    }));
    return {
      gallery,
      items,
      galleryNote: payload.galleryNote,
      itemNotes: payload.itemNotes,
    };
  },
};
