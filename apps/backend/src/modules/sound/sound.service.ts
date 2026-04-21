import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationSound, NotificationEventType } from './entities/notification-sound.entity';
import { CreateSoundDto, UpdateSoundDto } from './dto';

@Injectable()
export class SoundService {
    // Default sounds (built-in) - use enum values from entity
    private readonly DEFAULT_SOUNDS: { eventType: NotificationEventType; url: string }[] = [
        { eventType: NotificationEventType.NEW_TICKET, url: '/sounds/new-ticket.mp3' },
        { eventType: NotificationEventType.MESSAGE, url: '/sounds/new-message.mp3' },
        { eventType: NotificationEventType.ASSIGNED, url: '/sounds/assigned.mp3' },
        { eventType: NotificationEventType.RESOLVED, url: '/sounds/resolved.mp3' },
        { eventType: NotificationEventType.CRITICAL, url: '/sounds/critical.mp3' },
        { eventType: NotificationEventType.SLA_WARNING, url: '/sounds/sla-warning.mp3' },
        { eventType: NotificationEventType.SLA_BREACH, url: '/sounds/sla-breach.mp3' },
    ];

    constructor(
        @InjectRepository(NotificationSound)
        private readonly soundRepo: Repository<NotificationSound>,
    ) { }

    async findAll(): Promise<NotificationSound[]> {
        return this.soundRepo.find({
            order: { eventType: 'ASC', isDefault: 'DESC' },
        });
    }

    async findByEventType(eventType: NotificationEventType): Promise<NotificationSound[]> {
        return this.soundRepo.find({
            where: { eventType },
            order: { isDefault: 'DESC', createdAt: 'ASC' },
        });
    }

    async getActiveSound(eventType: NotificationEventType): Promise<NotificationSound | null> {
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
    }

    async getActiveSoundUrl(eventType: NotificationEventType): Promise<string> {
        const sound = await this.getActiveSound(eventType);

        if (sound) {
            return sound.soundUrl;
        }

        // Fallback to built-in default
        const defaultSound = this.DEFAULT_SOUNDS.find(s => s.eventType === eventType);
        return defaultSound?.url || '/sounds/default.mp3';
    }

    async findOne(id: string): Promise<NotificationSound> {
        const sound = await this.soundRepo.findOne({ where: { id } });
        if (!sound) {
            throw new NotFoundException('Sound not found');
        }
        return sound;
    }

    async create(dto: CreateSoundDto, uploadedById?: string): Promise<NotificationSound> {
        // Check if this is trying to create a duplicate default
        if (dto.isDefault) {
            const existingDefault = await this.soundRepo.findOne({
                where: { eventType: dto.eventType, isDefault: true },
            });
            if (existingDefault) {
                throw new BadRequestException('Default sound already exists for this event type');
            }
        }

        const sound = this.soundRepo.create({
            ...dto,
            soundName: dto.name, // Map dto.name to entity.soundName
            uploadedById,
            isDefault: dto.isDefault ?? false,
            isActive: dto.isActive ?? false,
        });

        return this.soundRepo.save(sound);
    }

    async update(id: string, dto: UpdateSoundDto): Promise<NotificationSound> {
        const sound = await this.findOne(id);

        // Cannot update default sounds' core properties
        if (sound.isDefault && dto.soundUrl) {
            throw new BadRequestException('Cannot change sound URL for default sounds');
        }

        Object.assign(sound, dto);
        return this.soundRepo.save(sound);
    }

    async setActiveSound(eventType: NotificationEventType, soundId: string): Promise<NotificationSound> {
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
        return this.soundRepo.save(sound);
    }

    async delete(id: string): Promise<void> {
        const sound = await this.findOne(id);

        if (sound.isDefault) {
            throw new BadRequestException('Cannot delete default sounds');
        }

        await this.soundRepo.remove(sound);
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
        eventType: NotificationEventType,
        name: string,
        filePath: string,
        uploadedById: string,
    ): Promise<NotificationSound> {
        const sound = this.soundRepo.create({
            eventType,
            soundName: name,
            soundUrl: filePath,
            isDefault: false,
            isActive: false,
            uploadedById,
        });

        return this.soundRepo.save(sound);
    }
}
