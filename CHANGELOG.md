# Changelog

All notable changes to this project will be documented in this file.

This app is an example client for the `gallerynft-protocol` contract. It is not the canonical protocol implementation.

## Unreleased

### Added

- Added wallet-first gallery draft workflow on the home page.
- Added browser `localStorage` gallery drafts so users can build galleries before minting.
- Added EVM wallet connection using `ethers`.
- Added UI support for deploying wallet-owned GalleryNFT collection contracts via `GalleryNFTFactory`.
- Added local collection contract list stored in browser `localStorage`.
- Added manual existing collection contract entry.
- Added chain-event indexer mode for `GalleryNFTFactory` and `GalleryNFT` events.
- Added rebuildable `indexed_*` cache tables for collection, gallery, and item dashboard data.
- Added indexed dashboard API routes.
- Added server-side verifier worker for factory-created `GalleryNFT` collection contracts.
- Added collection verification status fields to the indexed cache.
- Added on-chain gallery minting against a configured `GalleryNFT` contract.
- Added on-chain item writes using `GalleryNFT.addItem`.
- Added browser-safe EVM packed reference encoding and item key derivation.
- Added OpenSea URL parsing helper for autofilling chain, contract, and token ID.
- Added optional factory mode using `NEXT_PUBLIC_GALLERYNFT_FACTORY_ADDRESS`.
- Added optional single-collection mode using `NEXT_PUBLIC_GALLERYNFT_ADDRESS` and `NEXT_PUBLIC_GALLERYNFT_CHAIN_ID`.
- Added legacy SQLite/MySQL support for the earlier mock/indexer prototype.
- Added gallery editor, frame view, send-gallery view, embed view, token metadata refresh, and media rendering experiments during prototype work.
- Added `GalleryNFT` v1.1 ABI support for ERC-4906 marketplace refresh signalling and extra-data schema writes.
- Added editor controls for v1.1 item wall-text and display-preference schema data.
- Added explicit "Ask marketplaces to refresh" action instead of emitting metadata refresh signals on every edit.
- Added chain indexer support for multiple GalleryNFT factories via `INDEXER_FACTORY_ADDRESSES`.
- Added UI labels for configured factory version and detected collection `contractVersion()`.
- Added optimistic post-mint dashboard entries with "waiting for indexer" status.
- Added direct contract-read fallback for freshly minted galleries before the indexed cache catches up.
- Added Sepolia/Etherscan transaction links for newly minted galleries.
- Added browser-local hide/show controls for accidental duplicate gallery tokens.
- Added `npm run index:reset` to rebuild only the chain index cache/checkpoint.

### Changed

- Changed the default `npm run dev` command to run the web app only.
- Added `npm run dev:legacy` for the old web + indexer mock mode.
- Changed the README to describe the localStorage pre-mint workflow as the primary app path.
- Kept the database/indexer/mock event system as legacy/reference code rather than the primary runtime.
- Updated app Node version to match the protocol repo.
- Updated app checks so the Next.js web build is included in `npm run check`.

### Fixed

- Fixed browser/Next import and typing issues around wallet usage.
- Fixed build compatibility issues after moving the primary flow away from DB-backed gallery listing.
- Fixed native dependency rebuild guidance for Node version changes.
- Fixed indexer RPC errors crashing the worker; transient source errors now retry after `INDEXER_POLL_MS`.
- Fixed confusing post-mint UX where confirmed on-chain galleries could disappear until the indexer caught up.

### Notes

- The primary app flow no longer needs MySQL, SQLite, mock events, or the indexer.
- Browser drafts are not canonical; they are only temporary pre-mint state.
- Canonical gallery state should be written to and read from `GalleryNFT`.
- Legacy DB-backed routes still exist and need either removal or replacement with contract reads before a production cut.
- v1.1 extra-data schema reads/display are intentionally minimal in this app example; the protocol remains the canonical source.
