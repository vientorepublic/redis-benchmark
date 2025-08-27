const { createClient } = require("redis");
const { getHardwareInfo, saveBenchmarkResults, generateHtmlResults } = require("./utils");

// CLI argument parsing and --help support (English)
function printHelp() {
  console.log(
    `\nRedis Batch Benchmark CLI\n\nUsage: node benchmark.js [options]\n\nOptions:\n  --batchSize=N     Number of key-value pairs per batch (default: 1000)\n  --numBatches=N    Number of batches (default: 1000)\n  --help            Show this help message\n\nExample:\n  node benchmark.js --batchSize=500 --numBatches=2000\n`
  );
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    const match = arg.match(/^--(\w+)=(\d+)$/);
    if (match) {
      opts[match[1]] = parseInt(match[2], 10);
    } else if (arg.startsWith("--")) {
      console.error(`Unknown option: ${arg}`);
      printHelp();
      process.exit(1);
    }
  }
  return opts;
}

const cliOpts = parseArgs();
function getArgOrEnv(name, defaultValue) {
  if (cliOpts[name] !== undefined) return cliOpts[name];
  if (process.env[name]) return parseInt(process.env[name], 10);
  return defaultValue;
}

const BATCH_SIZE = getArgOrEnv("batchSize", 1000);
const NUM_BATCHES = getArgOrEnv("numBatches", 1000);

async function runBenchmark() {
  const client = createClient();
  await client.connect();

  const hardwareInfo = getHardwareInfo();
  const results = { hardwareInfo, stages: {} };

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
  try {
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
  } catch (err) {
    console.error(`${yellow}[${ts()}] Insert stage error:`, err, reset);
    await savePartialResults("redis-benchmark-partial-insert.json", client, "insert", insertBatchTimes);
    await client.quit();
    throw err;
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
  let values = [];
  try {
    do {
      const fetchStart = Date.now();
      const scanResult = await client.scan(cursor, { MATCH: "bench:*", COUNT: 1000 });
      cursor = scanResult.cursor;
      allKeys = allKeys.concat(scanResult.keys);
      const fetchEnd = Date.now();
      fetchBatchTimes.push(fetchEnd - fetchStart);
    } while (cursor !== 0);
    values = await client.mGet(allKeys);
  } catch (err) {
    console.error(`${yellow}[${ts()}] Fetch stage error:`, err, reset);
    await savePartialResults("redis-benchmark-partial-fetch.json", client, "fetch", fetchBatchTimes, allKeys);
    await client.quit();
    throw err;
  }
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
  try {
    do {
      const delStart = Date.now();
      let scanResult;
      try {
        scanResult = await client.scan(delCursor, { MATCH: "bench:*", COUNT: 1000 });
      } catch (error) {
        console.error("Error during client.scan:", error);
        throw error; // Re-throw after logging
      }

      if (!scanResult || typeof scanResult.cursor === "undefined" || !Array.isArray(scanResult.keys)) {
        throw new Error(`Unexpected scan result: ${JSON.stringify(scanResult)}`);
      }

      delCursor = scanResult.cursor;
      const keys = scanResult.keys;
      if (keys.length > 0) {
        try {
          await client.del(keys);
        } catch (error) {
          console.error("Error during client.del:", error);
          throw error; // Re-throw after logging
        }
        delCount += keys.length;
      }
      const delEnd = Date.now();
      deleteBatchTimes.push(delEnd - delStart);
    } while (delCursor !== 0);
  } catch (err) {
    console.error(`${yellow}[${ts()}] Delete stage error:`, err, reset);
    await savePartialResults("redis-benchmark-partial-delete.json", client, "delete", deleteBatchTimes);
    await client.quit();
    throw err;
  }
  async function savePartialResults(fileName, client, stage, batchTimes, keys) {
    const hardwareInfo = getHardwareInfo();
    let partialKeys = 0;
    if (stage === "fetch" && Array.isArray(keys)) {
      partialKeys = keys.length;
    } else if (stage === "delete") {
      let cursor = 0;
      let count = 0;
      do {
        const scanResult = await client.scan(cursor, { MATCH: "bench:*", COUNT: 1000 });
        cursor = scanResult.cursor;
        count += scanResult.keys.length;
      } while (cursor !== 0);
      partialKeys = count;
    }
    const results = { hardwareInfo, stage, batchTimes, partialKeys };
    saveBenchmarkResults(fileName, results);
  }
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
  results.stages.insert = {
    totalTime: `${insertTime}s (${insertMs}ms)`,
    avgPerBatch: `${avgInsertBatch}s (${avgInsertBatchMs}ms)`,
    throughput: `${insertTPS} ops/sec`,
  };

  results.stages.fetch = {
    totalTime: `${fetchTime}s (${fetchMs}ms)`,
    avgPerBatch: `${avgFetchBatch}s (${avgFetchBatchMs}ms)`,
    throughput: `${(allKeys.length / (fetchMs / 1000)).toFixed(2)} ops/sec`,
  };

  results.stages.delete = {
    totalTime: `${deleteTime}s (${deleteMs}ms)`,
    avgPerBatch: `${avgDeleteBatch}s (${avgDeleteBatchMs}ms)`,
    throughput: `${(delCount / (deleteMs / 1000)).toFixed(2)} ops/sec`,
  };

  results.totalTime = `${totalTime}s (${totalMs}ms)`;

  saveBenchmarkResults("redis-benchmark-results.json", results);
  generateHtmlResults("./templates/result-template.html", "redis-benchmark-results.html", results);

  console.log(`${green}[${ts()}] Redis Benchmark complete. Results saved as JSON and HTML.${reset}`);
  await client.quit();
}

runBenchmark().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
