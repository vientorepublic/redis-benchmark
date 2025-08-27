# Redis Benchmark Node.js Project

This project benchmarks Redis performance using node-redis and also provides a pure JavaScript in-memory benchmark for comparison. Both tools support flexible CLI options and robust error handling.

## Usage

1. Install dependencies:
   ```sh
   npm install
   ```
2. Start a local Redis server (if not already running) for Redis benchmark.
3. Run the Redis benchmark:
   ```sh
   node benchmark.js [options]
   ```
4. Run the JavaScript in-memory benchmark:
   ```sh
   node js-batch-benchmark.js [options]
   ```

### CLI Options (for both tools)

- `--batchSize=N` Number of key-value pairs per batch (default: 1000)
- `--numBatches=N` Number of batches (default: 1000)
- `--help` Show help message and usage

#### Example

```
node benchmark.js --batchSize=500 --numBatches=2000
node js-batch-benchmark.js --batchSize=500 --numBatches=2000
```

### Features & Improvements

- **Flexible CLI**: Both benchmarks now support CLI arguments for batch size and number of batches, as well as a `--help` option for usage instructions.
- **Robust Error Handling**: If an error occurs during any stage (insert, fetch, delete), partial results are saved to a file for later inspection.
- **Consistent English Output**: All CLI messages, errors, and help are provided in English for consistency.
- **Result Reporting**: Results are saved as both JSON and HTML files in the `results/` directory, including hardware information and detailed timing for each stage.
- **In-Memory Comparison**: `js-batch-benchmark.js` allows you to compare Redis performance with pure JavaScript object operations.

## Requirements

- Node.js
- Redis server
- node-redis (installed via npm)

## Description

- The Redis benchmark connects to Redis, performs batches of key-value pair insertions, fetches, and deletions, and reports detailed timing and throughput.
- The JS benchmark performs the same operations in memory for comparison.
- Both tools provide hardware info, save results in JSON/HTML, and support flexible CLI usage.

## License

MIT
