# Contributing to GalleryNFT App Example

Thanks for contributing.

## Ground Rules

- Treat DB as cache/projection, not canonical source of truth.
- Keep mock event flow aligned to planned on-chain events.
- Preserve deterministic projection behavior (idempotent replay).
- Do not commit secrets (`.env`, API keys, DB credentials).

## Development Setup

```bash
nvm use
npm install
npm run check
```

For local runtime:

```bash
npm run db:migrate
npm run mock:seed
npm run dev
```

## Pull Request Checklist

1. Change rationale included in PR description.
2. Tests or checks run (`npm run check`, plus targeted runtime checks as needed).
3. If schema/projection changed, migration and indexer updates are included.
4. If API/UI changed, update docs/README screenshots or notes.
5. No local artifacts committed (`node_modules/`, `.next/`, `*.sqlite`, logs).

## Architecture Expectations

- `mock/events.json` is an event source for development.
- Indexer must be able to rebuild DB state from events.
- UI writes should map 1:1 to expected contract write ops (mock now, on-chain later).

## Security Reporting

If you find a vulnerability, avoid posting exploit details publicly first.
Open a minimal issue requesting private coordination with maintainers.
