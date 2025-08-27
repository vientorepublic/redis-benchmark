const { getHardwareInfo, saveBenchmarkResults, generateHtmlResults } = require("./utils");

// CLI argument parsing and --help support (English)
function printHelp() {
  console.log(
    `\nJS Batch Benchmark CLI\n\nUsage: node js-batch-benchmark.js [options]\n\nOptions:\n  --batchSize=N     Number of key-value pairs per batch (default: 1000)\n  --numBatches=N    Number of batches (default: 1000)\n  --help            Show this help message\n\nExample:\n  node js-batch-benchmark.js --batchSize=500 --numBatches=2000\n`
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
  try {
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
  } catch (err) {
    console.error(`${yellow}[${ts()}] Insert stage error:`, err, reset);
    savePartialResults("js-benchmark-partial-insert.json", store, "insert", insertBatchTimes);
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
  const keys = Object.keys(store);
  let fetchBatchTimes = [];
  let values = [];
  try {
    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
      const fetchStart = Date.now();
      const batchKeys = keys.slice(i, i + BATCH_SIZE);
      values.push(...batchKeys.map((k) => store[k]));
      const fetchEnd = Date.now();
      fetchBatchTimes.push(fetchEnd - fetchStart);
    }
  } catch (err) {
    console.error(`${yellow}[${ts()}] Fetch stage error:`, err, reset);
    savePartialResults("js-benchmark-partial-fetch.json", store, "fetch", fetchBatchTimes);
    throw err;
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
  try {
    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
      const delStart = Date.now();
      const batchKeys = keys.slice(i, i + BATCH_SIZE);
      for (const k of batchKeys) {
        delete store[k];
      }
      const delEnd = Date.now();
      deleteBatchTimes.push(delEnd - delStart);
    }
  } catch (err) {
    console.error(`${yellow}[${ts()}] Delete stage error:`, err, reset);
    savePartialResults("js-benchmark-partial-delete.json", store, "delete", deleteBatchTimes);
    throw err;
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

  const hardwareInfo = getHardwareInfo();
  const results = { hardwareInfo, stages: {} };

  results.stages.insert = {
    totalTime: `${insertTime}s (${insertMs}ms)`,
    avgPerBatch: `${avgInsertBatch}s (${avgInsertBatchMs}ms)`,
    throughput: `${insertTPS} ops/sec`,
  };

  results.stages.fetch = {
    totalTime: `${fetchTime}s (${fetchMs}ms)`,
    avgPerBatch: `${avgFetchBatch}s (${avgFetchBatchMs}ms)`,
    throughput: `${(keys.length / (fetchMs / 1000)).toFixed(2)} ops/sec`,
  };

  results.stages.delete = {
    totalTime: `${deleteTime}s (${deleteMs}ms)`,
    avgPerBatch: `${avgDeleteBatch}s (${avgDeleteBatchMs}ms)`,
    throughput: `${(keys.length / (deleteMs / 1000)).toFixed(2)} ops/sec`,
  };

  results.totalTime = `${totalTime}s (${totalMs}ms)`;

  saveBenchmarkResults("js-benchmark-results.json", results);
  generateHtmlResults("./templates/result-template.html", "js-benchmark-results.html", results);

  console.log(`${green}[${ts()}] JS Benchmark complete. Results saved as JSON and HTML.${reset}`);
}

// 중간 결과 저장 함수
function savePartialResults(fileName, store, stage, batchTimes) {
  const hardwareInfo = getHardwareInfo();
  const results = { hardwareInfo, stage, batchTimes, partialKeys: Object.keys(store).length };
  saveBenchmarkResults(fileName, results);
}

runJsBenchmark().catch((err) => {
  console.error("JS Benchmark failed:", err);
  process.exit(1);
});
