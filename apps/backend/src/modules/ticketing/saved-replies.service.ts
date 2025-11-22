import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedReply } from './entities/saved-reply.entity';
import { CreateSavedReplyDto } from './dto/create-saved-reply.dto';

@Injectable()
export class SavedRepliesService {
    constructor(
        @InjectRepository(SavedReply)
        private readonly savedReplyRepo: Repository<SavedReply>,
    ) { }

    async create(userId: string, dto: CreateSavedReplyDto): Promise<SavedReply> {
        const savedReply = this.savedReplyRepo.create({
            title: dto.title,
            content: dto.content,
            userId: dto.isGlobal ? null : userId,
        });
        return this.savedReplyRepo.save(savedReply);
    }

    async findAll(userId: string): Promise<SavedReply[]> {
        return this.savedReplyRepo.find({
            where: [
                { userId: null }, // Global replies
                { userId: userId }, // Personal replies
            ],
            order: { title: 'ASC' },
        });
    }
}
