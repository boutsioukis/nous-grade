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
  private sessionExpiresAt: number | null = null;
  private static instance: BackendAPIService | null = null;
  private sessionCreationPromise: Promise<{ sessionId: string; expiresAt: string }> | null = null;
  private readonly sessionRenewBufferMs = 60 * 1000;

  constructor(config?: Partial<BackendConfig>) {
    this.config = { ...DEFAULT_BACKEND_CONFIG, ...config };
  }

  /**
   * Reset the current session (for new grading workflows)
   */
  resetSession(): void {
    this.currentSessionId = null;
    this.sessionExpiresAt = null;
    this.sessionCreationPromise = null;
    console.log('🔄 Backend session reset');
  }

  /**
   * Create a new grading session (or return existing one)
   */
  async createSession(force = false): Promise<{ sessionId: string; expiresAt: string }> {
    if (!force && this.isSessionValid()) {
      return {
        sessionId: this.currentSessionId as string,
        expiresAt: this.sessionExpiresAt
          ? new Date(this.sessionExpiresAt).toISOString()
          : new Date(Date.now() + 30 * 60 * 1000).toISOString()
      };
    }

    if (this.sessionCreationPromise) {
      return this.sessionCreationPromise;
    }

    this.sessionCreationPromise = this.requestSessionCreation()
      .then((response) => {
        this.setSessionMetadata(response.sessionId, response.expiresAt);
        return response;
      })
      .catch((error) => {
        this.clearSessionMetadata();
        console.error('🔴 Failed to create session:', error);
        throw error;
      })
      .finally(() => {
        this.sessionCreationPromise = null;
      });

    return this.sessionCreationPromise;
  }

  /**
   * Ensure there is an active backend session. Creates a new one if needed.
   */
  async ensureSession(): Promise<{ sessionId: string; expiresAt?: string; renewed: boolean }> {
    if (this.isSessionValid()) {
      return {
        sessionId: this.currentSessionId as string,
        expiresAt: this.sessionExpiresAt
          ? new Date(this.sessionExpiresAt).toISOString()
          : undefined,
        renewed: false
      };
    }

    const response = await this.createSession(true);
    return {
      sessionId: response.sessionId,
      expiresAt: response.expiresAt,
      renewed: true
    };
  }

  /**
   * Resume a previously created backend session.
   */
  resumeSession(sessionId: string, expiresAt?: string | number | null): void {
    if (!sessionId) {
      return;
    }

    this.setSessionMetadata(sessionId, expiresAt ?? null);
    this.sessionCreationPromise = null;

    console.log('🎯 Resumed backend session:', sessionId, {
      expiresAt: this.sessionExpiresAt ? new Date(this.sessionExpiresAt).toISOString() : null
    });
  }

  /**
   * Terminate the current backend session.
   */
  async endSession(): Promise<void> {
    if (!this.currentSessionId) {
      return;
    }

    const sessionId = this.currentSessionId;

    try {
      await this.makeRequest(
        `${API_ENDPOINTS.CREATE_SESSION}/${sessionId}`,
        {
          method: 'DELETE',
          headers: {
            'X-API-Key': this.config.apiKey || ''
          }
        }
      );
      console.log('🧹 Backend session deleted:', sessionId);
    } catch (error) {
      console.warn('🟡 Failed to delete backend session:', error);
    } finally {
      this.clearSessionMetadata();
    }
  }

  /**
   * Check whether the current session is still valid.
   */
  private isSessionValid(): boolean {
    if (!this.currentSessionId) {
      return false;
    }

    if (!this.sessionExpiresAt) {
      return true;
    }

    return Date.now() + this.sessionRenewBufferMs < this.sessionExpiresAt;
  }

  /**
   * Persist session metadata locally.
   */
  private setSessionMetadata(sessionId: string | null, expiresAt?: string | number | null): void {
    this.currentSessionId = sessionId;

    if (!expiresAt) {
      this.sessionExpiresAt = null;
      return;
    }

    if (typeof expiresAt === 'number') {
      this.sessionExpiresAt = expiresAt;
      return;
    }

    const parsed = Date.parse(expiresAt);
    this.sessionExpiresAt = Number.isNaN(parsed) ? null : parsed;
  }

  /**
   * Clear session metadata.
   */
  private clearSessionMetadata(): void {
    this.currentSessionId = null;
    this.sessionExpiresAt = null;
  }

  /**
   * Perform the backend request that creates a session.
   */
  private async requestSessionCreation(): Promise<{ sessionId: string; expiresAt: string }> {
    console.log('🎯 Creating new grading session...');

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

    console.log('🎯 Backend session created:', response.sessionId);
    console.log('🎯 Session expires at:', response.expiresAt);

    return response;
  }

  /**
   * Convert image to markdown using backend API
   */
  async convertImageToMarkdown(request: ImageToMarkdownRequest): Promise<ImageToMarkdownResponse> {
    console.log('🔵 Converting image to markdown for:', request.type);
    const startTime = Date.now();

    const sessionInfo = await this.ensureSession();
    if (sessionInfo.renewed) {
      console.log('🔄 Backend session renewed for image conversion');
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
            sessionId: sessionInfo.sessionId,
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

    const sessionInfo = await this.ensureSession();
    if (sessionInfo.renewed) {
      console.log('🔄 Backend session renewed for grading');
    }

    console.log('🔵 Using session ID for grading:', sessionInfo.sessionId);

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
            sessionId: sessionInfo.sessionId,
            studentAnswer: request.studentAnswer,
            professorAnswer: request.modelAnswer
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
          const results = await this.getResults(sessionInfo.sessionId);
          
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
        maxPoints: 10,
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
