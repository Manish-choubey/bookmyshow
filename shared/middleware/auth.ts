import { Request, Response, NextFunction } from 'express';
import { verifyToken, JWTPayload } from '../util/jwt';
import { logger } from '../util/logger';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/**
 * Authentication middleware to verify JWT tokens
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          message: 'No token provided. Please include a Bearer token in the Authorization header.',
        },
      });
      return;
    }

    // Extract token from "Bearer <token>"
    const token = authHeader.substring(7);

    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Token is missing',
        },
      });
      return;
    }

    // Verify token
    const decoded = verifyToken(token);

    // Check if token is an access token (not refresh token)
    if (decoded.type === 'refresh') {
      res.status(401).json({
        success: false,
        error: {
          message: 'Refresh token cannot be used for authentication',
        },
      });
      return;
    }

    // Attach user info to request
    req.user = decoded;
    next();
  } catch (error: any) {
    logger.error('Authentication error:', error);

    if (error.message === 'Token has expired') {
      res.status(401).json({
        success: false,
        error: {
          message: 'Token has expired',
        },
      });
      return;
    }

    res.status(401).json({
      success: false,
      error: {
        message: error.message || 'Authentication failed',
      },
    });
  }
}

/**
 * Optional authentication middleware - doesn't fail if no token
 */
export function optionalAuthenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (token) {
        const decoded = verifyToken(token);
        if (decoded.type !== 'refresh') {
          req.user = decoded;
        }
      }
    }

    next();
  } catch (error) {
    // Silently fail for optional auth
    next();
  }
}

/**
 * Role-based authorization middleware
 */
export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Authentication required',
        },
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          message: 'Insufficient permissions',
        },
      });
      return;
    }

    next();
  };
}
