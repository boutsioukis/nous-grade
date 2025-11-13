// Backend API service for handling all API communications

import { 
  ImageToMarkdownRequest, 
  ImageToMarkdownResponse,
  GradeAnswerRequest,
  GradeAnswerResponse,
  BackendConfig,
  DEFAULT_BACKEND_CONFIG,
  API_ENDPOINTS
} from '../types/backend';
// Removed mock backend and local OCR - using real backend API

export class BackendAPIService {
  private config: BackendConfig;
  // Always use real backend - no more mock or local OCR
  private currentSessionId: string | null = null;
  private static instance: BackendAPIService | null = null;
  private sessionCreationPromise: Promise<string> | null = null;

  constructor(config?: Partial<BackendConfig>) {
    this.config = { ...DEFAULT_BACKEND_CONFIG, ...config };
  }

  /**
   * Reset the current session (for new grading workflows)
   */
  resetSession(): void {
    this.currentSessionId = null;
    this.sessionCreationPromise = null;
    console.log('🔄 Backend session reset');
  }

  /**
   * Create a new grading session (or return existing one)
   */
  async createSession(): Promise<{ sessionId: string; expiresAt: string }> {
    // If we already have a session, return it
    if (this.currentSessionId) {
      console.log('🎯 Using existing backend session:', this.currentSessionId);
      return { 
        sessionId: this.currentSessionId, 
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes from now
      };
    }

    console.log('🎯 Creating new grading session...');
    
    try {
      const response = await this.makeRequest<{ sessionId: string; expiresAt: string }>(
        API_ENDPOINTS.CREATE_SESSION,
        {
          method: 'POST',
          body: JSON.stringify({
            metadata: {
              extensionVersion: '1.0.0',
              userAgent: navigator.userAgent
            }
          }),
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.config.apiKey || ''
          }
        }
      );

      this.currentSessionId = response.sessionId;
      console.log('🎯 Backend session created:', response.sessionId);
      console.log('🎯 Session expires at:', response.expiresAt);
      return response;
    } catch (error) {
      console.error('🔴 Failed to create session:', error);
      throw error;
    }
  }

  /**
   * Convert image to markdown using backend API
   */
  async convertImageToMarkdown(request: ImageToMarkdownRequest): Promise<ImageToMarkdownResponse> {
    console.log('🔵 Converting image to markdown for:', request.type);
    const startTime = Date.now();

    // Ensure we have a session (thread-safe)
    if (!this.currentSessionId && !this.sessionCreationPromise) {
      this.sessionCreationPromise = this.createSession().then(result => {
        this.currentSessionId = result.sessionId;
        this.sessionCreationPromise = null;
        return result.sessionId;
      });
    }
    
    if (this.sessionCreationPromise) {
      await this.sessionCreationPromise;
    }

    try {
      const response = await this.makeRequest<{
        screenshotId: string;
        ocrResult: {
          extractedText: string;
          confidence: number;
          processingTime: number;
        };
        sessionStatus: string;
        readyForGrading: boolean;
      }>(
        API_ENDPOINTS.IMAGE_TO_MARKDOWN,
        {
          method: 'POST',
          body: JSON.stringify({
            sessionId: this.currentSessionId,
            type: request.type === 'student' ? 'student_answer' : 'professor_answer',
            imageData: request.imageData
          }),
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.config.apiKey || ''
          }
        }
      );

      const processingTime = Date.now() - startTime;
      console.log(`🔵 Image conversion completed in ${processingTime}ms`);
      console.log(`🔵 Session status after upload: ${response.sessionStatus}`);
      console.log(`🔵 Ready for grading: ${response.readyForGrading}`);

      // Convert the backend response to our expected format
      const markdown = `# ${request.type === 'student' ? 'Student' : 'Professor'} Answer\n\n${response.ocrResult.extractedText}`;

      return {
        markdown,
        confidence: response.ocrResult.confidence,
        processingTime,
        success: true
      };

    } catch (error) {
      console.error('🔴 Image conversion failed:', error);
      
      return {
        markdown: '',
        confidence: 0,
        processingTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Grade student answer using backend AI
   */
  async gradeAnswer(request: GradeAnswerRequest): Promise<GradeAnswerResponse> {
    console.log('🔵 Starting AI grading process');
    const startTime = Date.now();

    // Ensure we have a session
    if (!this.currentSessionId) {
      throw new Error('No active session. Please upload screenshots first.');
    }

    console.log('🔵 Using session ID for grading:', this.currentSessionId);

    try {
      // Trigger grading
      const gradeResponse = await this.makeRequest<{
        gradingId: string;
        estimatedCompletionTime: number;
        status: string;
      }>(
        API_ENDPOINTS.GRADE_ANSWER,
        {
          method: 'POST',
          body: JSON.stringify({
            sessionId: this.currentSessionId
          }),
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.config.apiKey || ''
          }
        }
      );

      console.log('🔵 Grading initiated, waiting for completion...');

      // Poll for results
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds max wait
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        
        try {
          const results = await this.getResults(this.currentSessionId);
          
          if (results.session.status === 'grading_complete' && results.gradingResult) {
            const processingTime = Date.now() - startTime;
            console.log(`🔵 AI grading completed in ${processingTime}ms`);

            const suggestedGrade = results.gradingResult.suggestedGrade || results.gradingResult.feedback || '';

            return {
              gradedAnswer: suggestedGrade,
              points: results.gradingResult.score,
              maxPoints: results.gradingResult.maxScore,
              suggestedGrade,
              feedback: results.gradingResult.feedback || suggestedGrade,
              confidence: results.gradingResult.confidence,
              processingTime,
              success: true
            };
          }
          
          if (results.session.status === 'error') {
            throw new Error('Grading failed on backend');
          }
          
        } catch (pollError) {
          console.warn('🟡 Polling attempt failed:', pollError);
        }
        
        attempts++;
      }

      throw new Error('Grading timeout - results not available within expected time');

    } catch (error) {
      console.error('🔴 AI grading failed:', error);
      
      return {
        gradedAnswer: '',
        points: 0,
        maxPoints: request.maxPoints || 10,
        suggestedGrade: '',
        feedback: '',
        confidence: 0,
        processingTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get results for a session
   */
  async getResults(sessionId: string): Promise<{
    session: any;
    gradingResult?: {
      score: number;
      maxScore: number;
      feedback: string;
      suggestedGrade?: string;
      confidence: number;
    };
    ocrResults: any[];
  }> {
    const response = await this.makeRequest<{
      session: any;
      gradingResult?: any;
      ocrResults: any[];
    }>(
      `${API_ENDPOINTS.GET_RESULTS}/${sessionId}`,
      {
        method: 'GET',
        headers: {
          'X-API-Key': this.config.apiKey || ''
        }
      }
    );

    return response;
  }

  /**
   * Check backend API health
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      const response = await this.makeRequest<{ status: string; version: string }>(
        API_ENDPOINTS.HEALTH_CHECK,
        { method: 'GET' }
      );

      return {
        healthy: response.status === 'ok',
        message: `Backend healthy (v${response.version})`
      };

    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Health check failed'
      };
    }
  }

  // Removed local OCR methods - using backend API for all processing

  /**
   * Generic request method with retry logic
   */
  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit,
    attempt: number = 1
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    try {
      console.log(`🔵 API Request (attempt ${attempt}):`, { url, method: options.method });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as any;
      console.log('🔵 API Response received:', { status: response.status, dataKeys: Object.keys(data) });
      
      // Handle the backend's response format: { success: boolean, data: T, message?: string }
      if (data.success === false) {
        throw new Error(data.error?.message || 'Backend request failed');
      }
      
      // Return the data portion for successful responses
      return data.data || data;

    } catch (error) {
      console.error(`🔴 API Request failed (attempt ${attempt}):`, error);

      // Retry logic
      if (attempt < this.config.retryAttempts && this.shouldRetry(error)) {
        console.log(`🔵 Retrying request in ${attempt * 1000}ms...`);
        await this.delay(attempt * 1000);
        return this.makeRequest<T>(endpoint, options, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Determine if request should be retried
   */
  private shouldRetry(error: unknown): boolean {
    if (error instanceof Error) {
      // Retry on network errors, timeouts, and 5xx server errors
      return error.name === 'AbortError' || 
             error.message.includes('fetch') ||
             error.message.includes('5');
    }
    return false;
  }

  /**
   * Delay utility for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<BackendConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🔵 Backend API config updated:', this.config);
  }

  // Mock mode methods removed - always using real backend
}

// Singleton instance for use across the extension
export const backendAPI = new BackendAPIService();
