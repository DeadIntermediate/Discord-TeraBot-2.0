import { Request, Response, NextFunction } from 'express';
import { info, warn } from '../utils/logger';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

/**
 * Simple in-memory rate limiter
 * For production, consider using redis-based rate limiting
 */
export class RateLimiter {
  private store: RateLimitStore = {};
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = {
      message: 'Too many requests, please try again later.',
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      ...config,
    };

    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  private cleanup(): void {
    const now = Date.now();
    Object.keys(this.store).forEach((key) => {
      if (this.store[key]?.resetTime && this.store[key].resetTime < now) {
        delete this.store[key];
      }
    });
  }

  private getKey(req: Request): string {
    // Use IP address as key (works with trust proxy)
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const path = req.path;
    return `${ip}:${path}`;
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const key = this.getKey(req);
      const now = Date.now();

      if (!this.store[key] || this.store[key].resetTime < now) {
        this.store[key] = {
          count: 1,
          resetTime: now + this.config.windowMs,
        };
        return next();
      }

      this.store[key].count++;

      if (this.store[key].count > this.config.max) {
        warn(`Rate limit exceeded for ${key}`);
        res.status(429).json({
          message: this.config.message,
          retryAfter: Math.ceil((this.store[key].resetTime - now) / 1000),
        });
        return;
      }

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', this.config.max.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, this.config.max - this.store[key].count).toString());
      res.setHeader('X-RateLimit-Reset', this.store[key].resetTime.toString());

      next();
    };
  }
}

// API rate limiter - 100 requests per 15 minutes
export const apiRateLimit = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many API requests from this IP, please try again after 15 minutes',
});

// Strict rate limiter for sensitive endpoints - 5 requests per minute
export const strictRateLimit = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: 'Too many requests to this endpoint, please try again later',
});

// Bot control rate limiter - 10 requests per 5 minutes
export const botControlRateLimit = new RateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  message: 'Too many bot control requests, please try again later',
});
