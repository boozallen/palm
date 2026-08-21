require('tsconfig-paths/register');

let startupInProgress = false;

async function startWorker() {
  if (startupInProgress) {
    console.log('Worker startup already in progress, skipping...');
    return;
  }

  startupInProgress = true;

  try {
    console.log('Starting Graph Build Worker...');

    const { startGraphBuildWorker } = require('/app/features/graph-database/utils/worker/worker.ts');

    try {
      await startGraphBuildWorker();
    } catch (workerError) {
      if (workerError.message && workerError.message.includes('already running')) {
        console.log('Graph build worker already running, continuing...');
      } else {
        throw workerError;
      }
    }

    console.log('Graph Build Worker started successfully');

    try {
      const { startConversationGraphWorker } = require('/app/features/graph-database/utils/worker/conversationGraphWorker.ts');
      await startConversationGraphWorker();
    } catch (conversationGraphWorkerError) {
      console.error('Failed to start Conversation Graph Worker:', conversationGraphWorkerError);
    }

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
    console.error('Failed to start Graph Build Worker:', error);
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
