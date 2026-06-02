import path from "path";
import dotenv from "dotenv";
import { pool } from "./db";
import { ChainSource } from "./source/ChainSource";
import { MockSource } from "./source/MockSource";
import { applyEvent } from "./apply/applyEvent";
import { applyChainEvent } from "./apply/applyChainEvent";
import { getCheckpoint, upsertCheckpoint } from "./apply/upserts";

const BATCH_SIZE = 50;
const POLL_MS = Number(process.env.INDEXER_POLL_MS || 1000);

async function main() {
  const repoRoot = path.join(__dirname, "..", "..");
  dotenv.config({ path: path.join(repoRoot, ".env") });
  dotenv.config();
  const sourceMode = (process.env.INDEXER_SOURCE || "mock").toLowerCase();
  const sourceName = sourceMode === "chain" ? "chain" : "mock";
  const source =
    sourceMode === "chain"
      ? new ChainSource()
      : new MockSource(
          (() => {
            const configuredPath = process.env.MOCK_EVENTS_PATH;
            return configuredPath
              ? path.isAbsolute(configuredPath)
                ? configuredPath
                : path.join(repoRoot, configuredPath)
              : path.join(repoRoot, "mock", "events.json");
          })()
        );

  let lastEventId = await getCheckpoint(pool, sourceName);
  console.log(`Starting ${sourceName} indexer from checkpoint ${lastEventId}`);

  while (true) {
    let events;
    try {
      events = await source.getNextEvents(lastEventId, BATCH_SIZE);
    } catch (err) {
      console.error(
        `Indexer source error; retrying in ${POLL_MS}ms:`,
        err instanceof Error ? err.message : err
      );
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      continue;
    }
    if (events.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      continue;
    }

    for (const event of events) {
      if (sourceMode === "chain") {
        await applyChainEvent(pool, event as any);
      } else {
        await applyEvent(pool, event as any);
      }
      lastEventId = event.id;
      await upsertCheckpoint(pool, sourceName, lastEventId);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
