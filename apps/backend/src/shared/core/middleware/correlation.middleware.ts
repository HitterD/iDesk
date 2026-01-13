import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Correlation ID Middleware
 * 
 * Adds a unique correlation ID to each request for distributed tracing.
 * - If client sends X-Correlation-ID header, it's reused
 * - Otherwise, a new UUID is generated
 * - The ID is attached to the request object and response headers
 */
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        // Use existing correlation ID from client or generate new one
        const correlationId = (req.headers['x-correlation-id'] as string)
            || (req.headers['x-request-id'] as string)
            || uuidv4();

        // Attach to request for use in logging
        req['correlationId'] = correlationId;

        // Set response header so clients can correlate responses
        res.setHeader('X-Correlation-ID', correlationId);

        next();
    }
}

// Extend Express Request type to include correlationId
declare global {
    namespace Express {
        interface Request {
            correlationId?: string;
        }
    }
}
