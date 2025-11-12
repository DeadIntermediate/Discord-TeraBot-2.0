import { Request, Response, NextFunction } from 'express';

/**
 * Security headers middleware
 * Adds recommended security headers to all responses
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Remove X-Powered-By header to hide Express
  res.removeHeader('X-Powered-By');
  
  // Content Security Policy (adjust as needed for your app)
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'"
  );

  next();
}

/**
 * CORS middleware
 * Configure CORS based on environment
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:5000',
  ];
  
  const origin = req.headers.origin;
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  
  next();
}

/**
 * Request sanitization middleware
 * Sanitizes request data to prevent injection attacks
 */
export function sanitizeRequest(req: Request, res: Response, next: NextFunction): void {
  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach((key) => {
      const value = req.query[key];
      if (typeof value === 'string') {
        // Remove potentially dangerous characters
        req.query[key] = value.replace(/[<>]/g, '');
      }
    });
  }

  // Sanitize body (if JSON)
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }

  next();
}

function sanitizeObject(obj: Record<string, unknown>): void {
  Object.keys(obj).forEach((key) => {
    const value = obj[key];
    if (typeof value === 'string') {
      // Basic XSS prevention
      obj[key] = value.replace(/[<>]/g, '');
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitizeObject(value as Record<string, unknown>);
    }
  });
}
