/**
 * Simple in-memory rate limiter for WebSocket connections
 * Limits requests per key (typically IP address) within a sliding window
 */
export class RateLimiter {
    private requests: Map<string, number[]> = new Map();

    /**
     * Create a rate limiter
     * @param maxRequests Maximum requests allowed in the window
     * @param windowMs Time window in milliseconds
     */
    constructor(
        private readonly maxRequests: number,
        private readonly windowMs: number
    ) { }

    /**
     * Check if a request should be allowed
     * @param key The key to rate limit (e.g., IP address, user ID)
     * @returns true if allowed, false if rate limited
     */
    isAllowed(key: string): boolean {
        const now = Date.now();
        const windowStart = now - this.windowMs;

        // Get or initialize request timestamps for this key
        let timestamps = this.requests.get(key) || [];

        // Filter to only keep timestamps within the window
        timestamps = timestamps.filter(t => t > windowStart);

        // Check if under the limit
        if (timestamps.length >= this.maxRequests) {
            return false;
        }

        // Add new timestamp
        timestamps.push(now);
        this.requests.set(key, timestamps);

        return true;
    }

    /**
     * Get remaining requests for a key
     */
    getRemaining(key: string): number {
        const now = Date.now();
        const windowStart = now - this.windowMs;
        const timestamps = (this.requests.get(key) || []).filter(t => t > windowStart);
        return Math.max(0, this.maxRequests - timestamps.length);
    }

    /**
     * Clean up old entries to prevent memory leaks
     * Call this periodically (e.g., every minute)
     */
    cleanup(): void {
        const now = Date.now();
        const windowStart = now - this.windowMs;

        for (const [key, timestamps] of this.requests.entries()) {
            const active = timestamps.filter(t => t > windowStart);
            if (active.length === 0) {
                this.requests.delete(key);
            } else {
                this.requests.set(key, active);
            }
        }
    }

    /**
     * Reset limits for a specific key
     */
    reset(key: string): void {
        this.requests.delete(key);
    }
}
