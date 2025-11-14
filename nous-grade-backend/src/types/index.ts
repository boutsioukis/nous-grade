// Core types for the Nous-Grade Backend API

export interface GradingSession {
  id: string;
  status: SessionStatus;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  professorId?: string;
  studentId?: string;
  assignmentId?: string;
  screenshots: Screenshot[];
  ocrResults: OCRResult[];
  gradingResult?: GradingResult;
  metadata: SessionMetadata;
}

export enum SessionStatus {
  INITIALIZED = 'initialized',
  AWAITING_SCREENSHOTS = 'awaiting_screenshots',
  PROCESSING_OCR = 'processing_ocr',
  OCR_COMPLETE = 'ocr_complete',
  PROCESSING_GRADING = 'processing_grading',
  GRADING_COMPLETE = 'grading_complete',
  EXPIRED = 'expired',
  ERROR = 'error'
}

export interface Screenshot {
  id: string;
  sessionId: string;
  type: ScreenshotType;
  imageData: string; // Base64 encoded
  uploadedAt: Date;
  metadata: ImageMetadata;
}

export enum ScreenshotType {
  STUDENT_ANSWER = 'student_answer',
  PROFESSOR_ANSWER = 'professor_answer'
}

export interface ImageMetadata {
  format: string;
  size: number;
  dimensions: {
    width: number;
    height: number;
  };
  checksum: string;
}

export interface OCRResult {
  id: string;
  screenshotId: string;
  sessionId: string;
  extractedText: string;
  confidence: number;
  processingTime: number;
  model: string; // 'gpt-4o-mini'
  processedAt: Date;
}

export interface GradingResult {
  id: string;
  sessionId: string;
  studentOcrId: string;
  professorOcrId: string;
  score: number;
  maxScore: number;
  feedback: string;
  suggestedGrade: string;
  detailedAnalysis: DetailedAnalysis;
  confidence: number;
  processingTime: number;
  model: string; // 'claude-4-opus'
  gradedAt: Date;
}

export interface DetailedAnalysis {
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  rubricBreakdown: RubricItem[];
  comparisonNotes: string;
}

export interface RubricItem {
  criterion: string;
  points: number;
  maxPoints: number;
  feedback: string;
}

export interface SessionMetadata {
  userAgent: string;
  ipAddress: string;
  extensionVersion: string;
  processingSteps: ProcessingStep[];
}

export interface ProcessingStep {
  step: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  metadata?: Record<string, any>;
}

// API Request/Response types
export interface CreateSessionRequest {
  professorId?: string;
  assignmentId?: string;
  metadata: {
    userAgent: string;
    extensionVersion: string;
  };
}

export interface CreateSessionResponse {
  sessionId: string;
  status: SessionStatus;
  expiresAt: Date;
}

export interface UploadScreenshotRequest {
  sessionId: string;
  type: ScreenshotType;
  imageData: string;
}

export interface UploadScreenshotResponse {
  screenshotId: string;
  ocrResult?: OCRResult;
  sessionStatus: SessionStatus;
  readyForGrading: boolean;
}

export interface TriggerGradingRequest {
  sessionId: string;
  studentAnswer?: string;
  professorAnswer?: string;
  modelAnswer?: string;
}

export interface TriggerGradingResponse {
  gradingId: string;
  estimatedCompletionTime: number;
  status: SessionStatus;
}

export interface GetResultsResponse {
  session: GradingSession;
  gradingResult?: GradingResult;
  ocrResults: OCRResult[];
}

// Error types
export interface APIError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
}

export enum ErrorCode {
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  INVALID_IMAGE_FORMAT = 'INVALID_IMAGE_FORMAT',
  IMAGE_TOO_LARGE = 'IMAGE_TOO_LARGE',
  OCR_PROCESSING_FAILED = 'OCR_PROCESSING_FAILED',
  GRADING_PROCESSING_FAILED = 'GRADING_PROCESSING_FAILED',
  INSUFFICIENT_SCREENSHOTS = 'INSUFFICIENT_SCREENSHOTS',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR'
}
