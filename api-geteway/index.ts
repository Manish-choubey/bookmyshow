import { Request, Response } from 'express';
import { createApp, setupErrorHandling, startServer } from '../server';
import gatewayRoutes from './route/getwayroute';

const SERVICE_NAME = 'api-gateway';
const PORT = parseInt(process.env.API_GATEWAY_PORT || '3000', 10);

// Create app with common middleware
const app = createApp(SERVICE_NAME);

// API Gateway info endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'BookMyShow API Gateway',
    service: SERVICE_NAME,
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
    },
  });
});

// Register gateway routes (proxy to services)
app.use('/api', gatewayRoutes);

// Setup error handling (must be after all routes)
setupErrorHandling(app);

// Start the server
startServer(app, SERVICE_NAME, PORT);
