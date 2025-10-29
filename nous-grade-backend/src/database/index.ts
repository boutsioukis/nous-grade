// Database connection and setup
// MVP: File-based storage, easily upgradeable to PostgreSQL

import fs from 'fs/promises';
import path from 'path';
import { GradingSession } from '../types';

export class DatabaseManager {
  private dataDir: string;
  private sessionsFile: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.sessionsFile = path.join(this.dataDir, 'sessions.json');
  }

  /**
   * Initialize database (create data directory and files)
   */
  async initialize(): Promise<void> {
    try {
      // Create data directory if it doesn't exist
      await fs.mkdir(this.dataDir, { recursive: true });
      
      // Initialize sessions file if it doesn't exist
      try {
        await fs.access(this.sessionsFile);
      } catch {
        await fs.writeFile(this.sessionsFile, JSON.stringify([], null, 2));
      }

      console.log('📁 Database initialized successfully');
    } catch (error) {
      console.error('🔴 Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Save session to file storage
   */
  async saveSession(session: GradingSession): Promise<void> {
    try {
      const sessions = await this.loadAllSessions();
      const existingIndex = sessions.findIndex(s => s.id === session.id);
      
      if (existingIndex >= 0) {
        sessions[existingIndex] = session;
      } else {
        sessions.push(session);
      }

      await fs.writeFile(this.sessionsFile, JSON.stringify(sessions, null, 2));
    } catch (error) {
      console.error('🔴 Failed to save session:', error);
      throw error;
    }
  }

  /**
   * Load session by ID
   */
  async loadSession(sessionId: string): Promise<GradingSession | null> {
    try {
      const sessions = await this.loadAllSessions();
      return sessions.find(s => s.id === sessionId) || null;
    } catch (error) {
      console.error('🔴 Failed to load session:', error);
      return null;
    }
  }

  /**
   * Load all sessions
   */
  async loadAllSessions(): Promise<GradingSession[]> {
    try {
      const data = await fs.readFile(this.sessionsFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('🔴 Failed to load sessions:', error);
      return [];
    }
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const sessions = await this.loadAllSessions();
      const filteredSessions = sessions.filter(s => s.id !== sessionId);
      
      if (filteredSessions.length === sessions.length) {
        return false; // Session not found
      }

      await fs.writeFile(this.sessionsFile, JSON.stringify(filteredSessions, null, 2));
      return true;
    } catch (error) {
      console.error('🔴 Failed to delete session:', error);
      return false;
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const sessions = await this.loadAllSessions();
      const now = new Date();
      const activeSessions = sessions.filter(s => new Date(s.expiresAt) > now);
      
      const expiredCount = sessions.length - activeSessions.length;
      
      if (expiredCount > 0) {
        await fs.writeFile(this.sessionsFile, JSON.stringify(activeSessions, null, 2));
        console.log(`🧹 Cleaned up ${expiredCount} expired sessions`);
      }

      return expiredCount;
    } catch (error) {
      console.error('🔴 Failed to cleanup expired sessions:', error);
      return 0;
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
    completedGradings: number;
  }> {
    try {
      const sessions = await this.loadAllSessions();
      const now = new Date();
      
      const activeSessions = sessions.filter(s => new Date(s.expiresAt) > now);
      const expiredSessions = sessions.filter(s => new Date(s.expiresAt) <= now);
      const completedGradings = sessions.filter(s => s.gradingResult).length;

      return {
        totalSessions: sessions.length,
        activeSessions: activeSessions.length,
        expiredSessions: expiredSessions.length,
        completedGradings
      };
    } catch (error) {
      console.error('🔴 Failed to get database stats:', error);
      return {
        totalSessions: 0,
        activeSessions: 0,
        expiredSessions: 0,
        completedGradings: 0
      };
    }
  }
}

// Export singleton instance
export const database = new DatabaseManager();
