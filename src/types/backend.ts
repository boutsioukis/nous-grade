// Backend API types and interfaces for Phase 4

export interface ImageToMarkdownRequest {
  imageData: string; // Base64 encoded image
  type: 'student' | 'professor';
}

export interface ImageToMarkdownResponse {
  markdown: string;
  confidence: number;
  processingTime: number;
  success: boolean;
  error?: string;
}

export interface GradeAnswerRequest {
  studentAnswer: string;
  modelAnswer: string;
  gradingScheme?: string;
  maxPoints?: number;
}

export interface GradeAnswerResponse {
  gradedAnswer: string;
  points: number;
  maxPoints: number;
  reasoning: string;
  feedback: string;
  confidence: number;
  processingTime: number;
  success: boolean;
  error?: string;
}

export interface SessionData {
  sessionId: string;
  timestamp: number;
  studentImageData?: string;
  professorImageData?: string;
  studentMarkdown?: string;
  professorMarkdown?: string;
  gradingResult?: GradeAnswerResponse;
  status: 'capturing' | 'processing' | 'editing' | 'grading' | 'completed';
}

export interface BackendConfig {
  baseUrl: string;
  apiKey?: string;
  timeout: number;
  retryAttempts: number;
}

// API endpoint definitions
export const API_ENDPOINTS = {
  IMAGE_TO_MARKDOWN: '/api/grading/screenshots',
  GRADE_ANSWER: '/api/grading/grade',
  HEALTH_CHECK: '/health',
  CREATE_SESSION: '/api/grading/sessions',
  GET_RESULTS: '/api/grading/results'
} as const;

// Default backend configuration
export const DEFAULT_BACKEND_CONFIG: BackendConfig = {
  baseUrl: 'http://localhost:3001', // Local development server
  apiKey: 'nous-grade-api-key-2024', // API key for authentication
  timeout: 30000, // 30 seconds
  retryAttempts: 3
};

// Processing status types
export type ProcessingStatus = 
  | 'idle'
  | 'capturing-student'
  | 'capturing-professor'
  | 'processing'
  | 'converting-student'
  | 'converting-professor'
  | 'editing'
  | 'grading'
  | 'completed'
  | 'error';

export interface ProcessingState {
  status: ProcessingStatus;
  progress: number; // 0-100
  message: string;
  error?: string;
}
