import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ZoomAccount } from '../entities/zoom-account.entity';
import { CreateZoomAccountDto, UpdateZoomAccountDto } from '../dto/zoom-account.dto';
import { ZoomApiAdapter } from '../adapters/zoom-api.adapter';

// Default colors for 10 Zoom accounts
const DEFAULT_COLORS = [
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#84CC16', // Lime
    '#F97316', // Orange
    '#6366F1', // Indigo
];

@Injectable()
export class ZoomAccountService {
    private readonly logger = new Logger(ZoomAccountService.name);

    constructor(
        @InjectRepository(ZoomAccount)
        private readonly accountRepo: Repository<ZoomAccount>,
        private readonly zoomApi: ZoomApiAdapter,
    ) { }

    /**
     * Get all Zoom accounts
     */
    async findAll(): Promise<ZoomAccount[]> {
        return this.accountRepo.find({
            order: { displayOrder: 'ASC' },
        });
    }

    /**
     * Get active Zoom accounts only
     */
    async findActive(): Promise<ZoomAccount[]> {
        return this.accountRepo.find({
            where: { isActive: true },
            order: { displayOrder: 'ASC' },
        });
    }

    /**
     * Get a single Zoom account
     */
    async findOne(id: string): Promise<ZoomAccount> {
        const account = await this.accountRepo.findOne({ where: { id } });
        if (!account) {
            throw new NotFoundException('Zoom account not found');
        }
        return account;
    }

    /**
     * Create a new Zoom account
     */
    async create(dto: CreateZoomAccountDto): Promise<ZoomAccount> {
        // Get next display order
        const lastAccount = await this.accountRepo.findOne({
            where: {},
            order: { displayOrder: 'DESC' },
        });
        const nextOrder = (lastAccount?.displayOrder || 0) + 1;

        // Get Zoom user ID if API is configured
        let zoomUserId = dto.zoomUserId;
        if (!zoomUserId && this.zoomApi.isConfigured()) {
            try {
                const zoomUser = await this.zoomApi.getZoomUser(dto.email);
                zoomUserId = zoomUser?.id;
            } catch (error) {
                this.logger.warn(`Could not fetch Zoom user ID for ${dto.email}`);
            }
        }

        const account = this.accountRepo.create({
            ...dto,
            zoomUserId,
            displayOrder: dto.displayOrder || nextOrder,
            colorHex: dto.colorHex || DEFAULT_COLORS[(nextOrder - 1) % DEFAULT_COLORS.length],
        });

        return this.accountRepo.save(account);
    }

    /**
     * Update a Zoom account
     */
    async update(id: string, dto: UpdateZoomAccountDto): Promise<ZoomAccount> {
        const account = await this.findOne(id);

        // If email changed, try to get new Zoom user ID
        if (dto.email && dto.email !== account.email && this.zoomApi.isConfigured()) {
            try {
                const zoomUser = await this.zoomApi.getZoomUser(dto.email);
                dto.zoomUserId = zoomUser?.id;
            } catch (error) {
                this.logger.warn(`Could not fetch Zoom user ID for ${dto.email}`);
            }
        }

        Object.assign(account, dto);
        return this.accountRepo.save(account);
    }

    /**
     * Delete a Zoom account
     */
    async delete(id: string): Promise<void> {
        const account = await this.findOne(id);
        await this.accountRepo.remove(account);
    }

    /**
     * Reorder Zoom accounts
     */
    async reorder(accountIds: string[]): Promise<ZoomAccount[]> {
        const updates = accountIds.map((id, index) =>
            this.accountRepo.update(id, { displayOrder: index + 1 })
        );
        await Promise.all(updates);
        return this.findAll();
    }

    /**
     * Sync with Zoom API to get user IDs
     */
    async syncWithZoom(): Promise<{ synced: number; failed: number }> {
        if (!this.zoomApi.isConfigured()) {
            throw new Error('Zoom API not configured');
        }

        const accounts = await this.findAll();
        let synced = 0;
        let failed = 0;

        for (const account of accounts) {
            try {
                const zoomUser = await this.zoomApi.getZoomUser(account.email);
                if (zoomUser) {
                    await this.accountRepo.update(account.id, {
                        zoomUserId: zoomUser.id,
                    });
                    synced++;
                } else {
                    failed++;
                }
            } catch (error) {
                this.logger.warn(`Failed to sync Zoom user for ${account.email}`);
                failed++;
            }
        }

        return { synced, failed };
    }

    /**
     * Initialize default 10 Zoom accounts (one-time setup)
     */
    async initializeDefaultAccounts(emails: string[]): Promise<ZoomAccount[]> {
        const existingCount = await this.accountRepo.count();
        if (existingCount > 0) {
            this.logger.warn('Zoom accounts already exist, skipping initialization');
            return this.findAll();
        }

        const accounts: ZoomAccount[] = [];
        for (let i = 0; i < emails.length; i++) {
            const account = await this.create({
                name: `Zoom ${i + 1}`,
                email: emails[i],
                displayOrder: i + 1,
                colorHex: DEFAULT_COLORS[i % DEFAULT_COLORS.length],
                accountType: i === 0 ? 'MASTER' as any : 'SUB' as any,
            });
            accounts.push(account);
        }

        this.logger.log(`Initialized ${accounts.length} Zoom accounts`);
        return accounts;
    }
}
