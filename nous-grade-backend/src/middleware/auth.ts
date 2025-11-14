// Authentication middleware
import '../config/env';
import { Request, Response, NextFunction } from 'express';
import { createError } from './errorHandler';

export interface AuthenticatedRequest extends Request {
  apiKey?: string;
  clientInfo?: {
    extensionId?: string;
    version?: string;
  };
}

/**
 * Validate API key middleware
 * For MVP, we'll use a simple API key approach
 * In production, this would integrate with proper authentication
 */
export const validateApiKey = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Extract API key from header or query parameter
    const apiKey = req.headers['x-api-key'] as string || 
                   req.headers['authorization']?.replace('Bearer ', '') ||
                   req.query.apiKey as string;

    if (!apiKey) {
      throw createError(
        'API key is required',
        401,
        'MISSING_API_KEY',
        { 
          message: 'Provide API key in X-API-Key header, Authorization header, or apiKey query parameter',
          examples: {
            header: 'X-API-Key: your-api-key',
            authorization: 'Authorization: Bearer your-api-key',
            query: '?apiKey=your-api-key'
          }
        }
      );
    }

    // For MVP, we'll use a simple validation
    // In production, this would validate against a database or JWT
    const validApiKey = process.env.API_KEY || 'nous-grade-api-key-2024';
    
    if (apiKey !== validApiKey) {
      throw createError(
        'Invalid API key',
        401,
        'INVALID_API_KEY',
        { providedKey: apiKey.substring(0, 8) + '...' }
      );
    }

    // Extract client information from headers
    req.apiKey = apiKey;
    req.clientInfo = {
      extensionId: req.headers['x-extension-id'] as string,
      version: req.headers['x-extension-version'] as string
    };

    console.log(`🔑 API key validated for ${req.method} ${req.url}`, {
      extensionId: req.clientInfo.extensionId,
      version: req.clientInfo.version,
      ip: req.ip
    });

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional authentication for public endpoints
 */
export const optionalAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const apiKey = req.headers['x-api-key'] as string || 
                 req.headers['authorization']?.replace('Bearer ', '');

  if (apiKey) {
    // Validate if provided
    validateApiKey(req, res, next);
  } else {
    // Continue without authentication
    next();
  }
};
