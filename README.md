# GalleryNFT App Example

Reference app for creating GalleryNFT galleries with an EVM wallet.

Important: this repo is **not** the canonical protocol. It is an example client/indexer stack where the database is a cache/projection. Canonical state is intended to be on-chain in `gallerynft-protocol`.

## What Is In This Repo

- `web/` Next.js UI for local gallery drafts and wallet-based minting
- `shared/` packedRef helpers/tests
- `indexer/`, `db/`, `migrations/`, `mock/` legacy projection/reference pieces from the mock-first prototype

## Reviewer Setup

- Node: `24.12.0` (see `.nvmrc`)
- Install: `npm install`
- CI check: `npm run check`

## Primary Runtime

The current app home page does not require MySQL, SQLite, or mock events.

Recommended setup: configure a deployed `GalleryNFTFactory` contract. This lets connected wallets deploy their own GalleryNFT collection contracts from the UI.

```bash
NEXT_PUBLIC_GALLERYNFT_FACTORY_ADDRESS=0x8aD86A5479DA48387f019b11B369Dd7B2D16B7DD
NEXT_PUBLIC_GALLERYNFT_FACTORY_VERSION=1.1.0
NEXT_PUBLIC_GALLERYNFT_CHAIN_ID=11155111
NEXT_PUBLIC_GALLERYNFT_EXPLORER_BASE_URL=https://sepolia.etherscan.io
```

Optional fallback: configure a single existing GalleryNFT collection contract.

```bash
NEXT_PUBLIC_GALLERYNFT_ADDRESS=0xYourGalleryNFTCollection
NEXT_PUBLIC_GALLERYNFT_CHAIN_ID=11155111
```

If `NEXT_PUBLIC_GALLERYNFT_FACTORY_ADDRESS` or `NEXT_PUBLIC_GALLERYNFT_ADDRESS` is set, the home page lets a user:

- connect an EVM wallet
- deploy or select a GalleryNFT collection contract
- build one or more gallery drafts in browser `localStorage`
- paste OpenSea item URLs to autofill NFT references
- mint a gallery on-chain with `createGallery`
- write each item on-chain with `addItem`
- edit existing indexed galleries with `setGalleryFields`, `updateItemFields`, `addItem`, and `removeItem`
- ask marketplaces to refresh a gallery token with the explicit ERC-4906 `notifyMetadataUpdate`
- write protocol v1.1 item extra-data schemas for wall text and display preferences

Drafts are intentionally local-only until the user mints. The database is not canonical and is not used by this primary flow.

The factory contract does not currently expose its own version marker. Set `NEXT_PUBLIC_GALLERYNFT_FACTORY_VERSION` to label what that configured factory creates in the UI. Existing collection contracts are checked directly by reading `contractVersion()` where available.

## Local Dev

```bash
npm install
npm run dev
```

Then open:

- `http://localhost:3000/`

## Legacy Mock/Indexer Mode

The older mock-first prototype is still present for reference while the wallet-first app is being moved to production shape.

SQLite:

```bash
DB_DRIVER=sqlite
SQLITE_PATH=./dev.sqlite
```

MySQL:

```bash
DB_DRIVER=mysql
DATABASE_URL=mysql://root:root@127.0.0.1:8889/onchain_gallery
DB_SSL_MODE=disabled
```

Run legacy mock/indexer mode:

```bash
npm run db:migrate
npm run mock:seed
npm run dev:legacy
```

## Chain Indexer Cache

For a deployed app, use the indexer as a rebuildable cache of on-chain events. This saves repeated RPC/Alchemy calls for dashboard browsing while keeping `GalleryNFT` as the source of truth.

Configure:

```bash
INDEXER_SOURCE=chain
INDEXER_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your_key
INDEXER_FACTORY_ADDRESSES=0x8aD86A5479DA48387f019b11B369Dd7B2D16B7DD@10974606
INDEXER_COLLECTION_ADDRESSES=0x143fc037661CC2dAAFE5FA5d92A192F5f6f14487
INDEXER_START_BLOCK=10918800
INDEXER_BLOCK_SPAN=10000
INDEXER_CONFIRMATIONS=12
INDEXER_POLL_MS=15000
```

Notes:

- `INDEXER_FACTORY_ADDRESSES` discovers collection contracts from multiple factories. Use `address@block` to avoid scanning before a factory existed.
- `INDEXER_FACTORY_ADDRESS` is still supported for a single factory and is treated as an additional factory address.
- `INDEXER_COLLECTION_ADDRESSES` explicitly watches existing/imported collection contracts.
- `INDEXER_START_BLOCK` should ideally be the earliest factory deployment block or a block before the first gallery mint.
- Avoid `INDEXER_START_BLOCK=0` except for deliberate full reindexing; it wastes RPC calls on old empty history.
- `INDEXER_CONFIRMATIONS` keeps the cache behind the chain tip to avoid short reorgs.
- `INDEXER_POLL_MS` controls RPC spend while waiting for new events.
- The indexed cache uses separate `indexed_*` tables and can be rebuilt from chain.

Run:

```bash
npm run db:migrate
INDEXER_SOURCE=chain npm run dev:indexer
```

If you add a factory after the chain indexer has already checkpointed past its events, reset the rebuildable chain cache and reindex:

```bash
npm run index:reset
npm run dev:indexer
```

This clears only the indexed cache tables and the `chain` checkpoint. It does not delete on-chain data or browser drafts.

Newly minted galleries are inserted into the dashboard immediately with a `waiting for indexer` status. Once the chain indexer sees the events, the same gallery is replaced by the indexed cache record. This prevents users from minting duplicates just because the cache has not caught up yet.

Read indexed cache:

- `GET /api/indexed`
- `GET /api/indexed?owner=0xWalletAddress`
- `GET /api/indexed/galleries/0xCollectionAddress/1`

## Contract Verification Worker

Factory-created collections can be verified asynchronously by a separate worker. Keep the Etherscan key server-side only.

Configure:

```bash
ETHERSCAN_API_KEY=your_etherscan_key
VERIFIER_PROTOCOL_DIR=../gallerynft-protocol
VERIFIER_NETWORK=sepolia
VERIFIER_POLL_MS=60000
VERIFIER_MAX_ATTEMPTS=5
```

Run:

```bash
npm run dev:verifier
```

The verifier reads pending rows from `indexed_collections`, runs Hardhat verification from the protocol repo, and updates verification status fields in the cache DB.

## Protocol v1.1 Support

The app ABI includes the `GalleryNFT` v1.1 additions:

- `contractVersion`
- `supportsGalleryNFTFeature`
- `setGalleryExtraData` / `getGalleryExtraData`
- `setItemExtraData` / `getItemExtraData`
- `notifyMetadataUpdate`

The editor currently exposes practical item-level schema writes:

- `gallerynft.item.wallText.v1` for extended curator wall text
- `gallerynft.item.display.v1` for frame/display preferences

Marketplace refresh is deliberately a separate button. Normal edit saves do not emit ERC-4906 signals, so a user can make several edits and then ask marketplaces to refresh once.

## Troubleshooting

### `better-sqlite3` Node module version mismatch

If you switch Node versions and see an error like:

- `was compiled against a different Node.js version`
- `NODE_MODULE_VERSION ...`

rebuild native dependencies for the current Node version:

```bash
npm run rebuild:native
```

Then rerun:

```bash
npm run db:migrate
npm run dev
```

## Notes

- Canonical gallery data belongs on-chain in `GalleryNFT`.
- Browser `localStorage` is only a pre-mint draft workspace.
- `GalleryNFTFactory` is the preferred production path for user-created collection contracts.
- A production indexer should project deployed contract events directly for browsing/search/display caching.
- EVM token URI metadata fetch currently supports chain IDs `1` (ETH), `137` (Polygon), `8453` (Base), and `2741` (Abstract).

## Related Repo

Protocol contract/interface lives in `gallerynft-protocol`.
