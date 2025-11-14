// Main Express application for Nous-Grade Backend
// Production-ready server with session-based API architecture

import './config/env';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';

// Import routes
import sessionRoutes from './routes/sessions';
import screenshotRoutes from './routes/screenshots';
import gradingRoutes from './routes/grading';
import healthRoutes from './routes/health';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { validateApiKey } from './middleware/auth';

class NousGradeServer {
  private app: express.Application;
  private server: any;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3001', 10);
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  /**
   * Initialize all middleware
   */
  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS configuration for Chrome extension
    this.app.use(cors({
      origin: [
        process.env.CORS_ORIGIN || 'chrome-extension://*',
        'http://localhost:3000', // For development
        'https://localhost:3000'
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
      message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api/', limiter);

    // Body parsing middleware
    this.app.use(express.json({ 
      limit: process.env.MAX_FILE_SIZE || '10mb',
      verify: (req, res, buf) => {
        // Store raw body for signature verification if needed
        (req as any).rawBody = buf;
      }
    }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging middleware
    if (process.env.NODE_ENV === 'development') {
      this.app.use(morgan('dev'));
    } else {
      this.app.use(morgan('combined'));
    }
    this.app.use(requestLogger);

    // Health check (before auth)
    this.app.use('/health', healthRoutes);

    // API key validation for protected routes
    this.app.use('/api', validateApiKey);
  }

  /**
   * Initialize all API routes
   */
  private initializeRoutes(): void {
    // API v1 routes with session-based architecture
    this.app.use('/api/grading/sessions', sessionRoutes);
    this.app.use('/api/grading/screenshots', screenshotRoutes);
    this.app.use('/api/grading', gradingRoutes);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        service: 'Nous-Grade Backend API',
        version: '1.0.0',
        status: 'operational',
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/health',
          sessions: '/api/grading/sessions',
          screenshots: '/api/grading/screenshots',
          grading: '/api/grading/grade',
          results: '/api/grading/results/:sessionId'
        }
      });
    });

    // 404 handler for unknown routes (must not use wildcard path with Express 5)
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        message: `The requested endpoint ${req.originalUrl} does not exist`,
        availableEndpoints: [
          '/health',
          '/api/grading/sessions',
          '/api/grading/screenshots',
          '/api/grading/grade',
          '/api/grading/results/:sessionId'
        ]
      });
    });
  }

  /**
   * Initialize error handling middleware
   */
  private initializeErrorHandling(): void {
    this.app.use(errorHandler);
  }

  /**
   * Start the server
   */
  public start(): void {
    this.server = createServer(this.app);

    this.server.listen(this.port, () => {
      console.log(`🚀 Nous-Grade Backend Server started successfully`);
      console.log(`🌐 Server running on port ${this.port}`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📊 Health check: http://localhost:${this.port}/health`);
      console.log(`🎯 API Base URL: http://localhost:${this.port}/api`);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`\n📋 Available Endpoints:`);
        console.log(`   GET  /health                           - Health check`);
        console.log(`   POST /api/grading/sessions             - Create grading session`);
        console.log(`   POST /api/grading/screenshots          - Upload screenshots`);
        console.log(`   POST /api/grading/grade                - Trigger grading`);
        console.log(`   GET  /api/grading/results/:sessionId   - Get results`);
        console.log(`\n🔑 API Key required for /api/* endpoints`);
        console.log(`🔒 CORS enabled for Chrome extensions`);
      }
    });

    // Graceful shutdown handling
    process.on('SIGTERM', this.gracefulShutdown.bind(this));
    process.on('SIGINT', this.gracefulShutdown.bind(this));
  }

  /**
   * Graceful shutdown
   */
  private gracefulShutdown(signal: string): void {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
    
    if (this.server) {
      this.server.close((err: Error) => {
        if (err) {
          console.error('❌ Error during server shutdown:', err);
          process.exit(1);
        }
        
        console.log('✅ Server closed successfully');
        console.log('👋 Nous-Grade Backend shutdown complete');
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        console.error('⏰ Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    } else {
      process.exit(0);
    }
  }

  /**
   * Get Express app instance (for testing)
   */
  public getApp(): express.Application {
    return this.app;
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const server = new NousGradeServer();
  server.start();
}

export default NousGradeServer;
