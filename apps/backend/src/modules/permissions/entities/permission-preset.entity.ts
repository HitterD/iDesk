import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

// OLD complex interface - kept for migration compatibility
export interface PermissionSet {
    [featureKey: string]: {
        canView: boolean;
        canCreate: boolean;
        canEdit: boolean;
        canDelete: boolean;
    };
}

// NEW simple interface - just page access
export interface PageAccess {
    [pageKey: string]: boolean;
}

// NEW: Feature-level CRUD permissions (FI-7)
export interface FeaturePermission {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
}

export interface FeatureAccess {
    [featureKey: string]: FeaturePermission;
}

// Role types for preset targeting
export type PresetTargetRole = 'USER' | 'AGENT' | 'MANAGER' | 'ADMIN';

@Entity('permission_presets')
export class PermissionPreset {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string; // e.g., 'Standard User', 'Agent - Renewal'

    @Column({ type: 'varchar', nullable: true })
    description: string;

    // NEW: Target role for this preset (USER, AGENT, MANAGER, ADMIN)
    @Column({ default: 'USER' })
    targetRole: PresetTargetRole;

    // NEW: Simple page access map
    @Column('jsonb', { nullable: true })
    pageAccess: PageAccess;

    // OLD: Complex permissions - kept for migration, will be deprecated
    @Column('jsonb', { nullable: true })
    permissions: PermissionSet;

    @Column({ default: false })
    isDefault: boolean;

    @Column({ default: 0 })
    sortOrder: number;

    @Column({ default: true })
    isActive: boolean;

    @Column({ default: false })
    isSystem: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
