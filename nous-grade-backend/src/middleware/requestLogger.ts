// Request logging middleware
import { Request, Response, NextFunction } from 'express';

export interface LoggedRequest extends Request {
  startTime?: number;
  requestId?: string;
}

/**
 * Request logging middleware
 */
export const requestLogger = (
  req: LoggedRequest,
  res: Response,
  next: NextFunction
): void => {
  // Generate unique request ID
  req.requestId = generateRequestId();
  req.startTime = Date.now();

  // Log incoming request
  console.log(`📥 [${req.requestId}] ${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    timestamp: new Date().toISOString()
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - (req.startTime || 0);
    const statusColor = getStatusColor(res.statusCode);
    
    console.log(`📤 [${req.requestId}] ${statusColor}${res.statusCode}\x1b[0m ${req.method} ${req.url} - ${duration}ms`, {
      responseSize: res.get('Content-Length'),
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
  });

  next();
};

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get color code for status code
 */
function getStatusColor(statusCode: number): string {
  if (statusCode >= 500) return '\x1b[31m'; // Red
  if (statusCode >= 400) return '\x1b[33m'; // Yellow
  if (statusCode >= 300) return '\x1b[36m'; // Cyan
  if (statusCode >= 200) return '\x1b[32m'; // Green
  return '\x1b[0m'; // Reset
}
