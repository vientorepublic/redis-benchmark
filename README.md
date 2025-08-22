# Redis Benchmark Node.js Project

This project benchmarks Redis performance using node-redis. It inserts 1000 key-value pairs in a batch, repeated 1000 times, and measures the time taken.

## Usage

1. Install dependencies:
   ```sh
   npm install
   ```
2. Start a local Redis server (if not already running).
3. Run the benchmark:
   ```sh
   node benchmark.js
   ```

## Requirements

- Node.js
- Redis server
- node-redis (installed via npm)

## Description

- The script connects to Redis, performs 1000 batches of 1000 key-value pair insertions, and reports the total time taken.
