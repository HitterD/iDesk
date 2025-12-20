import { Injectable, NotFoundException, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { FeatureDefinition } from './entities/feature-definition.entity';
import { UserFeaturePermission } from './entities/user-feature-permission.entity';
import { PermissionPreset, PermissionSet } from './entities/permission-preset.entity';
import { User } from '../users/entities/user.entity';
import { FeaturePermissionDto } from './dto/update-permissions.dto';

// Default feature definitions - 25 granular features
const DEFAULT_FEATURES: Partial<FeatureDefinition>[] = [
    // Ticketing - Full CRUD + workflow
    { key: 'ticketing.view', name: 'View Tickets', description: 'Access to view ticket list and details', category: 'Ticketing', icon: 'Ticket', appliesToRoles: ['USER', 'AGENT'], sortOrder: 1 },
    { key: 'ticketing.create', name: 'Create Tickets', description: 'Ability to create new tickets', category: 'Ticketing', icon: 'Plus', appliesToRoles: ['USER', 'AGENT'], sortOrder: 2 },
    { key: 'ticketing.edit', name: 'Edit Own Tickets', description: 'Edit own tickets', category: 'Ticketing', icon: 'Edit2', appliesToRoles: ['USER', 'AGENT'], sortOrder: 3 },
    { key: 'ticketing.delete', name: 'Delete Tickets', description: 'Delete tickets', category: 'Ticketing', icon: 'Trash2', appliesToRoles: ['AGENT'], sortOrder: 4 },
    { key: 'ticketing.manage', name: 'Manage All Tickets', description: 'Manage tickets from all users', category: 'Ticketing', icon: 'Settings', appliesToRoles: ['AGENT'], sortOrder: 5 },
    { key: 'ticketing.assign', name: 'Assign Tickets', description: 'Assign tickets to agents', category: 'Ticketing', icon: 'UserPlus', appliesToRoles: ['AGENT'], sortOrder: 6 },
    { key: 'ticketing.escalate', name: 'Escalate Tickets', description: 'Escalate to manager', category: 'Ticketing', icon: 'ArrowUp', appliesToRoles: ['AGENT'], sortOrder: 7 },

    // Zoom Calendar
    { key: 'zoom_calendar.view', name: 'View Zoom Calendar', description: 'Access to view Zoom meeting calendar', category: 'Scheduling', icon: 'Calendar', appliesToRoles: ['USER', 'AGENT'], sortOrder: 10 },
    { key: 'zoom_calendar.book', name: 'Book Zoom Meetings', description: 'Ability to book Zoom meetings', category: 'Scheduling', icon: 'Video', appliesToRoles: ['USER', 'AGENT'], sortOrder: 11 },
    { key: 'zoom_calendar.manage', name: 'Manage All Bookings', description: 'Manage all Zoom bookings', category: 'Scheduling', icon: 'Settings', appliesToRoles: ['AGENT'], sortOrder: 12 },

    // Knowledge Base
    { key: 'knowledge_base.view', name: 'View Knowledge Base', description: 'Access to knowledge base articles', category: 'Resources', icon: 'BookOpen', appliesToRoles: ['USER', 'AGENT'], sortOrder: 20 },
    { key: 'knowledge_base.create', name: 'Create Articles', description: 'Create KB articles', category: 'Resources', icon: 'FilePlus', appliesToRoles: ['AGENT'], sortOrder: 21 },
    { key: 'knowledge_base.edit', name: 'Edit Articles', description: 'Edit KB articles', category: 'Resources', icon: 'Edit', appliesToRoles: ['AGENT'], sortOrder: 22 },

    // Reports & Analytics
    { key: 'reports.view', name: 'View Reports', description: 'Access to view analytics reports', category: 'Analytics', icon: 'BarChart3', appliesToRoles: ['AGENT'], sortOrder: 30 },
    { key: 'reports.dashboard', name: 'Dashboard Access', description: 'Access dashboard analytics', category: 'Analytics', icon: 'LayoutDashboard', appliesToRoles: ['AGENT'], sortOrder: 31 },
    { key: 'reports.export', name: 'Export Reports', description: 'Export reports to file', category: 'Analytics', icon: 'Download', appliesToRoles: ['AGENT'], sortOrder: 32 },

    // ICT Budget
    { key: 'ict_budget.view', name: 'View ICT Budget', description: 'View ICT budget items', category: 'Finance', icon: 'DollarSign', appliesToRoles: ['AGENT'], sortOrder: 40 },
    { key: 'ict_budget.manage', name: 'Manage ICT Budget', description: 'Create and manage budget items', category: 'Finance', icon: 'Calculator', appliesToRoles: ['AGENT'], sortOrder: 41 },

    // Lost Item
    { key: 'lost_item.view', name: 'View Lost Items', description: 'View lost item reports', category: 'Operations', icon: 'Search', appliesToRoles: ['USER', 'AGENT'], sortOrder: 50 },
    { key: 'lost_item.manage', name: 'Manage Lost Items', description: 'Manage lost item reports', category: 'Operations', icon: 'Package', appliesToRoles: ['AGENT'], sortOrder: 51 },

    // Access Request
    { key: 'access_request.view', name: 'View Access Requests', description: 'View access requests', category: 'Security', icon: 'Key', appliesToRoles: ['USER', 'AGENT'], sortOrder: 60 },
    { key: 'access_request.create', name: 'Create Access Requests', description: 'Submit access requests', category: 'Security', icon: 'KeyRound', appliesToRoles: ['USER', 'AGENT'], sortOrder: 61 },
    { key: 'access_request.approve', name: 'Approve Access Requests', description: 'Approve/reject access requests', category: 'Security', icon: 'CheckCircle', appliesToRoles: ['AGENT'], sortOrder: 62 },

    // Renewal
    { key: 'renewal.view', name: 'View Renewals', description: 'Access to renewal tracking', category: 'Operations', icon: 'RefreshCw', appliesToRoles: ['AGENT'], sortOrder: 70 },
    { key: 'renewal.manage', name: 'Manage Renewals', description: 'Create and manage renewals', category: 'Operations', icon: 'Settings', appliesToRoles: ['AGENT'], sortOrder: 71 },

    // System
    { key: 'notifications.view', name: 'View Notifications', description: 'Access to notification center', category: 'System', icon: 'Bell', appliesToRoles: ['USER', 'AGENT'], sortOrder: 80 },
    { key: 'settings.view', name: 'View Settings', description: 'Access to user settings', category: 'System', icon: 'Settings', appliesToRoles: ['USER', 'AGENT'], sortOrder: 81 },
];

// Simplified permission presets - 4 role-based presets only
const DEFAULT_PRESETS: Partial<PermissionPreset>[] = [
    // USER - Basic customer/employee who submits tickets
    {
        name: 'User',
        description: 'Standard user. Create tickets, book Zoom, view Knowledge Base. Limited to own data only.',
        sortOrder: 1,
        isDefault: true,
        isSystem: true,
        permissions: {
            // Ticketing - create and edit own only
            'ticketing.view': { canView: true, canCreate: false, canEdit: false, canDelete: false },
            'ticketing.create': { canView: true, canCreate: true, canEdit: false, canDelete: false },
            'ticketing.edit': { canView: false, canCreate: false, canEdit: true, canDelete: false },
            // Zoom - view and book only
            'zoom_calendar.view': { canView: true, canCreate: false, canEdit: false, canDelete: false },
            'zoom_calendar.book': { canView: true, canCreate: true, canEdit: false, canDelete: false },
            // Knowledge Base - view only
            'knowledge_base.view': { canView: true, canCreate: false, canEdit: false, canDelete: false },
            // Lost Item - view and report
            'lost_item.view': { canView: true, canCreate: true, canEdit: false, canDelete: false },
            // Access Request - view and create
            'access_request.view': { canView: true, canCreate: false, canEdit: false, canDelete: false },
            'access_request.create': { canView: true, canCreate: true, canEdit: false, canDelete: false },
            // System
            'notifications.view': { canView: true, canCreate: false, canEdit: false, canDelete: false },
            'settings.view': { canView: true, canCreate: false, canEdit: true, canDelete: false },
        },
    },

    // AGENT - Helpdesk agent who handles tickets
    {
        name: 'Agent',
        description: 'Helpdesk agent. Manage tickets, assign, view reports. Full ticketing access.',
        sortOrder: 2,
        isSystem: true,
        permissions: {
            // Ticketing - full management
            'ticketing.view': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            'ticketing.create': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            'ticketing.edit': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            'ticketing.manage': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            'ticketing.assign': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            'ticketing.escalate': { canView: true, canCreate: true, canEdit: false, canDelete: false },
            // Zoom - view, book, and manage own
            'zoom_calendar.view': { canView: true, canCreate: true, canEdit: false, canDelete: false },
            'zoom_calendar.book': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            // Knowledge Base - create and edit
            'knowledge_base.view': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            'knowledge_base.create': { canView: true, canCreate: true, canEdit: false, canDelete: false },
            'knowledge_base.edit': { canView: true, canCreate: false, canEdit: true, canDelete: false },
            // Reports - view
            'reports.view': { canView: true, canCreate: false, canEdit: false, canDelete: false },
            'reports.dashboard': { canView: true, canCreate: false, canEdit: false, canDelete: false },
            // Lost Item - manage
            'lost_item.view': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            'lost_item.manage': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            // Access Request - view
            'access_request.view': { canView: true, canCreate: true, canEdit: false, canDelete: false },
            'access_request.create': { canView: true, canCreate: true, canEdit: false, canDelete: false },
            // Renewal - view
            'renewal.view': { canView: true, canCreate: false, canEdit: false, canDelete: false },
            // System
            'notifications.view': { canView: true, canCreate: false, canEdit: false, canDelete: false },
            'settings.view': { canView: true, canCreate: false, canEdit: true, canDelete: false },
        },
    },

    // MANAGER - Team lead with approval and reporting
    {
        name: 'Manager',
        description: 'Team manager. Delete tickets, approve requests, full reports, manage renewals.',
        sortOrder: 3,
        isSystem: true,
        permissions: {
            // Ticketing - full including delete
            'ticketing.view': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'ticketing.create': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            'ticketing.edit': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            'ticketing.delete': { canView: true, canCreate: false, canEdit: false, canDelete: true },
            'ticketing.manage': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'ticketing.assign': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            'ticketing.escalate': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            // Zoom - full management
            'zoom_calendar.view': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            'zoom_calendar.book': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'zoom_calendar.manage': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            // Knowledge Base - full
            'knowledge_base.view': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'knowledge_base.create': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            'knowledge_base.edit': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            // Reports - full including export
            'reports.view': { canView: true, canCreate: true, canEdit: false, canDelete: false },
            'reports.dashboard': { canView: true, canCreate: true, canEdit: false, canDelete: false },
            'reports.export': { canView: true, canCreate: true, canEdit: false, canDelete: false },
            // ICT Budget - view
            'ict_budget.view': { canView: true, canCreate: false, canEdit: false, canDelete: false },
            // Lost Item - manage
            'lost_item.view': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'lost_item.manage': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            // Access Request - approve
            'access_request.view': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            'access_request.create': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            'access_request.approve': { canView: true, canCreate: false, canEdit: true, canDelete: false },
            // Renewal - manage
            'renewal.view': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            'renewal.manage': { canView: true, canCreate: true, canEdit: true, canDelete: false },
            // System
            'notifications.view': { canView: true, canCreate: false, canEdit: false, canDelete: false },
            'settings.view': { canView: true, canCreate: false, canEdit: true, canDelete: false },
        },
    },

    // ADMIN - Full system administrator
    {
        name: 'Admin',
        description: 'System administrator. Full access to all features including budget and system settings.',
        sortOrder: 4,
        isSystem: true,
        permissions: {
            // Ticketing - full
            'ticketing.view': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'ticketing.create': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'ticketing.edit': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'ticketing.delete': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'ticketing.manage': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'ticketing.assign': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'ticketing.escalate': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            // Zoom - full
            'zoom_calendar.view': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'zoom_calendar.book': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'zoom_calendar.manage': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            // Knowledge Base - full
            'knowledge_base.view': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'knowledge_base.create': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'knowledge_base.edit': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            // Reports - full
            'reports.view': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'reports.dashboard': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'reports.export': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            // ICT Budget - full
            'ict_budget.view': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'ict_budget.manage': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            // Lost Item - full
            'lost_item.view': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'lost_item.manage': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            // Access Request - full
            'access_request.view': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'access_request.create': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'access_request.approve': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            // Renewal - full
            'renewal.view': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'renewal.manage': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            // System - full
            'notifications.view': { canView: true, canCreate: true, canEdit: true, canDelete: true },
            'settings.view': { canView: true, canCreate: true, canEdit: true, canDelete: true },
        },
    },
];


@Injectable()
export class PermissionsService implements OnModuleInit {
    private readonly logger = new Logger(PermissionsService.name);

    constructor(
        @InjectRepository(FeatureDefinition)
        private readonly featureRepo: Repository<FeatureDefinition>,
        @InjectRepository(UserFeaturePermission)
        private readonly permissionRepo: Repository<UserFeaturePermission>,
        @InjectRepository(PermissionPreset)
        private readonly presetRepo: Repository<PermissionPreset>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
    ) { }

    async onModuleInit() {
        await this.seedDefaultFeatures();
        await this.seedDefaultPresets();
    }

    private async seedDefaultFeatures() {
        for (const feature of DEFAULT_FEATURES) {
            const exists = await this.featureRepo.findOne({ where: { key: feature.key } });
            if (!exists) {
                await this.featureRepo.save(this.featureRepo.create(feature));
                this.logger.log(`Seeded feature: ${feature.key}`);
            }
        }
    }

    private async seedDefaultPresets() {
        for (const preset of DEFAULT_PRESETS) {
            const exists = await this.presetRepo.findOne({ where: { name: preset.name } });
            if (!exists) {
                await this.presetRepo.save(this.presetRepo.create(preset));
                this.logger.log(`Seeded preset: ${preset.name}`);
            }
        }
    }

    // Get all feature definitions
    async getFeatureDefinitions(): Promise<FeatureDefinition[]> {
        return this.featureRepo.find({
            where: { isActive: true },
            order: { sortOrder: 'ASC', category: 'ASC' },
        });
    }

    // Get all permission presets
    async getPresets(): Promise<PermissionPreset[]> {
        return this.presetRepo.find({
            where: { isActive: true },
            order: { sortOrder: 'ASC' },
        });
    }

    // Get user's current permissions
    async getUserPermissions(userId: string): Promise<Record<string, UserFeaturePermission>> {
        const permissions = await this.permissionRepo.find({
            where: { userId },
        });

        // Convert to map for easy lookup
        const permissionMap: Record<string, UserFeaturePermission> = {};
        for (const p of permissions) {
            permissionMap[p.featureKey] = p;
        }
        return permissionMap;
    }

    // Get user's permissions in a format suitable for JWT/frontend
    async getUserPermissionsForAuth(userId: string): Promise<Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean }>> {
        const permissions = await this.permissionRepo.find({
            where: { userId },
        });

        const result: Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean }> = {};
        for (const p of permissions) {
            result[p.featureKey] = {
                view: p.canView,
                create: p.canCreate,
                edit: p.canEdit,
                delete: p.canDelete,
            };
        }
        return result;
    }

    // Update user permissions
    async updateUserPermissions(userId: string, permissions: FeaturePermissionDto[]): Promise<{ updated: number }> {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException(`User ${userId} not found`);
        }

        let updated = 0;
        for (const perm of permissions) {
            let existing = await this.permissionRepo.findOne({
                where: { userId, featureKey: perm.featureKey },
            });

            if (existing) {
                // Update existing
                existing.canView = perm.canView ?? existing.canView;
                existing.canCreate = perm.canCreate ?? existing.canCreate;
                existing.canEdit = perm.canEdit ?? existing.canEdit;
                existing.canDelete = perm.canDelete ?? existing.canDelete;
                await this.permissionRepo.save(existing);
            } else {
                // Create new
                const newPerm = this.permissionRepo.create({
                    userId,
                    featureKey: perm.featureKey,
                    canView: perm.canView ?? false,
                    canCreate: perm.canCreate ?? false,
                    canEdit: perm.canEdit ?? false,
                    canDelete: perm.canDelete ?? false,
                });
                await this.permissionRepo.save(newPerm);
            }
            updated++;
        }

        return { updated };
    }

    // Apply preset to user
    async applyPresetToUser(userId: string, presetId: string): Promise<{ applied: boolean }> {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException(`User ${userId} not found`);
        }

        const preset = await this.presetRepo.findOne({ where: { id: presetId } });
        if (!preset) {
            throw new NotFoundException(`Preset ${presetId} not found`);
        }

        // Delete existing permissions for this user
        await this.permissionRepo.delete({ userId });

        // Apply preset permissions
        const newPermissions: Partial<UserFeaturePermission>[] = [];
        for (const [featureKey, perms] of Object.entries(preset.permissions)) {
            newPermissions.push({
                userId,
                featureKey,
                canView: perms.canView,
                canCreate: perms.canCreate,
                canEdit: perms.canEdit,
                canDelete: perms.canDelete,
            });
        }

        await this.permissionRepo.save(newPermissions.map(p => this.permissionRepo.create(p)));

        return { applied: true };
    }

    // Bulk apply preset to multiple users
    async bulkApplyPreset(userIds: string[], presetId: string): Promise<{ updated: number }> {
        const preset = await this.presetRepo.findOne({ where: { id: presetId } });
        if (!preset) {
            throw new NotFoundException(`Preset ${presetId} not found`);
        }

        let updated = 0;
        for (const userId of userIds) {
            try {
                await this.applyPresetToUser(userId, presetId);
                updated++;
            } catch (error) {
                this.logger.warn(`Failed to apply preset to user ${userId}: ${error.message}`);
            }
        }

        return { updated };
    }

    // Check if user has specific permission
    async hasPermission(userId: string, featureKey: string, action: 'view' | 'create' | 'edit' | 'delete' = 'view'): Promise<boolean> {
        const permission = await this.permissionRepo.findOne({
            where: { userId, featureKey },
        });

        if (!permission) {
            return false;
        }

        switch (action) {
            case 'view': return permission.canView;
            case 'create': return permission.canCreate;
            case 'edit': return permission.canEdit;
            case 'delete': return permission.canDelete;
            default: return false;
        }
    }

    // Initialize permissions for a new user with default preset
    async initializeUserPermissions(userId: string): Promise<void> {
        const defaultPreset = await this.presetRepo.findOne({ where: { isDefault: true } });
        if (defaultPreset) {
            await this.applyPresetToUser(userId, defaultPreset.id);
            this.logger.log(`Initialized permissions for user ${userId} with default preset`);
        }
    }

    // === PRESET CRUD OPERATIONS ===

    // Get single preset by ID
    async getPresetById(presetId: string): Promise<PermissionPreset> {
        const preset = await this.presetRepo.findOne({ where: { id: presetId } });
        if (!preset) {
            throw new NotFoundException(`Preset ${presetId} not found`);
        }
        return preset;
    }

    // Create new preset
    async createPreset(data: {
        name: string;
        description?: string;
        sortOrder?: number;
        isDefault?: boolean;
        permissions: Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }>;
    }): Promise<PermissionPreset> {
        // If setting as default, unset other defaults
        if (data.isDefault) {
            await this.presetRepo.update({ isDefault: true }, { isDefault: false });
        }

        const preset = this.presetRepo.create({
            name: data.name,
            description: data.description,
            sortOrder: data.sortOrder || 99,
            isDefault: data.isDefault || false,
            isSystem: false, // Custom presets are not system presets
            permissions: data.permissions,
        });

        return this.presetRepo.save(preset);
    }

    // Update existing preset
    async updatePreset(presetId: string, data: {
        name?: string;
        description?: string;
        sortOrder?: number;
        isDefault?: boolean;
        permissions?: Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }>;
    }): Promise<PermissionPreset> {
        const preset = await this.presetRepo.findOne({ where: { id: presetId } });
        if (!preset) {
            throw new NotFoundException(`Preset ${presetId} not found`);
        }

        // If setting as default, unset other defaults
        if (data.isDefault && !preset.isDefault) {
            await this.presetRepo.update({ isDefault: true }, { isDefault: false });
        }

        // Update fields
        if (data.name !== undefined) preset.name = data.name;
        if (data.description !== undefined) preset.description = data.description;
        if (data.sortOrder !== undefined) preset.sortOrder = data.sortOrder;
        if (data.isDefault !== undefined) preset.isDefault = data.isDefault;
        if (data.permissions !== undefined) preset.permissions = data.permissions;

        return this.presetRepo.save(preset);
    }

    // Delete preset (only non-system presets)
    async deletePreset(presetId: string): Promise<{ deleted: boolean }> {
        const preset = await this.presetRepo.findOne({ where: { id: presetId } });
        if (!preset) {
            throw new NotFoundException(`Preset ${presetId} not found`);
        }

        if (preset.isSystem) {
            throw new Error('Cannot delete system preset');
        }

        await this.presetRepo.delete({ id: presetId });
        return { deleted: true };
    }

    // Clone preset
    async clonePreset(presetId: string, newName: string): Promise<PermissionPreset> {
        const source = await this.presetRepo.findOne({ where: { id: presetId } });
        if (!source) {
            throw new NotFoundException(`Preset ${presetId} not found`);
        }

        const clone = this.presetRepo.create({
            name: newName,
            description: `Cloned from ${source.name}`,
            sortOrder: source.sortOrder + 1,
            isDefault: false,
            isSystem: false,
            permissions: { ...source.permissions },
        });

        return this.presetRepo.save(clone);
    }
}
