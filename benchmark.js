const { createClient } = require("redis");

const BATCH_SIZE = 1000;
const NUM_BATCHES = 1000;

async function runBenchmark() {
  const client = createClient();
  await client.connect();

  console.log(`Running Redis benchmark: ${NUM_BATCHES} batches of ${BATCH_SIZE} key-value pairs...`);
  const start = Date.now();

  for (let batch = 0; batch < NUM_BATCHES; batch++) {
    const pipeline = client.multi();
    for (let i = 0; i < BATCH_SIZE; i++) {
      const key = `bench:${batch}:${i}`;
      const value = `value-${batch}-${i}`;
      pipeline.set(key, value);
    }
    await pipeline.exec();
    if ((batch + 1) % 100 === 0) {
      console.log(`Completed batch ${batch + 1}/${NUM_BATCHES}`);
    }
  }

  const end = Date.now();
  console.log(`Benchmark complete. Total time: ${(end - start) / 1000} seconds.`);
  await client.quit();
}

runBenchmark().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
