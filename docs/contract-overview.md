# GalleryNFT Contract Overview

This is a top-level view of the planned `GalleryNFT` contract.

## What It Is

`GalleryNFT` is an `ERC-721` contract where:

1. One token equals one gallery.
2. The token owner (or approved operator) controls gallery edits.
3. Canonical gallery state lives on-chain.

## Standard ERC-721 Surface

`GalleryNFT` keeps normal ERC-721 behavior, including:

1. Ownership and transfer (`ownerOf`, `transferFrom`, `safeTransferFrom`)
2. Approvals (`approve`, `setApprovalForAll`, `getApproved`, `isApprovedForAll`)
3. Metadata identity (`name`, `symbol`, optional `tokenURI` for marketplace compatibility)

Note:
Gallery curation data is not intended to depend on `tokenURI`. Curation state is stored in contract fields and emitted events.

## GalleryNFT Additions

The contract adds gallery-specific write operations:

1. `createGallery(title, description)`
2. `setGalleryFields(galleryId, title, description)`
3. `addItem(galleryId, packedRef, displayOrder, label, note)`
4. `updateItemFields(galleryId, itemKey, displayOrder, label, note)`
5. `removeItem(galleryId, itemKey)`

And gallery-specific reads:

1. `getGallery(...)` / `getGalleryFields(...)`
2. `getGalleryItems(...)`
3. `getItem(...)` / `getItemFields(...)`
4. `getItemPackedRef(...)` / `getItemStatus(...)`

## Data Model (On-Chain)

Gallery fields:

1. `title`
2. `description`
3. `createdAt`
4. `updatedAt`

Item fields:

1. `packedRef`
2. `itemKey = keccak256(packedRef)`
3. `addedAt`
4. `removedAt`
5. `displayOrder`
6. `label`
7. `note`

`packedRef` supports cross-chain references (EVM + Tezos) using the shared encoding spec.

## Event-Driven Projection

Indexer/database is a cache, not source of truth.

Core events:

1. `GalleryCreated`
2. `GalleryFieldsUpdated`
3. `ItemAdded`
4. `ItemFieldsUpdated`
5. `ItemRemoved`

The UI can rebuild state by replaying events and optionally verifying with read calls.

## Related Doc

Detailed signatures are listed in:
`docs/contract-methods.md`
