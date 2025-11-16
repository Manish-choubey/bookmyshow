import { Request, Response } from 'express';
import axios from 'axios';
import { logger } from '../../shared/util/logger';

// Use localhost for local development, auth-service for Docker
const getAuthServiceUrl = () => {
  const envUrl = process.env.AUTH_SERVICE_URL;

  // If running locally (not in Docker), use localhost:3001
  // Docker hostnames like "auth-service" won't resolve locally
  if (envUrl && envUrl.includes('auth-service')) {
    // Replace Docker hostname with localhost and ensure port 3001
    const url = envUrl.replace('auth-service', 'localhost');
    // Make sure it's port 3001, not 3000
    return url.replace(':3000', ':3001');
  }

  if (envUrl) {
    // Ensure it's not pointing to gateway port (3000)
    const url = envUrl.replace(':3000', ':3001');
    return url;
  }

  // Default to localhost:3001 for local development (NOT 3000!)
  return 'http://localhost:3001';
};

const SERVICE_URL = {
  auth: getAuthServiceUrl(),
};

// Log the configured URL on startup
console.log(`[Gateway] Auth Service URL configured as: ${SERVICE_URL.auth}`);

export class GatewayController {
  static async proxyToAuth(req: Request, res: Response): Promise<void> {
    try {
      // Extract path after /api/auth (e.g., /api/auth/profile -> /profile)
      const path = req.path.replace('/api/auth', '') || '/';
      const url = `${SERVICE_URL.auth}/api/auth${path}`;

      logger.info(`Gateway proxying ${req.method} ${req.path} to ${url}`, {
        method: req.method,
        path: req.path,
        targetUrl: url,
      });

      // Only include data for methods that support body (POST, PUT, PATCH)
      const methodsWithBody = ['POST', 'PUT', 'PATCH'];
      const axiosConfig: any = {
        method: req.method as any,
        url,
        params: req.query,
        headers: {
          ...req.headers,
          host: undefined,
        },
        timeout: 10000, // 10 second timeout
        validateStatus: (status: number) => status < 500, // Don't throw on 4xx errors
        maxRedirects: 5,
        maxContentLength: 50 * 1024 * 1024, // 50MB
        maxBodyLength: 50 * 1024 * 1024, // 50MB
      };

      // Only add data for methods that support body
      if (methodsWithBody.includes(req.method.toUpperCase()) && req.body) {
        axiosConfig.data = req.body;
      }

      const response = await axios(axiosConfig);

      res.status(response.status).json(response.data);
    } catch (error: any) {
      // Log error without circular references
      const errorMessage = error.message || 'Unknown error';
      const errorStatus = error.response?.status || 500;
      logger.error('Auth Service proxy error', {
        message: errorMessage,
        status: errorStatus,
        url: error.config?.url,
        method: error.config?.method,
      });

      const status = errorStatus;
      const message = error.response?.data || { message: 'Service unavailable' };
      res.status(status).json(message);
    }
  }
}
