# GalleryNFT Contract Methods

This document lists the intended on-chain interface for the GalleryNFT ERC-721 contract.
It reflects the current mock-first data model and event schema used by the app/indexer.

High-level summary:
`docs/contract-overview.md`

## Write Functions

1. `createGallery(title, description)`
   - Emits: `GalleryCreated`

2. `setGalleryFields(galleryId, title, description)`
   - Emits: `GalleryFieldsUpdated`

3. `addItem(galleryId, packedRef, displayOrder, label, note)`
   - Emits: `ItemAdded` + `ItemFieldsUpdated`

4. `updateItemFields(galleryId, itemKey, displayOrder, label, note)`
   - Emits: `ItemFieldsUpdated`

5. `removeItem(galleryId, itemKey)`
   - Emits: `ItemRemoved`

## Events

1. `GalleryCreated(galleryId, owner)`
2. `GalleryFieldsUpdated(galleryId, title, description)`
3. `ItemAdded(galleryId, itemKey, packedRef)`
4. `ItemFieldsUpdated(galleryId, itemKey, displayOrder, label, note)`
5. `ItemRemoved(galleryId, itemKey)`

## Read Functions

### Gallery-level

1. `ownerOf(galleryId) -> address`
2. `getGallery(galleryId) -> (title, description, createdAt, updatedAt, owner)`
3. `getGalleryFields(galleryId) -> (title, description, createdAt, updatedAt)`
4. `getGalleryItems(galleryId) -> itemKey[]` (active only, ordered by displayOrder or addedAt)

### Item-level

5. `getItem(galleryId, itemKey) -> (packedRef, addedAt, removedAt, displayOrder, label, note)`
6. `getItemFields(galleryId, itemKey) -> (displayOrder, label, note)`
7. `getItemPackedRef(galleryId, itemKey) -> packedRef`
8. `getItemStatus(galleryId, itemKey) -> (addedAt, removedAt, isActive)`

### Batch helpers (optional but useful)

9. `getItems(galleryId, itemKeys[]) -> Item[]`
10. `getItemFieldsBatch(galleryId, itemKeys[]) -> (displayOrder[], label[], note[])`
