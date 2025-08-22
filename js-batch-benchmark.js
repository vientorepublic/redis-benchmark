// js-batch-benchmark.js
// Node.js 런타임의 순수 자바스크립트 성능 벤치마크 (배열에 1000x1000 K-V 저장)

const BATCH_SIZE = 1000;
const NUM_BATCHES = 1000;

async function runJsBenchmark() {
  const green = "\x1b[32m";
  const yellow = "\x1b[33m";
  const cyan = "\x1b[36m";
  const reset = "\x1b[0m";
  function ts() {
    return new Date().toISOString();
  }
  console.log(`${cyan}[${ts()}] Running JS batch benchmark: ${NUM_BATCHES} batches of ${BATCH_SIZE} key-value pairs...${reset}`);
  const t0 = Date.now();
  const store = {};

  // Insert (per-batch timing)
  let insertBatchTimes = [];
  for (let batch = 0; batch < NUM_BATCHES; batch++) {
    const batchStart = Date.now();
    for (let i = 0; i < BATCH_SIZE; i++) {
      const key = `bench:${batch}:${i}`;
      const value = `value-${batch}-${i}`;
      store[key] = value;
    }
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
  const keys = Object.keys(store);
  let fetchBatchTimes = [];
  let values = [];
  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    const fetchStart = Date.now();
    const batchKeys = keys.slice(i, i + BATCH_SIZE);
    values.push(...batchKeys.map((k) => store[k]));
    const fetchEnd = Date.now();
    fetchBatchTimes.push(fetchEnd - fetchStart);
  }
  const fetchMs = Date.now() - t2;
  const fetchTime = (fetchMs / 1000).toFixed(4);
  const avgFetchBatchMs = (fetchBatchTimes.reduce((a, b) => a + b, 0) / fetchBatchTimes.length).toFixed(2);
  const avgFetchBatch = (avgFetchBatchMs / 1000).toFixed(4);
  if (keys.length !== NUM_BATCHES * BATCH_SIZE || values.length !== NUM_BATCHES * BATCH_SIZE) {
    console.error(
      `${yellow}[${ts()}] Verification failed: Expected ${NUM_BATCHES * BATCH_SIZE} keys, got ${keys.length} keys and ${
        values.length
      } values.${reset}`
    );
  } else {
    console.log(`${green}[${ts()}] Verification success: ${keys.length} keys fetched.${reset}`);
  }
  console.log(
    `${cyan}[${ts()}] Fetch stage: ${fetchTime}s (${fetchMs}ms, ${(keys.length / (fetchMs / 1000)).toFixed(
      2
    )} ops/sec), avg per batch: ${avgFetchBatch}s (${avgFetchBatchMs}ms)${reset}`
  );

  // Delete (per-batch timing)
  const t3 = Date.now();
  let deleteBatchTimes = [];
  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    const delStart = Date.now();
    const batchKeys = keys.slice(i, i + BATCH_SIZE);
    for (const k of batchKeys) {
      delete store[k];
    }
    const delEnd = Date.now();
    deleteBatchTimes.push(delEnd - delStart);
  }
  const deleteMs = Date.now() - t3;
  const deleteTime = (deleteMs / 1000).toFixed(4);
  const avgDeleteBatchMs = (deleteBatchTimes.reduce((a, b) => a + b, 0) / deleteBatchTimes.length).toFixed(2);
  const avgDeleteBatch = (avgDeleteBatchMs / 1000).toFixed(4);
  if (Object.keys(store).length === 0) {
    console.log(`${green}[${ts()}] All keys deleted from JS store.${reset}`);
  } else {
    console.error(`${yellow}[${ts()}] Delete failed: ${Object.keys(store).length} keys remain.${reset}`);
  }
  console.log(
    `${cyan}[${ts()}] Delete stage: ${deleteTime}s (${deleteMs}ms, ${(keys.length / (deleteMs / 1000)).toFixed(
      2
    )} ops/sec), avg per batch: ${avgDeleteBatch}s (${avgDeleteBatchMs}ms)${reset}`
  );

  const end = Date.now();
  const totalMs = end - t0;
  const totalTime = (totalMs / 1000).toFixed(4);
  console.log(`${green}[${ts()}] JS Benchmark complete. Total time: ${totalTime} seconds (${totalMs}ms).${reset}`);
}

runJsBenchmark().catch((err) => {
  console.error("JS Benchmark failed:", err);
  process.exit(1);
});
