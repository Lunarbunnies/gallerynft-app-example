import path from "path";
import dotenv from "dotenv";
import { pool } from "./db";
import { ChainSource } from "./source/ChainSource";
import { applyChainEvent } from "./apply/applyChainEvent";
import { getCheckpoint, upsertCheckpoint } from "./apply/upserts";

const BATCH_SIZE = 200;
const EVENT_ID_MULTIPLIER = 100000;

async function main() {
  const repoRoot = path.join(__dirname, "..", "..");
  dotenv.config({ path: path.join(repoRoot, ".env") });
  dotenv.config();

  const source = new ChainSource();
  let lastEventId = await getCheckpoint(pool, "chain");
  console.log(`Starting chain catchup from checkpoint ${lastEventId}`);

  let processed = 0;
  while (true) {
    const events = await source.getNextEvents(lastEventId, BATCH_SIZE);
    if (events.length === 0) break;

    for (const event of events) {
      await applyChainEvent(pool, event);
      lastEventId = event.id;
      await upsertCheckpoint(pool, "chain", lastEventId);
      processed += 1;

      if (event.type === "Checkpoint") {
        const blockNumber = Math.floor(event.id / EVENT_ID_MULTIPLIER);
        if (processed % 10 === 0) {
          console.log(`Scanned through block ${blockNumber}`);
        }
      } else {
        console.log(`Indexed ${event.type} at event ${event.id}`);
      }
    }
  }

  console.log(`Catchup complete. Processed ${processed} event/checkpoint entries.`);
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
