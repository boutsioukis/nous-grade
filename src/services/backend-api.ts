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
import { mockBackend } from './mock-backend';

export class BackendAPIService {
  private config: BackendConfig;
  private useMockBackend: boolean = true; // Set to false when real backend is available

  constructor(config?: Partial<BackendConfig>) {
    this.config = { ...DEFAULT_BACKEND_CONFIG, ...config };
  }

  /**
   * Convert image to markdown using backend API
   */
  async convertImageToMarkdown(request: ImageToMarkdownRequest): Promise<ImageToMarkdownResponse> {
    console.log('🔵 Converting image to markdown for:', request.type);
    const startTime = Date.now();

    // Use mock backend for testing
    if (this.useMockBackend) {
      console.log('🟡 Using mock backend for image conversion');
      return await mockBackend.convertImageToMarkdown(request);
    }

    try {
      const response = await this.makeRequest<ImageToMarkdownResponse>(
        API_ENDPOINTS.IMAGE_TO_MARKDOWN,
        {
          method: 'POST',
          body: JSON.stringify(request),
          headers: {
            'Content-Type': 'application/json',
            ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
          }
        }
      );

      const processingTime = Date.now() - startTime;
      console.log(`🔵 Image conversion completed in ${processingTime}ms`);

      return {
        ...response,
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

    // Use mock backend for testing
    if (this.useMockBackend) {
      console.log('🟡 Using mock backend for AI grading');
      return await mockBackend.gradeAnswer(request);
    }

    try {
      const response = await this.makeRequest<GradeAnswerResponse>(
        API_ENDPOINTS.GRADE_ANSWER,
        {
          method: 'POST',
          body: JSON.stringify(request),
          headers: {
            'Content-Type': 'application/json',
            ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
          }
        }
      );

      const processingTime = Date.now() - startTime;
      console.log(`🔵 AI grading completed in ${processingTime}ms`);

      return {
        ...response,
        processingTime,
        success: true
      };

    } catch (error) {
      console.error('🔴 AI grading failed:', error);
      
      return {
        gradedAnswer: '',
        points: 0,
        maxPoints: request.maxPoints || 10,
        reasoning: '',
        feedback: '',
        confidence: 0,
        processingTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Check backend API health
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    // Use mock backend for testing
    if (this.useMockBackend) {
      console.log('🟡 Using mock backend for health check');
      return await mockBackend.healthCheck();
    }

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

      const data = await response.json();
      console.log('🔵 API Response received:', { status: response.status, dataKeys: Object.keys(data) });
      
      return data;

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

  /**
   * Toggle mock backend mode
   */
  setMockMode(useMock: boolean): void {
    this.useMockBackend = useMock;
    console.log('🔵 Mock backend mode:', useMock ? 'enabled' : 'disabled');
  }

  /**
   * Get current mock mode status
   */
  isMockMode(): boolean {
    return this.useMockBackend;
  }
}

// Singleton instance for use across the extension
export const backendAPI = new BackendAPIService();
