import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSION_KEY = 'required_permission';

export interface RequiredPermission {
    feature: string;
    action: 'view' | 'create' | 'edit' | 'delete';
}

/**
 * Decorator to require specific feature permission on a route/controller
 * Usage: @RequirePermission('ticketing.view', 'view')
 */
export const RequirePermission = (feature: string, action: 'view' | 'create' | 'edit' | 'delete' = 'view') =>
    SetMetadata(REQUIRED_PERMISSION_KEY, { feature, action });
