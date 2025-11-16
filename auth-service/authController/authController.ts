import { Request, Response } from 'express';
import { logger } from '../../shared/util/logger';
import { getUserModel } from '../models/User';
import { getSessionModel } from '../models/Session';
import bcrypt from 'bcrypt';
import { generateAccessToken, generateRefreshToken, verifyToken } from '../../shared/util/jwt';

export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, name } = req.body;
      if (!email || !password || !name) {
        res.status(400).json({
          success: false,
          error: {
            message: 'All fields are required',
          },
        });
        return;
      }
      const User = getUserModel();
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        res.status(400).json({ success: false, error: { message: 'User already exists' } });
        return;
      }

      const hashpassword = await bcrypt.hash(password, 10);
      const newUser = new User({
        email: email.toLowerCase(),
        password: hashpassword,
        name: name,
        role: 'user',
      });
      await newUser.save();
      logger.info(`User registered successfully: ${email}`);
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          id: (newUser._id as any).toString(),
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
        },
      });
    } catch (error: any) {
      logger.error(`Error registering user: ${error}`);
      res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error',
        },
      });
    }
  }

  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Email and password are required',
          },
        });
        return;
      }

      const User = getUserModel();
      // Find user and include password field
      const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

      if (!user) {
        res.status(401).json({
          success: false,
          error: {
            message: 'Invalid email or password',
          },
        });
        return;
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        res.status(401).json({
          success: false,
          error: {
            message: 'Invalid email or password',
          },
        });
        return;
      }

      // Generate tokens
      const accessToken = generateAccessToken({
        userId: (user._id as any).toString(),
        email: user.email,
        role: user.role,
      });

      const refreshToken = generateRefreshToken({
        userId: (user._id as any).toString(),
        email: user.email,
        role: user.role,
      });

      // Get access token expiration for response
      const accessTokenExpiresIn = process.env.JWT_EXPIRES_IN || '15m';

      // Calculate refresh token expiration for session storage
      const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
      const expiresInMs = refreshExpiresIn.includes('d')
        ? parseInt(refreshExpiresIn) * 24 * 60 * 60 * 1000
        : refreshExpiresIn.includes('h')
          ? parseInt(refreshExpiresIn) * 60 * 60 * 1000
          : parseInt(refreshExpiresIn) * 60 * 1000;

      const expiresAt = new Date(Date.now() + expiresInMs);

      // Store session in database
      const Session = getSessionModel();
      const session = new Session({
        userId: user._id,
        token: refreshToken,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
        expiresAt: expiresAt,
      });
      await session.save();

      logger.info(`User logged in successfully: ${email}`);

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: (user._id as any).toString(),
            email: user.email,
            name: user.name,
            role: user.role,
          },
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: accessTokenExpiresIn,
          },
        },
      });
    } catch (error: any) {
      logger.error(`Error logging in user: ${error}`);
      res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error',
        },
      });
    }
  }

  static async logout(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      // If refresh token is provided in body, logout that specific session
      if (refreshToken) {
        let decoded;
        try {
          decoded = verifyToken(refreshToken);
        } catch (error: any) {
          // If token is invalid or expired, still return success
          res.status(200).json({
            success: true,
            message: 'Logout successful',
          });
          return;
        }

        // Delete specific session from database
        const Session = getSessionModel();
        await Session.deleteOne({
          userId: decoded.userId,
          token: refreshToken,
        });

        logger.info(`User logged out: ${decoded.email}`);
      }
      // If user is authenticated via access token, logout all their sessions
      else if (req.user) {
        const Session = getSessionModel();
        await Session.deleteMany({
          userId: req.user.userId,
        });

        logger.info(`All sessions logged out for user: ${req.user.email}`);
      } else {
        res.status(400).json({
          success: false,
          error: {
            message: 'Refresh token is required or user must be authenticated',
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error: any) {
      logger.error(`Error logging out user: ${error}`);
      res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error',
        },
      });
    }
  }

  static async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Refresh token is required',
          },
        });
        return;
      }

      // Verify refresh token
      let decoded;
      try {
        decoded = verifyToken(refreshToken);
      } catch (error: any) {
        res.status(401).json({
          success: false,
          error: {
            message: error.message || 'Invalid refresh token',
          },
        });
        return;
      }

      // Check if it's actually a refresh token
      if (decoded.type !== 'refresh') {
        res.status(401).json({
          success: false,
          error: {
            message: 'Invalid token type',
          },
        });
        return;
      }

      // Verify session exists in database
      const Session = getSessionModel();
      const session = await Session.findOne({
        userId: decoded.userId,
        token: refreshToken,
      });

      if (!session) {
        res.status(401).json({
          success: false,
          error: {
            message: 'Session not found or expired',
          },
        });
        return;
      }

      // Get user info
      const User = getUserModel();
      const user = await User.findById(decoded.userId);

      if (!user) {
        res.status(401).json({
          success: false,
          error: {
            message: 'User not found',
          },
        });
        return;
      }

      // Generate new access token
      const newAccessToken = generateAccessToken({
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      });

      logger.info(`Token refreshed for user: ${decoded.email}`);

      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken: newAccessToken,
          expiresIn: process.env.JWT_EXPIRES_IN || '15m',
        },
      });
    } catch (error: any) {
      logger.error(`Error refreshing token: ${error}`);
      res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error',
        },
      });
    }
  }

  static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      // req.user is set by authenticate middleware
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            message: 'Unauthorized',
          },
        });
        return;
      }

      const User = getUserModel();
      const user = await User.findById(req.user.userId);

      if (!user) {
        res.status(404).json({
          success: false,
          error: {
            message: 'User not found',
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          id: (user._id as any).toString(),
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    } catch (error: any) {
      logger.error(`Error getting user profile: ${error}`);
      res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error',
        },
      });
    }
  }
}
