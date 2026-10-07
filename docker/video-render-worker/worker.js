require('tsconfig-paths/register');

let startupInProgress = false;

async function startWorker() {
  if (startupInProgress) {
    console.log('Worker startup already in progress, skipping...');
    return;
  }

  startupInProgress = true;

  try {
    console.log('Starting Video Render Worker...');

    const { startRenderWorker } = require('/app/features/video-generation/utils/worker/renderWorker.ts');

    try {
      await startRenderWorker();
    } catch (workerError) {
      if (workerError.message && workerError.message.includes('already running')) {
        console.log('Video render worker already running, continuing...');
      } else {
        throw workerError;
      }
    }

    console.log('Video Render Worker started successfully');

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
    console.error('Failed to start Video Render Worker:', error);
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
