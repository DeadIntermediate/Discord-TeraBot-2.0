import { error as logError, warn, info } from './logger';

export interface ErrorContext {
  userId?: string;
  serverId?: string;
  endpoint?: string;
  method?: string;
  additionalData?: Record<string, unknown>;
}

export interface TrackedError {
  id: string;
  message: string;
  stack?: string;
  context: ErrorContext;
  timestamp: Date;
  count: number;
}

class ErrorTrackingService {
  private errors: Map<string, TrackedError> = new Map();
  private maxErrors = 1000;

  /**
   * Track an error with context
   */
  track(error: Error | unknown, context: ErrorContext = {}): string {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    const errorId = this.generateErrorId(errorObj, context);

    const existing = this.errors.get(errorId);
    if (existing) {
      existing.count++;
      existing.timestamp = new Date();
      this.errors.set(errorId, existing);
      
      // Log repeated errors less frequently
      if (existing.count % 10 === 0) {
        warn(`Error repeated ${existing.count} times: ${errorObj.message}`);
      }
    } else {
      const tracked: TrackedError = {
        id: errorId,
        message: errorObj.message,
        stack: errorObj.stack ?? undefined,
        context,
        timestamp: new Date(),
        count: 1,
      };

      this.errors.set(errorId, tracked);
      logError('New error tracked:', errorObj.message, 'Context:', context);

      // Prevent memory leaks by limiting stored errors
      if (this.errors.size > this.maxErrors) {
        const oldestKey = this.errors.keys().next().value;
        if (oldestKey) {
          this.errors.delete(oldestKey);
        }
      }
    }

    return errorId;
  }

  /**
   * Generate a unique ID for an error based on its message and context
   */
  private generateErrorId(error: Error, context: ErrorContext): string {
    const contextStr = JSON.stringify({
      endpoint: context.endpoint,
      method: context.method,
    });
    const hash = this.simpleHash(error.message + contextStr);
    return `err_${hash}`;
  }

  /**
   * Simple hash function for generating error IDs
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get all tracked errors
   */
  getErrors(): TrackedError[] {
    return Array.from(this.errors.values());
  }

  /**
   * Get a specific error by ID
   */
  getError(id: string): TrackedError | undefined {
    return this.errors.get(id);
  }

  /**
   * Get errors for a specific context
   */
  getErrorsByContext(context: Partial<ErrorContext>): TrackedError[] {
    return Array.from(this.errors.values()).filter((err) => {
      return Object.entries(context).every(([key, value]) => {
        return err.context[key as keyof ErrorContext] === value;
      });
    });
  }

  /**
   * Clear old errors (older than specified minutes)
   */
  clearOldErrors(olderThanMinutes: number = 60): number {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    let cleared = 0;

    for (const [id, error] of this.errors.entries()) {
      if (error.timestamp < cutoff) {
        this.errors.delete(id);
        cleared++;
      }
    }

    if (cleared > 0) {
      info(`Cleared ${cleared} old errors from tracking`);
    }

    return cleared;
  }

  /**
   * Get error statistics
   */
  getStats(): {
    totalErrors: number;
    totalOccurrences: number;
    mostFrequent: TrackedError | null;
    recentErrors: TrackedError[];
  } {
    const errors = Array.from(this.errors.values());
    const totalOccurrences = errors.reduce((sum, err) => sum + err.count, 0);
    
    const sorted = [...errors].sort((a, b) => b.count - a.count);
    const mostFrequent = sorted[0] || null;
    
    const recentErrors = [...errors]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    return {
      totalErrors: this.errors.size,
      totalOccurrences,
      mostFrequent,
      recentErrors,
    };
  }

  /**
   * Clear all errors
   */
  clear(): void {
    this.errors.clear();
    info('Error tracking cleared');
  }
}

// Singleton instance
export const errorTracker = new ErrorTrackingService();

// Clean up old errors every hour
setInterval(() => {
  errorTracker.clearOldErrors(60);
}, 60 * 60 * 1000);
