import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

export interface PermissionSet {
    [featureKey: string]: {
        canView: boolean;
        canCreate: boolean;
        canEdit: boolean;
        canDelete: boolean;
    };
}

@Entity('permission_presets')
export class PermissionPreset {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string; // e.g., 'Standard User', 'Power User', 'Limited User'

    @Column({ nullable: true })
    description: string;

    @Column('jsonb')
    permissions: PermissionSet;

    @Column({ default: false })
    isDefault: boolean; // Default preset for new users

    @Column({ default: 0 })
    sortOrder: number;

    @Column({ default: true })
    isActive: boolean;

    @Column({ default: false })
    isSystem: boolean; // System presets cannot be deleted

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
