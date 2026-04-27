# GalleryNFT App Example (Mock-First)

Reference app for interacting with GalleryNFT-style data.

Important: this repo is **not** the canonical protocol. It is an example client/indexer stack where the database is a cache/projection. Canonical state is intended to be on-chain in `gallerynft-protocol`.

## What Is In This Repo

- `web/` Next.js UI (gallery editor, frame mode, send flows)
- `indexer/` event projection service
- `shared/` packedRef helpers/tests
- `db/` migration runner + DB adapter
- `migrations/` SQL schema migrations (MySQL + SQLite)
- `mock/` mock contract events (`events.json`)

## Reviewer Setup

- Node: `24.12.0` (see `.nvmrc`)
- Install: `npm install`
- CI check: `npm run check`

## Runtime Modes

### SQLite (fast local, no MySQL)

```bash
DB_DRIVER=sqlite
SQLITE_PATH=./dev.sqlite
```

### MySQL

```bash
DB_DRIVER=mysql
DATABASE_URL=mysql://root:root@127.0.0.1:8889/onchain_gallery
DB_SSL_MODE=disabled
```

### Managed MySQL (SSL)

```bash
DB_DRIVER=mysql
DATABASE_URL=mysql://user:password@host:25060/defaultdb?ssl-mode=REQUIRED
DB_SSL_MODE=preferred
```

Optional:

```bash
REDIS_URL=redis://127.0.0.1:6379
ALCHEMY_API_KEY=your_key_here
```

## Local Dev

```bash
npm install
npm run db:migrate
npm run mock:seed
npm run dev
```

Then open:

- `http://localhost:3000/`
- `http://localhost:3000/frame/1`

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

- Indexer consumes `mock/events.json` and applies idempotent upserts.
- DB is a cache/materialized view; it must be rebuildable from events.
- EVM token URI metadata fetch currently supports chain IDs `1` (ETH), `137` (Polygon), and `8453` (Base).
- Backfill metadata command: `npm run metadata:backfill`

## Related Repo

Protocol contract/interface lives in `gallerynft-protocol`.
