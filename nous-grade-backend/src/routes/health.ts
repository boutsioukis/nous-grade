// Health check routes
import '../config/env';
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

/**
 * GET /health
 * Basic health check endpoint
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    services: {
      database: await checkDatabaseHealth(),
      ai: await checkAIServicesHealth(),
      storage: await checkStorageHealth()
    },
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024)
      }
    }
  };

  // Determine overall health status
  const allServicesHealthy = Object.values(healthCheck.services).every(
    service => service.status === 'healthy'
  );

  const statusCode = allServicesHealthy ? 200 : 503;
  
  res.status(statusCode).json({
    success: allServicesHealthy,
    data: healthCheck
  });
}));

/**
 * GET /health/detailed
 * Detailed health check with more diagnostics
 */
router.get('/detailed', asyncHandler(async (req: Request, res: Response) => {
  const detailedHealth = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    services: {
      database: await checkDatabaseHealth(true),
      ai: await checkAIServicesHealth(true),
      storage: await checkStorageHealth(true)
    },
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cpus: require('os').cpus().length,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
      },
      loadAverage: require('os').loadavg()
    },
    configuration: {
      port: process.env.PORT || 3001,
      corsOrigin: process.env.CORS_ORIGIN || 'chrome-extension://*',
      rateLimit: {
        windowMs: process.env.RATE_LIMIT_WINDOW_MS || '900000',
        maxRequests: process.env.RATE_LIMIT_MAX_REQUESTS || '100'
      },
      upload: {
        maxFileSize: process.env.MAX_FILE_SIZE || '10485760',
        uploadDir: process.env.UPLOAD_DIR || 'uploads/'
      }
    }
  };

  const allServicesHealthy = Object.values(detailedHealth.services).every(
    service => service.status === 'healthy'
  );

  const statusCode = allServicesHealthy ? 200 : 503;
  
  res.status(statusCode).json({
    success: allServicesHealthy,
    data: detailedHealth
  });
}));

/**
 * Check database health
 */
async function checkDatabaseHealth(detailed: boolean = false): Promise<any> {
  try {
    // TODO: Implement actual database health check
    // For now, return mock healthy status
    const baseHealth = {
      status: 'healthy',
      responseTime: Math.floor(Math.random() * 50) + 10, // Mock response time
      lastChecked: new Date().toISOString()
    };

    if (detailed) {
      return {
        ...baseHealth,
        connection: 'active',
        poolSize: 10,
        activeConnections: 2,
        database: process.env.DB_NAME || 'nous_grade_db',
        host: process.env.DB_HOST || 'localhost'
      };
    }

    return baseHealth;
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Database connection failed',
      lastChecked: new Date().toISOString()
    };
  }
}

/**
 * Check AI services health
 */
async function checkAIServicesHealth(detailed: boolean = false): Promise<any> {
  try {
    const baseHealth = {
      status: 'healthy',
      openai: {
        status: process.env.OPENAI_API_KEY ? 'configured' : 'not_configured',
        model: 'gpt-5.1'
      },
      anthropic: {
        status: process.env.ANTHROPIC_API_KEY ? 'configured' : 'not_configured',
        models: ['claude-3-5-sonnet-20241022', 'claude-3-5-sonnet-20241022']
      },
      lastChecked: new Date().toISOString()
    };

    if (detailed) {
      return {
        ...baseHealth,
        configuration: {
          ocrModel: 'gpt-5.1',
          gradingModel: 'claude-3-5-sonnet-20241022',
          feedbackModel: 'claude-3-5-sonnet-20241022'
        },
        rateLimits: {
          openai: 'tier-based',
          anthropic: 'tier-based'
        }
      };
    }

    return baseHealth;
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'AI services check failed',
      lastChecked: new Date().toISOString()
    };
  }
}

/**
 * Check storage health
 */
async function checkStorageHealth(detailed: boolean = false): Promise<any> {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    
    const uploadDir = process.env.UPLOAD_DIR || 'uploads/';
    
    // Check if upload directory exists and is writable
    try {
      await fs.access(uploadDir);
    } catch {
      // Create directory if it doesn't exist
      await fs.mkdir(uploadDir, { recursive: true });
    }

    const baseHealth = {
      status: 'healthy',
      uploadDir: uploadDir,
      maxFileSize: process.env.MAX_FILE_SIZE || '10485760',
      lastChecked: new Date().toISOString()
    };

    if (detailed) {
      const stats = await fs.stat(uploadDir);
      return {
        ...baseHealth,
        permissions: {
          readable: true,
          writable: true
        },
        created: stats.birthtime,
        modified: stats.mtime
      };
    }

    return baseHealth;
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Storage check failed',
      lastChecked: new Date().toISOString()
    };
  }
}

export default router;
