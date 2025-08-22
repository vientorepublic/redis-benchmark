const { createClient } = require("redis");

const BATCH_SIZE = 1000;
const NUM_BATCHES = 1000;

async function runBenchmark() {
  const client = createClient();
  await client.connect();

  const green = "\x1b[32m";
  const yellow = "\x1b[33m";
  const cyan = "\x1b[36m";
  const reset = "\x1b[0m";
  function ts() {
    return new Date().toISOString();
  }
  console.log(`${cyan}[${ts()}] Running Redis benchmark: ${NUM_BATCHES} batches of ${BATCH_SIZE} key-value pairs...${reset}`);
  const t0 = Date.now();

  // Insert (per-batch timing)
  let insertBatchTimes = [];
  for (let batch = 0; batch < NUM_BATCHES; batch++) {
    const batchStart = Date.now();
    const pipeline = client.multi();
    for (let i = 0; i < BATCH_SIZE; i++) {
      const key = `bench:${batch}:${i}`;
      const value = `value-${batch}-${i}`;
      pipeline.set(key, value);
    }
    await pipeline.exec();
    const batchEnd = Date.now();
    insertBatchTimes.push(batchEnd - batchStart);
    if ((batch + 1) % 100 === 0) {
      console.log(`${yellow}[${ts()}] Completed batch ${batch + 1}/${NUM_BATCHES}${reset}`);
    }
  }
  const t1 = Date.now();
  const insertMs = t1 - t0;
  const insertTime = (insertMs / 1000).toFixed(4);
  const insertTPS = ((NUM_BATCHES * BATCH_SIZE) / (insertMs / 1000)).toFixed(2);
  const avgInsertBatchMs = (insertBatchTimes.reduce((a, b) => a + b, 0) / insertBatchTimes.length).toFixed(2);
  const avgInsertBatch = (avgInsertBatchMs / 1000).toFixed(4);
  console.log(
    `${cyan}[${ts()}] Insert stage: ${insertTime}s (${insertMs}ms, ${insertTPS} ops/sec), avg per batch: ${avgInsertBatch}s (${avgInsertBatchMs}ms)${reset}`
  );

  // Fetch and verify (per-batch timing)
  const t2 = Date.now();
  console.log(`${cyan}[${ts()}] Fetching all created keys for verification...${reset}`);
  let allKeys = [];
  let cursor = 0;
  let fetchBatchTimes = [];
  do {
    const fetchStart = Date.now();
    const [nextCursor, keys] = await client.scan(cursor, { MATCH: "bench:*", COUNT: 1000 });
    cursor = Number(nextCursor);
    allKeys = allKeys.concat(keys);
    const fetchEnd = Date.now();
    fetchBatchTimes.push(fetchEnd - fetchStart);
  } while (cursor !== 0);
  const values = await client.mGet(allKeys);
  const fetchMs = Date.now() - t2;
  const fetchTime = (fetchMs / 1000).toFixed(4);
  const avgFetchBatchMs = (fetchBatchTimes.reduce((a, b) => a + b, 0) / fetchBatchTimes.length).toFixed(2);
  const avgFetchBatch = (avgFetchBatchMs / 1000).toFixed(4);
  if (allKeys.length !== NUM_BATCHES * BATCH_SIZE || values.length !== NUM_BATCHES * BATCH_SIZE) {
    console.error(
      `${yellow}[${ts()}] Verification failed: Expected ${NUM_BATCHES * BATCH_SIZE} keys, got ${allKeys.length} keys and ${
        values.length
      } values.${reset}`
    );
  } else {
    console.log(`${green}[${ts()}] Verification success: ${allKeys.length} keys fetched.${reset}`);
  }
  console.log(
    `${cyan}[${ts()}] Fetch stage: ${fetchTime}s (${fetchMs}ms, ${(allKeys.length / (fetchMs / 1000)).toFixed(
      2
    )} ops/sec), avg per batch: ${avgFetchBatch}s (${avgFetchBatchMs}ms)${reset}`
  );

  const t3 = Date.now();
  const totalMs = t3 - t0;
  const totalTime = (totalMs / 1000).toFixed(4);
  console.log(`${green}[${ts()}] Benchmark complete. Total time: ${totalTime} seconds (${totalMs}ms).${reset}`);

  // Delete all created keys before quitting (per-batch timing)
  const t4 = Date.now();
  console.log(`${cyan}[${ts()}] Deleting all created keys...${reset}`);
  let delCursor = 0;
  let delCount = 0;
  let deleteBatchTimes = [];
  do {
    const delStart = Date.now();
    const [nextCursor, keys] = await client.scan(delCursor, { MATCH: "bench:*", COUNT: 1000 });
    delCursor = Number(nextCursor);
    if (keys.length > 0) {
      await client.del(keys);
      delCount += keys.length;
    }
    const delEnd = Date.now();
    deleteBatchTimes.push(delEnd - delStart);
  } while (delCursor !== 0);
  const deleteMs = Date.now() - t4;
  const deleteTime = (deleteMs / 1000).toFixed(4);
  const avgDeleteBatchMs = (deleteBatchTimes.reduce((a, b) => a + b, 0) / deleteBatchTimes.length).toFixed(2);
  const avgDeleteBatch = (avgDeleteBatchMs / 1000).toFixed(4);
  console.log(`${green}[${ts()}] All created keys deleted.${reset}`);
  console.log(
    `${cyan}[${ts()}] Delete stage: ${deleteTime}s (${deleteMs}ms, ${(delCount / (deleteMs / 1000)).toFixed(
      2
    )} ops/sec), avg per batch: ${avgDeleteBatch}s (${avgDeleteBatchMs}ms)${reset}`
  );
  await client.quit();
}

runBenchmark().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
