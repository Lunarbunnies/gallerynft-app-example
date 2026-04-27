import path from "path";
import dotenv from "dotenv";
import { pool } from "./db";
import { MockSource } from "./source/MockSource";
import { applyEvent } from "./apply/applyEvent";
import { getCheckpoint, upsertCheckpoint } from "./apply/upserts";

const SOURCE_NAME = "mock";
const BATCH_SIZE = 50;
const POLL_MS = Number(process.env.INDEXER_POLL_MS || 1000);

async function main() {
  const repoRoot = path.join(__dirname, "..", "..");
  dotenv.config({ path: path.join(repoRoot, ".env") });
  dotenv.config();
  const configuredPath = process.env.MOCK_EVENTS_PATH;
  const mockPath = configuredPath
    ? path.isAbsolute(configuredPath)
      ? configuredPath
      : path.join(repoRoot, configuredPath)
    : path.join(repoRoot, "mock", "events.json");
  const source = new MockSource(mockPath);

  let lastEventId = await getCheckpoint(pool, SOURCE_NAME);
  console.log(`Starting from checkpoint ${lastEventId}`);

  while (true) {
    const events = await source.getNextEvents(lastEventId, BATCH_SIZE);
    if (events.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      continue;
    }

    for (const event of events) {
      await applyEvent(pool, event);
      lastEventId = event.id;
      await upsertCheckpoint(pool, SOURCE_NAME, lastEventId);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
