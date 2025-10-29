// Session management routes
import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { 
  GradingSession, 
  SessionStatus, 
  CreateSessionRequest, 
  CreateSessionResponse,
  GetResultsResponse,
  ProcessingStep
} from '../types';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// In-memory session storage for MVP (replace with database in production)
const sessions = new Map<string, GradingSession>();

/**
 * POST /api/grading/sessions
 * Create a new grading session
 */
router.post('/', [
  body('professorId').optional().isString().trim(),
  body('assignmentId').optional().isString().trim(),
  body('metadata.userAgent').isString().notEmpty(),
  body('metadata.extensionVersion').isString().notEmpty()
], asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError(
      'Validation failed',
      400,
      'VALIDATION_ERROR',
      { errors: errors.array() }
    );
  }

  const requestData: CreateSessionRequest = req.body;
  
  // Create new session
  const sessionId = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + parseInt(process.env.SESSION_TIMEOUT_MS || '1800000', 10));

  const session: GradingSession = {
    id: sessionId,
    status: SessionStatus.INITIALIZED,
    createdAt: now,
    updatedAt: now,
    expiresAt: expiresAt,
    professorId: requestData.professorId,
    assignmentId: requestData.assignmentId,
    screenshots: [],
    ocrResults: [],
    metadata: {
      userAgent: requestData.metadata.userAgent,
      ipAddress: req.ip || 'unknown',
      extensionVersion: requestData.metadata.extensionVersion,
      processingSteps: [
        {
          step: 'session_created',
          status: 'completed',
          startedAt: now,
          completedAt: now,
          metadata: {
            sessionId,
            clientInfo: req.clientInfo
          }
        }
      ]
    }
  };

  // Store session
  sessions.set(sessionId, session);

  console.log(`🎯 Created new grading session: ${sessionId}`, {
    professorId: session.professorId,
    assignmentId: session.assignmentId,
    expiresAt: session.expiresAt,
    extensionVersion: session.metadata.extensionVersion
  });

  // Update session status
  updateSessionStatus(sessionId, SessionStatus.AWAITING_SCREENSHOTS, 'awaiting_screenshots');

  const response: CreateSessionResponse = {
    sessionId: session.id,
    status: session.status,
    expiresAt: session.expiresAt
  };

  res.status(201).json({
    success: true,
    data: response,
    message: 'Grading session created successfully'
  });
}));

/**
 * GET /api/grading/sessions/:sessionId
 * Get session details
 */
router.get('/:sessionId', [
  param('sessionId').isUUID().withMessage('Invalid session ID format')
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError(
      'Invalid session ID',
      400,
      'VALIDATION_ERROR',
      { errors: errors.array() }
    );
  }

  const sessionId = req.params.sessionId;
  const session = sessions.get(sessionId);

  if (!session) {
    throw createError(
      'Session not found',
      404,
      'SESSION_NOT_FOUND',
      { sessionId }
    );
  }

  // Check if session is expired
  if (new Date() > session.expiresAt) {
    updateSessionStatus(sessionId, SessionStatus.EXPIRED, 'session_expired');
    throw createError(
      'Session has expired',
      410,
      'SESSION_EXPIRED',
      { sessionId, expiresAt: session.expiresAt }
    );
  }

  console.log(`📋 Retrieved session details: ${sessionId}`, {
    status: session.status,
    screenshotCount: session.screenshots.length,
    ocrResultCount: session.ocrResults.length
  });

  res.json({
    success: true,
    data: session,
    message: 'Session retrieved successfully'
  });
}));

/**
 * GET /api/grading/results/:sessionId
 * Get grading results for a session
 */
router.get('/results/:sessionId', [
  param('sessionId').isUUID().withMessage('Invalid session ID format')
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError(
      'Invalid session ID',
      400,
      'VALIDATION_ERROR',
      { errors: errors.array() }
    );
  }

  const sessionId = req.params.sessionId;
  const session = sessions.get(sessionId);

  if (!session) {
    throw createError(
      'Session not found',
      404,
      'SESSION_NOT_FOUND',
      { sessionId }
    );
  }

  // Check if session is expired
  if (new Date() > session.expiresAt) {
    throw createError(
      'Session has expired',
      410,
      'SESSION_EXPIRED',
      { sessionId, expiresAt: session.expiresAt }
    );
  }

  const response: GetResultsResponse = {
    session: session,
    gradingResult: session.gradingResult,
    ocrResults: session.ocrResults
  };

  console.log(`📊 Retrieved grading results: ${sessionId}`, {
    hasGradingResult: !!session.gradingResult,
    ocrResultCount: session.ocrResults.length,
    status: session.status
  });

  res.json({
    success: true,
    data: response,
    message: 'Results retrieved successfully'
  });
}));

/**
 * DELETE /api/grading/sessions/:sessionId
 * Delete a session (cleanup)
 */
router.delete('/:sessionId', [
  param('sessionId').isUUID().withMessage('Invalid session ID format')
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError(
      'Invalid session ID',
      400,
      'VALIDATION_ERROR',
      { errors: errors.array() }
    );
  }

  const sessionId = req.params.sessionId;
  const session = sessions.get(sessionId);

  if (!session) {
    throw createError(
      'Session not found',
      404,
      'SESSION_NOT_FOUND',
      { sessionId }
    );
  }

  // Remove session from storage
  sessions.delete(sessionId);

  console.log(`🗑️ Deleted session: ${sessionId}`);

  res.json({
    success: true,
    message: 'Session deleted successfully'
  });
}));

/**
 * Helper function to update session status
 */
function updateSessionStatus(sessionId: string, status: SessionStatus, step: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;

  const now = new Date();
  session.status = status;
  session.updatedAt = now;

  // Add processing step
  const processingStep: ProcessingStep = {
    step,
    status: 'completed',
    startedAt: now,
    completedAt: now
  };

  session.metadata.processingSteps.push(processingStep);
  sessions.set(sessionId, session);
}

/**
 * Helper function to get session (used by other routes)
 */
export function getSession(sessionId: string): GradingSession | undefined {
  return sessions.get(sessionId);
}

/**
 * Helper function to update session (used by other routes)
 */
export function updateSession(sessionId: string, updates: Partial<GradingSession>): void {
  const session = sessions.get(sessionId);
  if (!session) return;

  Object.assign(session, updates, { updatedAt: new Date() });
  sessions.set(sessionId, session);
}

export default router;
