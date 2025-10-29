// Screenshot upload and OCR processing routes
import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { 
  Screenshot, 
  ScreenshotType, 
  SessionStatus, 
  UploadScreenshotRequest, 
  UploadScreenshotResponse,
  OCRResult,
  ImageMetadata,
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
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY!,
    gradingModel: 'claude-3-opus-20240229',
    feedbackModel: 'claude-3-5-sonnet-20241022'
  }
});

/**
 * POST /api/grading/screenshots
 * Upload screenshot and trigger OCR processing
 */
router.post('/', [
  body('sessionId').isUUID().withMessage('Invalid session ID format'),
  body('type').isIn(['student_answer', 'professor_answer']).withMessage('Invalid screenshot type'),
  body('imageData').isString().notEmpty().withMessage('Image data is required')
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

  const requestData: UploadScreenshotRequest = req.body;
  const { sessionId, type, imageData } = requestData;

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

  // Validate image data format
  if (!imageData.startsWith('data:image/')) {
    throw createError(
      'Invalid image format',
      400,
      'INVALID_IMAGE_FORMAT',
      { expectedFormat: 'data:image/png;base64,... or data:image/jpeg;base64,...' }
    );
  }

  // Check image size
  const imageSizeBytes = Math.round(imageData.length * 0.75); // Approximate size after base64 decoding
  const maxSizeBytes = parseInt(process.env.MAX_FILE_SIZE || '10485760', 10);
  if (imageSizeBytes > maxSizeBytes) {
    throw createError(
      'Image too large',
      413,
      'IMAGE_TOO_LARGE',
      { 
        imageSize: imageSizeBytes,
        maxSize: maxSizeBytes,
        maxSizeMB: Math.round(maxSizeBytes / 1024 / 1024)
      }
    );
  }

  console.log(`📸 Processing screenshot upload for session ${sessionId}`, {
    type,
    imageSizeKB: Math.round(imageSizeBytes / 1024),
    format: imageData.substring(0, 30) + '...'
  });

  try {
    // Create screenshot record
    const screenshotId = uuidv4();
    const now = new Date();
    
    // Extract image metadata
    const imageMetadata: ImageMetadata = extractImageMetadata(imageData);
    
    const screenshot: Screenshot = {
      id: screenshotId,
      sessionId,
      type: type as ScreenshotType,
      imageData,
      uploadedAt: now,
      metadata: imageMetadata
    };

    // Add screenshot to session
    session.screenshots.push(screenshot);
    
    // Update session status to processing OCR
    updateSession(sessionId, {
      status: SessionStatus.PROCESSING_OCR,
      screenshots: session.screenshots,
      metadata: {
        ...session.metadata,
        processingSteps: [
          ...session.metadata.processingSteps,
          {
            step: `screenshot_uploaded_${type}`,
            status: 'completed',
            startedAt: now,
            completedAt: now,
            metadata: { screenshotId, type, imageSizeBytes }
          },
          {
            step: `ocr_processing_${type}`,
            status: 'processing',
            startedAt: now,
            metadata: { screenshotId, model: 'gpt-4o-mini' }
          }
        ]
      }
    });

    console.log(`🔍 Starting OCR processing for ${type} screenshot`);

    // Process OCR using GPT-4o mini
    const ocrResult = await llmClient.extractTextFromImage(imageData, type as 'student_answer' | 'professor_answer');
    
    // Update OCR result with IDs
    ocrResult.id = uuidv4();
    ocrResult.screenshotId = screenshotId;
    ocrResult.sessionId = sessionId;

    // Add OCR result to session
    session.ocrResults.push(ocrResult);

    console.log(`✅ OCR processing completed for ${type}`, {
      confidence: ocrResult.confidence,
      textLength: ocrResult.extractedText.length,
      processingTime: ocrResult.processingTime,
      hasMath: ocrResult.metadata.mathContent
    });

    // Update processing step as completed
    const updatedSteps = session.metadata.processingSteps.map(step => {
      if (step.step === `ocr_processing_${type}` && step.status === 'processing') {
        return {
          ...step,
          status: 'completed' as const,
          completedAt: new Date(),
          metadata: {
            ...step.metadata,
            confidence: ocrResult.confidence,
            textLength: ocrResult.extractedText.length,
            processingTime: ocrResult.processingTime
          }
        };
      }
      return step;
    });

    // Check if we have both screenshots
    const hasStudentScreenshot = session.screenshots.some(s => s.type === ScreenshotType.STUDENT_ANSWER);
    const hasProfessorScreenshot = session.screenshots.some(s => s.type === ScreenshotType.PROFESSOR_ANSWER);
    const readyForGrading = hasStudentScreenshot && hasProfessorScreenshot;

    // Update session status
    const newStatus = readyForGrading ? SessionStatus.OCR_COMPLETE : SessionStatus.AWAITING_SCREENSHOTS;
    
    updateSession(sessionId, {
      status: newStatus,
      ocrResults: session.ocrResults,
      metadata: {
        ...session.metadata,
        processingSteps: readyForGrading ? [
          ...updatedSteps,
          {
            step: 'ready_for_grading',
            status: 'completed',
            startedAt: new Date(),
            completedAt: new Date(),
            metadata: { 
              totalScreenshots: session.screenshots.length,
              totalOcrResults: session.ocrResults.length
            }
          }
        ] : updatedSteps
      }
    });

    const response: UploadScreenshotResponse = {
      screenshotId,
      ocrResult,
      sessionStatus: newStatus,
      readyForGrading
    };

    console.log(`📊 Screenshot processing complete for session ${sessionId}`, {
      screenshotId,
      readyForGrading,
      sessionStatus: newStatus,
      totalScreenshots: session.screenshots.length
    });

    res.status(201).json({
      success: true,
      data: response,
      message: `Screenshot uploaded and OCR processing completed for ${type}`
    });

  } catch (error) {
    console.error(`🔴 OCR processing failed for ${type}:`, error);

    // Update processing step as failed
    const failedSteps = session.metadata.processingSteps.map(step => {
      if (step.step === `ocr_processing_${type}` && step.status === 'processing') {
        return {
          ...step,
          status: 'failed' as const,
          completedAt: new Date(),
          error: error instanceof Error ? error.message : 'OCR processing failed'
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

    throw createError(
      'OCR processing failed',
      500,
      'OCR_PROCESSING_FAILED',
      { 
        screenshotType: type,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    );
  }
}));

/**
 * GET /api/grading/screenshots/:sessionId
 * Get all screenshots for a session
 */
router.get('/:sessionId', asyncHandler(async (req: Request, res: Response) => {
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

  console.log(`📋 Retrieved screenshots for session ${sessionId}`, {
    count: session.screenshots.length,
    types: session.screenshots.map(s => s.type)
  });

  res.json({
    success: true,
    data: {
      sessionId,
      screenshots: session.screenshots.map(screenshot => ({
        ...screenshot,
        imageData: screenshot.imageData.substring(0, 50) + '...' // Truncate for response
      })),
      ocrResults: session.ocrResults
    },
    message: 'Screenshots retrieved successfully'
  });
}));

/**
 * Extract image metadata from base64 data
 */
function extractImageMetadata(imageData: string): ImageMetadata {
  // Extract format from data URL
  const formatMatch = imageData.match(/^data:image\/([^;]+)/);
  const format = formatMatch ? formatMatch[1].toUpperCase() : 'UNKNOWN';
  
  // Calculate size (approximate)
  const sizeInBytes = Math.round(imageData.length * 0.75);
  
  // Generate checksum
  const checksum = crypto.createHash('md5').update(imageData).digest('hex');
  
  // For MVP, we'll use default dimensions (would need image processing library for actual dimensions)
  const dimensions = {
    width: 1920, // Default/estimated
    height: 1080  // Default/estimated
  };

  return {
    format,
    size: sizeInBytes,
    dimensions,
    checksum
  };
}

export default router;
