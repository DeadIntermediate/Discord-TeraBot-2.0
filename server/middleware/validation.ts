import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { error } from '../utils/logger';

/**
 * Validation middleware factory
 * Creates middleware to validate request data against a Zod schema
 */
export function validateRequest(schema: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate body
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }

      // Validate query parameters
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query);
      }

      // Validate URL parameters
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params);
      }

      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        error('Validation error:', err.errors);
        res.status(400).json({
          message: 'Validation failed',
          errors: err.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }

      error('Unexpected validation error:', err);
      res.status(500).json({ message: 'Internal server error during validation' });
    }
  };
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // Pagination query parameters
  pagination: z.object({
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .pipe(z.number().min(1).max(100)),
    offset: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 0))
      .pipe(z.number().min(0)),
  }),

  // Discord ID parameter
  discordId: z.object({
    id: z.string().regex(/^\d{17,19}$/, 'Invalid Discord ID format'),
  }),

  // Server ID parameter
  serverId: z.object({
    serverId: z.string().regex(/^\d{17,19}$/, 'Invalid server ID format'),
  }),

  // Ticket status query
  ticketStatus: z.object({
    status: z.enum(['open', 'closed', 'pending']).optional(),
  }),

  // Generic string ID
  stringId: z.object({
    id: z.string().min(1).max(255),
  }),
};
