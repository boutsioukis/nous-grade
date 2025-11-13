// AI grading processing routes
import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { 
  SessionStatus, 
  ScreenshotType,
  TriggerGradingRequest, 
  TriggerGradingResponse,
  GradingResult,
  ProcessingStep
} from '../types';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { getSession, updateSession } from './sessions';
import { UnifiedLLMClient } from '../services/unifiedLLMClient';

const router = Router();

// Initialize LLM client
const llmClient = new UnifiedLLMClient({
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4o-mini'
  }
});

/**
 * POST /api/grading/grade
 * Trigger AI grading process
 */
router.post('/grade', [
  body('sessionId').isUUID().withMessage('Invalid session ID format')
], asyncHandler(async (req: Request, res: Response) => {
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

  const requestData: TriggerGradingRequest = req.body;
  const { sessionId } = requestData;

  // Get session
  const session = getSession(sessionId);
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

  // Validate session has required OCR results
  const studentOCR = session.ocrResults.find(ocr => 
    session.screenshots.find(s => s.id === ocr.screenshotId)?.type === ScreenshotType.STUDENT_ANSWER
  );
  const professorOCR = session.ocrResults.find(ocr => 
    session.screenshots.find(s => s.id === ocr.screenshotId)?.type === ScreenshotType.PROFESSOR_ANSWER
  );

  if (!studentOCR || !professorOCR) {
    throw createError(
      'Insufficient OCR results for grading',
      400,
      'INSUFFICIENT_SCREENSHOTS',
      { 
        hasStudentOCR: !!studentOCR,
        hasProfessorOCR: !!professorOCR,
        requiredScreenshots: ['student_answer', 'professor_answer']
      }
    );
  }

  // Check if session is in correct state
  if (session.status !== SessionStatus.OCR_COMPLETE) {
    throw createError(
      'Session not ready for grading',
      400,
      'INVALID_SESSION_STATE',
      { 
        currentStatus: session.status,
        requiredStatus: SessionStatus.OCR_COMPLETE
      }
    );
  }

  console.log(`🎯 Starting AI grading for session ${sessionId}`, {
    studentTextLength: studentOCR.extractedText.length,
    professorTextLength: professorOCR.extractedText.length,
    studentConfidence: studentOCR.confidence,
    professorConfidence: professorOCR.confidence
  });

  try {
    const now = new Date();
    const gradingId = uuidv4();

    // Update session status to processing grading
    updateSession(sessionId, {
      status: SessionStatus.PROCESSING_GRADING,
      metadata: {
        ...session.metadata,
        processingSteps: [
          ...session.metadata.processingSteps,
          {
            step: 'grading_started',
            status: 'processing',
            startedAt: now,
            metadata: { 
              gradingId,
              model: 'claude-3-5-sonnet-20241022',
              studentOcrId: studentOCR.id,
              professorOcrId: professorOCR.id
            }
          }
        ]
      }
    });

    // Estimate completion time (Claude 4 Opus typically takes 10-30 seconds)
    const estimatedCompletionTime = 25000; // 25 seconds

    const response: TriggerGradingResponse = {
      gradingId,
      estimatedCompletionTime,
      status: SessionStatus.PROCESSING_GRADING
    };

    // Send immediate response
    res.status(202).json({
      success: true,
      data: response,
      message: 'Grading process initiated successfully'
    });

    // Process grading asynchronously
    processGradingAsync(sessionId, gradingId, studentOCR, professorOCR);

  } catch (error) {
    console.error(`🔴 Failed to initiate grading for session ${sessionId}:`, error);

    updateSession(sessionId, {
      status: SessionStatus.ERROR,
      metadata: {
        ...session.metadata,
        processingSteps: [
          ...session.metadata.processingSteps,
          {
            step: 'grading_failed',
            status: 'failed',
            startedAt: new Date(),
            completedAt: new Date(),
            error: error instanceof Error ? error.message : 'Grading initiation failed'
          }
        ]
      }
    });

    throw createError(
      'Failed to initiate grading process',
      500,
      'GRADING_PROCESSING_FAILED',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}));

/**
 * GET /api/grading/status/:sessionId
 * Get grading status for a session
 */
router.get('/status/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId;
  
  const session = getSession(sessionId);
  if (!session) {
    throw createError(
      'Session not found',
      404,
      'SESSION_NOT_FOUND',
      { sessionId }
    );
  }

  // Get latest processing steps
  const processingSteps = session.metadata.processingSteps;
  const latestStep = processingSteps[processingSteps.length - 1];

  const statusInfo = {
    sessionId,
    status: session.status,
    latestStep: latestStep?.step,
    stepStatus: latestStep?.status,
    hasGradingResult: !!session.gradingResult,
    processingSteps: processingSteps.map(step => ({
      step: step.step,
      status: step.status,
      startedAt: step.startedAt,
      completedAt: step.completedAt,
      error: step.error
    }))
  };

  console.log(`📊 Retrieved grading status for session ${sessionId}`, {
    status: session.status,
    latestStep: latestStep?.step,
    hasResult: !!session.gradingResult
  });

  res.json({
    success: true,
    data: statusInfo,
    message: 'Grading status retrieved successfully'
  });
}));

/**
 * Process grading asynchronously
 */
async function processGradingAsync(
  sessionId: string, 
  gradingId: string, 
  studentOCR: any, 
  professorOCR: any
): Promise<void> {
  try {
    console.log(`🎯 Processing grading for session ${sessionId} with Claude 4 Opus`);

    // Step 1: Grade with Claude 4 Opus
    const gradingResult = await llmClient.gradeAnswer(studentOCR, professorOCR);

    console.log(`✅ Claude 4 Opus grading completed`, {
      score: gradingResult.score,
      maxScore: gradingResult.maxScore,
      confidence: gradingResult.confidence,
      processingTime: gradingResult.processingTime
    });

    // Step 2: Generate suggested grade message with Claude Sonnet 4
    console.log(`📝 Generating suggested grade with Claude Sonnet 4`);
    const suggestedGrade = await llmClient.generateSuggestedGrade(gradingResult, studentOCR, professorOCR);

    console.log(`✅ Claude Sonnet 4 suggested grade completed`, {
      originalFeedbackLength: gradingResult.feedback.length,
      suggestedGradeLength: suggestedGrade.length
    });

    // Create final grading result
    const finalGradingResult: GradingResult = {
      id: gradingId,
      sessionId,
      studentOcrId: studentOCR.id,
      professorOcrId: professorOCR.id,
      score: gradingResult.score,
      maxScore: gradingResult.maxScore,
      feedback: gradingResult.feedback,
      suggestedGrade,
      detailedAnalysis: gradingResult.detailedAnalysis,
      confidence: gradingResult.confidence,
      processingTime: gradingResult.processingTime,
      model: gradingResult.model,
      gradedAt: new Date()
    };

    // Update session with completed grading
    const session = getSession(sessionId);
    if (session) {
      const completedSteps = session.metadata.processingSteps.map(step => {
        if (step.step === 'grading_started' && step.status === 'processing') {
          return {
            ...step,
            status: 'completed' as const,
            completedAt: new Date(),
            metadata: {
              ...step.metadata,
              score: finalGradingResult.score,
              maxScore: finalGradingResult.maxScore,
              confidence: finalGradingResult.confidence,
              processingTime: finalGradingResult.processingTime
            }
          };
        }
        return step;
      });

      updateSession(sessionId, {
        status: SessionStatus.GRADING_COMPLETE,
        gradingResult: finalGradingResult,
        metadata: {
          ...session.metadata,
          processingSteps: [
            ...completedSteps,
            {
              step: 'suggested_grade_generated',
              status: 'completed',
              startedAt: new Date(),
              completedAt: new Date(),
              metadata: {
                model: 'claude-3-5-sonnet-20241022',
                suggestedGradeLength: suggestedGrade.length
              }
            },
            {
              step: 'grading_complete',
              status: 'completed',
              startedAt: new Date(),
              completedAt: new Date(),
              metadata: {
                gradingId,
                finalScore: `${finalGradingResult.score}/${finalGradingResult.maxScore}`,
                confidence: finalGradingResult.confidence
              }
            }
          ]
        }
      });
    }

    console.log(`🎉 Grading process completed successfully for session ${sessionId}`, {
      gradingId,
      finalScore: `${finalGradingResult.score}/${finalGradingResult.maxScore}`,
      confidence: finalGradingResult.confidence,
      totalProcessingTime: finalGradingResult.processingTime
    });

  } catch (error) {
    console.error(`🔴 Grading processing failed for session ${sessionId}:`, error);

    // Update session with error
    const session = getSession(sessionId);
    if (session) {
      const failedSteps = session.metadata.processingSteps.map(step => {
        if (step.step === 'grading_started' && step.status === 'processing') {
          return {
            ...step,
            status: 'failed' as const,
            completedAt: new Date(),
            error: error instanceof Error ? error.message : 'Grading processing failed'
          };
        }
        return step;
      });

      updateSession(sessionId, {
        status: SessionStatus.ERROR,
        metadata: {
          ...session.metadata,
          processingSteps: failedSteps
        }
      });
    }
  }
}

export default router;
