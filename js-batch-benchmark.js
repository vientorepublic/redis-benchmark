// js-batch-benchmark.js
// Node.js 런타임의 순수 자바스크립트 성능 벤치마크 (배열에 1000x1000 K-V 저장)

const BATCH_SIZE = 1000;
const NUM_BATCHES = 1000;

async function runJsBenchmark() {
  console.log(`Running JS batch benchmark: ${NUM_BATCHES} batches of ${BATCH_SIZE} key-value pairs...`);
  const start = Date.now();
  const store = {};

  for (let batch = 0; batch < NUM_BATCHES; batch++) {
    for (let i = 0; i < BATCH_SIZE; i++) {
      const key = `bench:${batch}:${i}`;
      const value = `value-${batch}-${i}`;
      store[key] = value;
    }
    if ((batch + 1) % 100 === 0) {
      console.log(`Completed batch ${batch + 1}/${NUM_BATCHES}`);
    }
  }

  const end = Date.now();
  console.log(`JS Benchmark complete. Total time: ${(end - start) / 1000} seconds.`);
}

runJsBenchmark().catch((err) => {
  console.error("JS Benchmark failed:", err);
  process.exit(1);
});
