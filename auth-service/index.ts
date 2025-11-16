import { createApp, setupErrorHandling, startServer } from '../server';
import { connectMongoose } from '../shared/database/mogoconfig';
import authRoutes from './authRoute/authRoute';
import { logger } from '../shared/util/logger';

const SERVICE_NAME = 'auth-service';
const PORT = parseInt(process.env.AUTH_SERVICE_PORT || '3001', 10);

// Initialize database connection
async function initializeDatabase() {
  try {
    await connectMongoose('auth');
    logger.info('Auth service database connected');
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    process.exit(1);
  }
}

// Initialize app
async function startApp() {
  // Connect to database
  await initializeDatabase();

  // Create app with common middleware
  const app = createApp(SERVICE_NAME);

  // Register routes
  app.use('/api/auth', authRoutes);

  // Setup error handling (must be after all routes)
  setupErrorHandling(app);

  // Start the server
  startServer(app, SERVICE_NAME, PORT);
}

// Start the application
startApp().catch((error) => {
  logger.error('Failed to start auth service:', error);
  process.exit(1);
});
