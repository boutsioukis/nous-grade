// Server startup script
import NousGradeServer from './app';
import { database } from './database';

async function startServer() {
  try {
    console.log('🚀 Starting Nous-Grade Backend Server...');
    
    // Initialize database
    await database.initialize();
    
    // Start cleanup interval for expired sessions (every 30 minutes)
    setInterval(async () => {
      try {
        await database.cleanupExpiredSessions();
      } catch (error) {
        console.error('🔴 Session cleanup failed:', error);
      }
    }, 30 * 60 * 1000);

    // Create and start server
    const server = new NousGradeServer();
    server.start();

  } catch (error) {
    console.error('🔴 Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('🔴 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔴 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();
