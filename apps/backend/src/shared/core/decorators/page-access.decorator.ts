import { SetMetadata } from '@nestjs/common';
import { PageKey } from '../types/page-access.types';

/**
 * Metadata key for page access requirements
 */
export const PAGE_ACCESS_KEY = 'page-access';

/**
 * PageAccess Decorator
 * 
 * Use this decorator on controllers or individual endpoints to require
 * specific page access from the user's applied preset.
 * 
 * @example
 * // On controller level - all endpoints require 'renewal' access
 * @Controller('renewal')
 * @PageAccess('renewal')
 * export class RenewalController { ... }
 * 
 * @example
 * // On endpoint level - only this endpoint requires access
 * @Get('stats')
 * @PageAccess('reports')
 * async getStats() { ... }
 * 
 * @param page - The page key required for access (e.g., 'renewal', 'reports')
 */
export const PageAccess = (page: PageKey) => SetMetadata(PAGE_ACCESS_KEY, page);

/**
 * Multiple page access - user needs access to ANY of the specified pages
 * 
 * @example
 * @PageAccessAny(['reports', 'renewal'])
 * async getSharedStats() { ... }
 */
export const PageAccessAny = (pages: PageKey[]) => SetMetadata(PAGE_ACCESS_KEY, { type: 'any', pages });

/**
 * Multiple page access - user needs access to ALL specified pages
 * 
 * @example
 * @PageAccessAll(['reports', 'renewal'])
 * async getCrossModuleData() { ... }
 */
export const PageAccessAll = (pages: PageKey[]) => SetMetadata(PAGE_ACCESS_KEY, { type: 'all', pages });

/**
 * SkipPageAccess Decorator
 *
 * Use on individual endpoints inside a @PageAccess-protected controller
 * to bypass the class-level page access requirement.
 * The PageAccessGuard's getAllAndOverride returns undefined for the handler,
 * which short-circuits the guard (return true).
 *
 * @example
 * // Controller has @PageAccess('settings') at class level
 * // But this endpoint should be accessible to ALL authenticated users:
 * @Get('scheduling')
 * @SkipPageAccess()
 * async getSchedulingConfig() { ... }
 */
export const SkipPageAccess = () => SetMetadata(PAGE_ACCESS_KEY, null);
