/**
 * Page Access Types
 * Centralized page key definitions for preset-based authorization
 */

// Valid page keys that can be used in pageAccess
export const VALID_PAGE_KEYS = [
    'dashboard',
    'tickets',
    'zoom_calendar',
    'knowledge_base',
    'notifications',
    'reports',
    'renewal',
    'agents',
    'automation',
    'audit_logs',
    'system_health',
    'settings',
] as const;

// Type for valid page keys
export type PageKey = typeof VALID_PAGE_KEYS[number];

// PageAccess object type
export type PageAccess = Partial<Record<PageKey, boolean>>;

// Check if a string is a valid page key
export function isValidPageKey(key: string): key is PageKey {
    return VALID_PAGE_KEYS.includes(key as PageKey);
}
