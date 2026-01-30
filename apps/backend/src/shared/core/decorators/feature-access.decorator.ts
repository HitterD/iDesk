import { SetMetadata } from '@nestjs/common';

/**
 * Feature-level CRUD access decorator
 * 
 * Usage:
 * @FeatureAccess('tickets', 'create')  // Requires tickets.create permission
 * @FeatureAccess('kb', 'delete')       // Requires kb.delete permission
 * 
 * Actions: 'view' | 'create' | 'edit' | 'delete'
 */
export type FeatureAction = 'view' | 'create' | 'edit' | 'delete';

export interface FeatureAccessRequirement {
    feature: string;
    action: FeatureAction;
}

export const FEATURE_ACCESS_KEY = 'featureAccess';

/**
 * Decorator to require specific feature-level CRUD permission
 * 
 * @param feature - Feature key (e.g., 'tickets', 'kb', 'renewal')
 * @param action - CRUD action ('view', 'create', 'edit', 'delete')
 */
export const FeatureAccess = (feature: string, action: FeatureAction) =>
    SetMetadata(FEATURE_ACCESS_KEY, { feature, action } as FeatureAccessRequirement);
