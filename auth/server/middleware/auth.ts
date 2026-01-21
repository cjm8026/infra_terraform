/**
 * Authentication Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { getAuthService } from '../../src/services/authService';
import { getUserService, UserNotFoundError } from '../../src/services/userService';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    nickname?: string;
  };
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header',
      });
      return;
    }

    const token = authHeader.substring(7);
    const authService = getAuthService();
    const decodedToken = await authService.verifyToken(token);

    // DB에 유저가 없으면 자동 생성 (Google 로그인 등 소셜 로그인 대응)
    const userService = getUserService();
    try {
      await userService.getUserProfile(decodedToken.sub);
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        console.log(`[authMiddleware] Creating new user in DB: ${decodedToken.sub}`);
        try {
          await userService.createUser(
            decodedToken.sub,
            decodedToken.email,
            decodedToken.preferred_username || decodedToken.email
          );
        } catch (createError: any) {
          // 이메일 중복 에러는 무시 (이미 같은 이메일로 가입된 경우)
          if (createError.code === '23505') {
            console.log(`[authMiddleware] User with email ${decodedToken.email} already exists, skipping creation`);
          } else {
            throw createError;
          }
        }
      } else {
        throw error;
      }
    }

    req.user = {
      userId: decodedToken.sub,
      email: decodedToken.email,
      nickname: decodedToken.preferred_username,
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
  }
}

export async function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const authService = getAuthService();
      const decodedToken = await authService.verifyToken(token);

      req.user = {
        userId: decodedToken.sub,
        email: decodedToken.email,
        nickname: decodedToken.preferred_username,
      };
    }

    next();
  } catch (error) {
    next();
  }
}
