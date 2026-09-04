import { Injectable, NotFoundException, BadRequestException, ForbiddenException, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationSound, NotificationEventType, normalizeNotificationEventType } from './entities/notification-sound.entity';
import { CreateSoundDto, UpdateSoundDto } from './dto';
import { CacheService } from '../../shared/core/cache/cache.service';

@Injectable()
export class SoundService implements OnModuleInit {
    private readonly logger = new Logger(SoundService.name);
    private static readonly CACHE_KEY_ALL = 'sounds:all';
    private static readonly CACHE_TTL = 60; // 1 min

    // Default sounds (built-in) matching static assets in /sounds/default/
    private readonly DEFAULT_SOUNDS: { eventType: NotificationEventType; soundName: string; url: string }[] = [
        { eventType: NotificationEventType.NEW_TICKET, soundName: 'New Ticket Alert (Default)', url: '/sounds/default/new-ticket.mp3' },
        { eventType: NotificationEventType.MESSAGE, soundName: 'New Message (Default)', url: '/sounds/default/message.mp3' },
        { eventType: NotificationEventType.ASSIGNED, soundName: 'Ticket Assigned (Default)', url: '/sounds/default/assigned.mp3' },
        { eventType: NotificationEventType.RESOLVED, soundName: 'Ticket Resolved (Default)', url: '/sounds/default/resolved.mp3' },
        { eventType: NotificationEventType.CRITICAL, soundName: 'Critical Alert (Default)', url: '/sounds/default/critical-alert.mp3' },
        { eventType: NotificationEventType.SLA_WARNING, soundName: 'SLA Warning (Default)', url: '/sounds/default/sla-warning.mp3' },
        { eventType: NotificationEventType.SLA_BREACH, soundName: 'SLA Breach (Default)', url: '/sounds/default/sla-breach.mp3' },
    ];

    constructor(
        @InjectRepository(NotificationSound)
        private readonly soundRepo: Repository<NotificationSound>,
        private readonly cacheService: CacheService,
    ) { }

    async onModuleInit() {
        await this.ensureDefaultSounds();
    }

    async ensureDefaultSounds(): Promise<void> {
        try {
            for (const def of this.DEFAULT_SOUNDS) {
                const existing = await this.soundRepo.findOne({
                    where: { eventType: def.eventType, isDefault: true },
                });
                if (!existing) {
                    const defaultSound = this.soundRepo.create({
                        eventType: def.eventType,
                        soundName: def.soundName,
                        soundUrl: def.url,
                        isDefault: true,
                        isActive: true,
                    });
                    await this.soundRepo.save(defaultSound);
                } else if (existing.soundUrl !== def.url) {
                    existing.soundUrl = def.url;
                    existing.soundName = def.soundName;
                    await this.soundRepo.save(existing);
                }
            }
            await this.invalidateAllSoundCaches();
        } catch (err) {
            this.logger.warn(`Failed to seed default notification sounds: ${err?.message || err}`);
        }
    }

    async findAll(): Promise<NotificationSound[]> {
        // P1 perf: settings reference data, hit by every notification center render.
        return this.cacheService.getOrSet(
            SoundService.CACHE_KEY_ALL,
            async () => {
                let items = await this.soundRepo.find({
                    order: { eventType: 'ASC', isDefault: 'DESC', createdAt: 'ASC' },
                });
                if (!items || items.length === 0) {
                    await this.ensureDefaultSounds();
                    items = await this.soundRepo.find({
                        order: { eventType: 'ASC', isDefault: 'DESC', createdAt: 'ASC' },
                    });
                }
                return items;
            },
            SoundService.CACHE_TTL,
        );
    }

    async findByEventType(rawEventType: any): Promise<NotificationSound[]> {
        const eventType = normalizeNotificationEventType(rawEventType);
        return this.cacheService.getOrSet(
            `sounds:event:${eventType}`,
            () => this.soundRepo.find({
                where: { eventType },
                order: { isDefault: 'DESC', createdAt: 'ASC' },
            }),
            SoundService.CACHE_TTL,
        );
    }

    async getActiveSound(rawEventType: any): Promise<NotificationSound | null> {
        const eventType = normalizeNotificationEventType(rawEventType);
        return this.cacheService.getOrSet(
            `sounds:active:${eventType}`,
            async () => {
                // First try to find active custom sound
                let sound = await this.soundRepo.findOne({
                    where: { eventType, isActive: true },
                });

                // If no active sound, get the default
                if (!sound) {
                    sound = await this.soundRepo.findOne({
                        where: { eventType, isDefault: true },
                    });
                }

                return sound;
            },
            SoundService.CACHE_TTL,
        );
    }

    async getActiveSoundUrl(rawEventType: any): Promise<string> {
        const eventType = normalizeNotificationEventType(rawEventType);
        const sound = await this.getActiveSound(eventType);

        if (sound) {
            return sound.soundUrl;
        }

        // Fallback to built-in default
        const defaultSound = this.DEFAULT_SOUNDS.find(s => s.eventType === eventType);
        return defaultSound?.url || '/sounds/default/new-ticket.mp3';
    }

    private async invalidateAllSoundCaches(): Promise<void> {
        // Invalidate all + per-event + per-active-event caches
        const keys = [
            SoundService.CACHE_KEY_ALL,
            ...Object.values(NotificationEventType).map(et => `sounds:event:${et}`),
            ...Object.values(NotificationEventType).map(et => `sounds:active:${et}`),
        ];
        await Promise.all(
            keys.map(k => this.cacheService.delAsync(k).catch(() => undefined)),
        );
    }

    async findOne(id: string): Promise<NotificationSound> {
        const sound = await this.soundRepo.findOne({ where: { id } });
        if (!sound) {
            throw new NotFoundException('Sound not found');
        }
        return sound;
    }

    async create(dto: CreateSoundDto, uploadedById?: string): Promise<NotificationSound> {
        const eventType = normalizeNotificationEventType(dto.eventType);
        // Check if this is trying to create a duplicate default
        if (dto.isDefault) {
            const existingDefault = await this.soundRepo.findOne({
                where: { eventType, isDefault: true },
            });
            if (existingDefault) {
                throw new BadRequestException('Default sound already exists for this event type');
            }
        }

        const sound = this.soundRepo.create({
            ...dto,
            eventType,
            soundName: dto.name, // Map dto.name to entity.soundName
            uploadedById,
            isDefault: dto.isDefault ?? false,
            isActive: dto.isActive ?? false,
        });

        const saved = await this.soundRepo.save(sound);
        await this.invalidateAllSoundCaches();
        return saved;
    }

    async update(id: string, dto: UpdateSoundDto): Promise<NotificationSound> {
        const sound = await this.findOne(id);

        // Cannot update default sounds' core properties
        if (sound.isDefault && dto.soundUrl) {
            throw new BadRequestException('Cannot change sound URL for default sounds');
        }

        Object.assign(sound, dto);
        const saved = await this.soundRepo.save(sound);
        await this.invalidateAllSoundCaches();
        return saved;
    }

    async setActiveSound(rawEventType: any, soundId: string): Promise<NotificationSound> {
        const eventType = normalizeNotificationEventType(rawEventType);
        const sound = await this.findOne(soundId);

        if (sound.eventType !== eventType) {
            throw new BadRequestException('Sound does not match event type');
        }

        // Deactivate all other sounds for this event type
        await this.soundRepo.update(
            { eventType },
            { isActive: false }
        );

        // Activate the selected sound
        sound.isActive = true;
        const saved = await this.soundRepo.save(sound);
        await this.invalidateAllSoundCaches();
        return saved;
    }

    async delete(id: string, userId?: string, userRole?: string): Promise<void> {
        const sound = await this.findOne(id);

        if (sound.isDefault) {
            throw new BadRequestException('Cannot delete default sounds');
        }

        if (userRole !== 'ADMIN' && sound.uploadedById && sound.uploadedById !== userId) {
            throw new ForbiddenException('You can only delete custom sounds you uploaded');
        }

        await this.soundRepo.remove(sound);
        await this.invalidateAllSoundCaches();
    }

    async getAllEventTypes(): Promise<{ eventType: NotificationEventType; activeSound: NotificationSound | null }[]> {
        const result = [];

        for (const eventType of Object.values(NotificationEventType)) {
            const activeSound = await this.getActiveSound(eventType);
            result.push({ eventType, activeSound });
        }

        return result;
    }

    async uploadCustomSound(
        rawEventType: any,
        name: string,
        filePath: string,
        uploadedById: string,
    ): Promise<NotificationSound> {
        const eventType = normalizeNotificationEventType(rawEventType);
        const sound = this.soundRepo.create({
            eventType,
            soundName: name,
            soundUrl: filePath,
            isDefault: false,
            isActive: false,
            uploadedById,
        });

        const saved = await this.soundRepo.save(sound);
        await this.invalidateAllSoundCaches();
        return saved;
    }
}
