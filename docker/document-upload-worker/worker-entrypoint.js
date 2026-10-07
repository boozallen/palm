#!/usr/bin/env node

// Document Upload & Embedding Worker Entry Point
// This runs the document processing worker in isolation

// Environment variables are loaded through Docker

async function startWorker() {
  try {
    console.log('Starting Document Embedding Worker...');

    const { startDocumentUploadWorker } = require('/app/features/document-upload-provider/workers/documentUploadWorker');
    await startDocumentUploadWorker();

    console.log('Document Embedding Worker started successfully');

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
    console.error('Failed to start Document Embedding Worker:', error);
    process.exit(1);
  }
}

startWorker();
