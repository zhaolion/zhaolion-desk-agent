import { loadConfig } from "./config.js";

const config = loadConfig();

console.log(`Starting Worker ${config.consumerId}`);
console.log(`Consumer Group: ${config.consumerGroup}`);
console.log(`Data Directory: ${config.dataDir}`);

// TODO: Initialize Redis consumer
// TODO: Start consuming tasks from stream

// Keep process alive
process.on("SIGINT", () => {
  console.log("Shutting down worker...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Shutting down worker...");
  process.exit(0);
});

console.log("Worker started, waiting for tasks...");

// Placeholder: keep alive
setInterval(() => {}, 1000);
