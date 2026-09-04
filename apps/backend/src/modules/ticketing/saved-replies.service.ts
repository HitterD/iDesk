import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedReply } from './entities/saved-reply.entity';
import { CreateSavedReplyDto } from './dto/create-saved-reply.dto';
import { UpdateSavedReplyDto } from './dto/update-saved-reply.dto';

export const DEFAULT_SAVED_REPLIES = [
    {
        title: 'Greeting',
        content: 'Halo {user_name}, terima kasih telah menghubungi iDesk Support. Saya {agent_name} akan membantu menyelesaikan masalah Anda. Mohon jelaskan lebih detail mengenai kendala yang dihadapi.',
        category: 'General',
        shortcut: '/hi',
    },
    {
        title: 'Request More Info',
        content: 'Untuk membantu menyelesaikan masalah pada tiket #{ticket_id}, saya memerlukan informasi tambahan:\n1. Screenshot error yang muncul\n2. Langkah-langkah yang dilakukan sebelum error\n3. Waktu kejadian',
        category: 'General',
        shortcut: '/info',
    },
    {
        title: 'Ticket Escalated',
        content: 'Tiket #{ticket_id} Anda telah di-eskalasi ke tim teknis untuk penanganan lebih lanjut. Kami akan menginformasikan update perkembangan dalam waktu 1x24 jam kerja.',
        category: 'Status Update',
        shortcut: '/esc',
    },
    {
        title: 'Waiting for Vendor',
        content: 'Kami sedang menunggu respons dari vendor terkait untuk issue ini. Kami akan segera menginformasikan kepada Anda jika sudah ada update terbaru.',
        category: 'Status Update',
        shortcut: '/vendor',
    },
    {
        title: 'Issue Resolved',
        content: 'Kendala pada tiket #{ticket_id} telah berhasil diselesaikan. Jika ada kendala lain atau pertanyaan lanjutan, silakan hubungi kami kembali. Terima kasih telah menggunakan layanan iDesk.',
        category: 'Closing',
        shortcut: '/done',
    },
    {
        title: 'Password Reset',
        content: 'Untuk reset password akun Anda, silakan ikuti langkah berikut:\n1. Klik "Lupa Password" di halaman login\n2. Masukkan email terdaftar\n3. Cek inbox email untuk link reset\n4. Buat password baru\n\nJika masih mengalami kendala, silakan informasikan.',
        category: 'How To',
        shortcut: '/pwd',
    },
];

@Injectable()
export class SavedRepliesService {
    constructor(
        @InjectRepository(SavedReply)
        private readonly savedReplyRepo: Repository<SavedReply>,
    ) { }

    private normalizeShortcut(shortcut?: string | null): string | null {
        if (!shortcut) return null;
        let s = shortcut.trim().toLowerCase();
        if (!s.startsWith('/')) {
            s = `/${s}`;
        }
        return s;
    }

    async create(userId: string, dto: CreateSavedReplyDto): Promise<SavedReply> {
        const savedReply = this.savedReplyRepo.create({
            title: dto.title.trim(),
            content: dto.content,
            shortcut: this.normalizeShortcut(dto.shortcut),
            category: dto.category?.trim() || 'General',
            userId: dto.isGlobal ? null : userId,
        } as Partial<SavedReply>);
        return this.savedReplyRepo.save(savedReply);
    }

    async findAll(userId: string): Promise<SavedReply[]> {
        const personalReplies = await this.savedReplyRepo.find({
            where: { userId },
            order: { createdAt: 'ASC' },
        });

        // Auto-seed default templates for newly active agent profiles
        if (personalReplies.length === 0) {
            const seedEntities = DEFAULT_SAVED_REPLIES.map(item =>
                this.savedReplyRepo.create({
                    title: item.title,
                    content: item.content,
                    category: item.category,
                    shortcut: item.shortcut,
                    userId,
                } as Partial<SavedReply>)
            );
            return this.savedReplyRepo.save(seedEntities);
        }

        return personalReplies;
    }

    async findOne(userId: string, id: string): Promise<SavedReply> {
        const item = await this.savedReplyRepo.findOne({ where: { id } });
        if (!item || (item.userId && item.userId !== userId)) {
            throw new NotFoundException('Template quick reply tidak ditemukan.');
        }
        return item;
    }

    async update(userId: string, id: string, dto: UpdateSavedReplyDto, isAdmin = false): Promise<SavedReply> {
        const item = await this.savedReplyRepo.findOne({ where: { id } });
        if (!item) {
            throw new NotFoundException('Template quick reply tidak ditemukan.');
        }
        if (item.userId && item.userId !== userId && !isAdmin) {
            throw new ForbiddenException('Anda tidak memiliki akses untuk mengubah template ini.');
        }

        if (dto.title !== undefined) item.title = dto.title.trim();
        if (dto.content !== undefined) item.content = dto.content;
        if (dto.category !== undefined) item.category = dto.category.trim() || 'General';
        if (dto.shortcut !== undefined) item.shortcut = this.normalizeShortcut(dto.shortcut);

        return this.savedReplyRepo.save(item);
    }

    async delete(userId: string, id: string, isAdmin = false): Promise<{ success: boolean }> {
        const item = await this.savedReplyRepo.findOne({ where: { id } });
        if (!item) {
            throw new NotFoundException('Template quick reply tidak ditemukan.');
        }
        if (item.userId && item.userId !== userId && !isAdmin) {
            throw new ForbiddenException('Anda tidak memiliki akses untuk menghapus template ini.');
        }

        await this.savedReplyRepo.remove(item);
        return { success: true };
    }

    async resetDefaults(userId: string): Promise<SavedReply[]> {
        // Delete current personal replies
        await this.savedReplyRepo.delete({ userId });

        // Seed fresh default replies
        const seedEntities = DEFAULT_SAVED_REPLIES.map(item =>
            this.savedReplyRepo.create({
                title: item.title,
                content: item.content,
                category: item.category,
                shortcut: item.shortcut,
                userId,
            } as Partial<SavedReply>)
        );
        return this.savedReplyRepo.save(seedEntities);
    }
}

