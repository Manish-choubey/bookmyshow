import jwt from 'jsonwebtoken';
import { logger } from './logger';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  type?: 'access' | 'refresh';
}

/**
 * Generate JWT access token
 */
export function generateAccessToken(payload: Omit<JWTPayload, 'type'>): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  const expiresIn = process.env.JWT_EXPIRES_IN || '15m';

  const tokenPayload: JWTPayload = {
    ...payload,
    type: 'access',
  };

  return jwt.sign(tokenPayload, secret, {
    expiresIn,
    issuer: 'bookmyshow-auth-service',
    audience: 'bookmyshow-api',
  });
}

/**
 * Generate JWT refresh token
 */
export function generateRefreshToken(payload: Omit<JWTPayload, 'type'>): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

  const tokenPayload: JWTPayload = {
    ...payload,
    type: 'refresh',
  };

  return jwt.sign(tokenPayload, secret, {
    expiresIn: refreshExpiresIn,
    issuer: 'bookmyshow-auth-service',
    audience: 'bookmyshow-api',
  });
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): JWTPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  try {
    const decoded = jwt.verify(token, secret, {
      issuer: 'bookmyshow-auth-service',
      audience: 'bookmyshow-api',
    }) as JWTPayload;

    return decoded;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      logger.warn('Token expired');
      throw new Error('Token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      logger.warn('Invalid token');
      throw new Error('Invalid token');
    } else {
      logger.error('Token verification error:', error);
      throw new Error('Token verification failed');
    }
  }
}

/**
 * Decode JWT token without verification (for debugging)
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch (error) {
    logger.error('Token decode error:', error);
    return null;
  }
}
