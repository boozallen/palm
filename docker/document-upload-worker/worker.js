require('tsconfig-paths/register');

let startupInProgress = false;

async function startWorker() {
  if (startupInProgress) {
    console.log('Worker startup already in progress, skipping...');
    return;
  }

  startupInProgress = true;

  try {
    console.log('Starting Document Upload & Embedding Worker...');

    const { startDocumentUploadWorker } = require('/app/features/document-upload-provider/workers/documentUploadWorker.ts');
    
    try {
      await startDocumentUploadWorker();
    } catch (workerError) {
      if (workerError.message && workerError.message.includes('already running')) {
        console.log('Document upload worker already running, continuing...');
        // Don't re-throw this specific error
      } else {
        throw workerError;
      }
    }

    console.log('Document Upload & Embedding Worker started successfully');

    // Keep the process alive
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down worker...');
      process.exit(0);
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down worker...');
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start Document Upload & Embedding Worker:', error);
    startupInProgress = false;

    // Always keep the container alive and don't exit on any error for now
    console.log('Keeping container alive despite error...');

    // Keep the process alive
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down worker...');
      process.exit(0);
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down worker...');
      process.exit(0);
    });

    // Keep the process running
    setInterval(() => {
      console.log('Worker container is alive (error state)...');
    }, 30000); // Log every 30 seconds to show it's alive

    return;
  }
}

if (require.main === module) {
  startWorker();
}
