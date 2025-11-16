import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { errorHandler } from './shared/middleware/errorHandler';
import { logger } from './shared/util/logger';

// Load environment variables once at root level
dotenv.config();

/**
 * Creates an Express app with common middleware
 * Services can extend this app with their own routes
 */
export function createApp(serviceName: string): Express {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors());

  // Body parsing - Express automatically skips parsing for GET requests
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.use(morgan('combined'));

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      service: serviceName,
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}

/**
 * Sets up error handling and 404 handler
 * Call this after adding all routes
 */
export function setupErrorHandling(app: Express): void {
  // 404 handler (must be before error handler)
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.status(404).json({
      success: false,
      error: {
        message: 'Route not found',
      },
    });
  });

  // Error handling middleware (must be last)
  app.use(errorHandler);
}

/**
 * Starts the server
 */
export function startServer(app: Express, serviceName: string, port: number): void {
  app.listen(port, () => {
    logger.info(`${serviceName} is running on port ${port}`);
  });
}

/**
 * Convenience function that creates app, sets up error handling, and starts server
 * Use this for simple services, or use createApp + setupErrorHandling + startServer for more control
 */
export function createServer(serviceName: string, port: number): Express {
  const app = createApp(serviceName);
  setupErrorHandling(app);
  startServer(app, serviceName, port);
  return app;
}
