// Session management service for handling grading workflow state

import { SessionData, ProcessingState, ProcessingStatus } from '../types/backend';
import { backendAPI } from './backend-api';

export class SessionManager {
  private currentSession: SessionData | null = null;
  private processingState: ProcessingState = {
    status: 'idle',
    progress: 0,
    message: 'Ready to start grading'
  };

  /**
   * Create a new grading session
   */
  async createSession(): Promise<string> {
    // Check if we already have a session
    if (this.currentSession) {
      await this.ensureBackendSessionActive();
      console.log('🟢 Session already exists, returning existing session:', this.currentSession.sessionId);
      return this.currentSession.sessionId;
    }
    
    backendAPI.resetSession();
    const backendSession = await backendAPI.createSession();
    
    const sessionId = this.generateSessionId();
    
    this.currentSession = {
      sessionId,
      timestamp: Date.now(),
      status: 'capturing',
      backendSessionId: backendSession.sessionId,
      backendSessionExpiresAt: backendSession.expiresAt ? Date.parse(backendSession.expiresAt) : undefined
    };

    // Store session in Chrome storage
    await chrome.storage.local.set({
      [`session_${sessionId}`]: this.currentSession,
      'current_session_id': sessionId
    });

    console.log('🟢 New grading session created:', sessionId, {
      backendSessionId: backendSession.sessionId
    });
    return sessionId;
  }

  /**
   * Load existing session
   */
  async loadSession(sessionId?: string): Promise<SessionData | null> {
    try {
      let targetSessionId = sessionId;
      
      if (!targetSessionId) {
        // Load current session
        const result = await chrome.storage.local.get('current_session_id');
        targetSessionId = result.current_session_id;
      }

      if (!targetSessionId) {
        return null;
      }

      const result = await chrome.storage.local.get(`session_${targetSessionId}`);
      const sessionData = result[`session_${targetSessionId}`];

      if (sessionData) {
        this.currentSession = sessionData;
        console.log('🟢 Session loaded:', targetSessionId);
        await this.ensureBackendSessionActive();
        return this.currentSession;
      }

      return null;

    } catch (error) {
      console.error('🔴 Error loading session:', error);
      return null;
    }
  }

  /**
   * Update current session data
   */
  async updateSession(updates: Partial<SessionData>): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session to update');
    }

    this.currentSession = {
      ...this.currentSession,
      ...updates,
      timestamp: Date.now()
    };

    // Save to storage
    await chrome.storage.local.set({
      [`session_${this.currentSession.sessionId}`]: this.currentSession
    });

    console.log('🟢 Session updated:', this.currentSession.sessionId, updates);
  }

  /**
   * Update processing state
   */
  updateProcessingState(state: Partial<ProcessingState>): void {
    this.processingState = {
      ...this.processingState,
      ...state
    };

    console.log('🟢 Processing state updated:', this.processingState);

    // Broadcast state change to UI
    this.broadcastProcessingState();
  }

  /**
   * Get current session
   */
  getCurrentSession(): SessionData | null {
    return this.currentSession;
  }

  /**
   * Get current processing state
   */
  getProcessingState(): ProcessingState {
    return this.processingState;
  }

  /**
   * Ensure both local and backend sessions are active.
   */
  async ensureActiveSession(): Promise<void> {
    if (!this.currentSession) {
      const restoredSession = await this.loadSession();
      if (restoredSession) {
        return;
      }

      await this.createSession();
      return;
    }

    await this.ensureBackendSessionActive();
  }

  /**
   * Make sure the backend session matches the stored metadata.
   */
  private async ensureBackendSessionActive(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    if (this.currentSession.backendSessionId) {
      backendAPI.resumeSession(
        this.currentSession.backendSessionId,
        this.currentSession.backendSessionExpiresAt ?? null
      );
    }

    const sessionInfo = await backendAPI.ensureSession();
    const parsedExpiry = sessionInfo.expiresAt ? Date.parse(sessionInfo.expiresAt) : NaN;
    const expiresAtMs = Number.isNaN(parsedExpiry) ? undefined : parsedExpiry;

    const backendChanged =
      !this.currentSession.backendSessionId ||
      this.currentSession.backendSessionId !== sessionInfo.sessionId ||
      (this.currentSession.backendSessionExpiresAt ?? null) !== (expiresAtMs ?? null);

    if (backendChanged) {
      await this.updateSession({
        backendSessionId: sessionInfo.sessionId,
        backendSessionExpiresAt: expiresAtMs
      });
    }
  }

  /**
   * Store captured image data
   */
  async storeCapturedImage(type: 'student' | 'professor', imageData: string): Promise<void> {
    await this.ensureActiveSession();

    if (!this.currentSession) {
      throw new Error('Failed to initialize session');
    }

    const updates: Partial<SessionData> = {};
    if (type === 'student') {
      updates.studentImageData = imageData;
    } else {
      updates.professorImageData = imageData;
    }

    await this.updateSession(updates);

    // Update processing state
    const hasStudent = this.currentSession!.studentImageData || type === 'student';
    const hasProfessor = this.currentSession!.professorImageData || type === 'professor';
    
    if (hasStudent && hasProfessor) {
      this.updateProcessingState({
        status: 'processing',
        progress: 30,
        message: 'Both images captured. Ready for processing.'
      });
    } else {
      this.updateProcessingState({
        status: type === 'student' ? 'capturing-professor' : 'capturing-student',
        progress: 15,
        message: `${type} answer captured. Capture ${type === 'student' ? 'professor' : 'student'} answer next.`
      });
    }
  }

  /**
   * Store converted markdown
   */
  async storeMarkdown(type: 'student' | 'professor', markdown: string): Promise<void> {
    await this.ensureActiveSession();

    if (!this.currentSession) {
      throw new Error('No active session');
    }

    const updates: Partial<SessionData> = {};
    if (type === 'student') {
      updates.studentMarkdown = markdown;
    } else {
      updates.professorMarkdown = markdown;
    }

    await this.updateSession(updates);

    // Update processing state
    const hasStudentMd = this.currentSession.studentMarkdown || type === 'student';
    const hasProfessorMd = this.currentSession.professorMarkdown || type === 'professor';
    
    if (hasStudentMd && hasProfessorMd) {
      this.updateProcessingState({
        status: 'editing',
        progress: 70,
        message: 'Both answers converted. Review and edit if needed.'
      });
    } else {
      this.updateProcessingState({
        status: type === 'student' ? 'converting-professor' : 'converting-student',
        progress: 50,
        message: `${type} answer converted to markdown.`
      });
    }
  }

  /**
   * Store grading result
   */
  async storeGradingResult(result: any): Promise<void> {
    await this.ensureActiveSession();

    if (!this.currentSession) {
      throw new Error('No active session');
    }

    await this.updateSession({
      gradingResult: result,
      status: 'completed'
    });

    this.updateProcessingState({
      status: 'completed',
      progress: 100,
      message: 'Grading completed successfully!'
    });
  }

  /**
   * Clear current session
   */
  async clearSession(): Promise<void> {
    await backendAPI.endSession();

    if (this.currentSession) {
      await chrome.storage.local.remove(`session_${this.currentSession.sessionId}`);
      await chrome.storage.local.remove('current_session_id');
    }

    this.currentSession = null;
    this.processingState = {
      status: 'idle',
      progress: 0,
      message: 'Ready to start grading'
    };

    console.log('🟢 Session cleared');
  }

  /**
   * List all sessions
   */
  async listSessions(): Promise<SessionData[]> {
    const result = await chrome.storage.local.get();
    const sessions: SessionData[] = [];

    for (const [key, value] of Object.entries(result)) {
      if (key.startsWith('session_')) {
        sessions.push(value as SessionData);
      }
    }

    return sessions.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Broadcast processing state to UI components
   */
  private broadcastProcessingState(): void {
    // Send message to content scripts
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'PROCESSING_STATE_UPDATE',
          state: this.processingState
        }).catch(() => {
          // Ignore errors if content script not available
        });
      }
    });
  }
}

// Singleton instance
export const sessionManager = new SessionManager();
