#!/usr/bin/env node

// Graph Build Worker Entry Point
// This runs the graph building worker in isolation

// Environment variables are loaded through Docker

async function startWorker() {
  try {
    console.log('Starting Graph Build Worker...');

    const { startGraphBuildWorker } = require('/app/features/graph-database/utils/worker/worker');
    await startGraphBuildWorker();

    console.log('Graph Build Worker started successfully');

    // Keep process alive
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down worker...');
      process.exit(0);
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down worker...');
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start Graph Build Worker:', error);
    process.exit(1);
  }
}

startWorker();
