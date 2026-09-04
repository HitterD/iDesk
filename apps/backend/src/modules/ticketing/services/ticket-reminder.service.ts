import {
    Injectable,
    NotFoundException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketReminder } from '../entities/ticket-reminder.entity';
import { Ticket } from '../entities/ticket.entity';
import { CreateTicketReminderDto } from '../dto/ticket-reminder.dto';

@Injectable()
export class TicketReminderService {
    private readonly logger = new Logger(TicketReminderService.name);

    constructor(
        @InjectRepository(TicketReminder)
        private readonly reminderRepo: Repository<TicketReminder>,
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
    ) {}

    async createReminder(
        ticketId: string,
        dto: CreateTicketReminderDto,
        actor: { userId: string; fullName: string },
    ): Promise<TicketReminder> {
        const ticket = await this.ticketRepo.findOne({
            where: { id: ticketId },
            relations: ['assignedTo'],
        });

        if (!ticket) {
            throw new NotFoundException(`Ticket with ID ${ticketId} not found`);
        }

        const remindDate = new Date(dto.remindAt);
        if (isNaN(remindDate.getTime())) {
            throw new BadRequestException('Waktu pengingat tidak valid');
        }

        if (remindDate.getTime() <= Date.now()) {
            throw new BadRequestException('Waktu pengingat harus berada di masa mendatang');
        }

        const reminder = this.reminderRepo.create({
            ticketId: ticket.id,
            remindAt: remindDate,
            note: dto.note?.trim() || null,
            createdById: actor.userId,
            isSent: false,
        });

        const saved = await this.reminderRepo.save(reminder);

        this.logger.log(
            `Reminder created for ticket ${ticket.ticketNumber || ticket.id} at ${remindDate.toISOString()} by ${actor.fullName} (${actor.userId})`,
        );

        return saved;
    }

    async getReminders(ticketId: string): Promise<TicketReminder[]> {
        return this.reminderRepo.find({
            where: { ticketId },
            relations: ['createdBy'],
            order: { remindAt: 'ASC', createdAt: 'DESC' },
        });
    }

    async deleteReminder(
        ticketId: string,
        reminderId: string,
        actor: { userId: string; fullName: string; role: string },
    ): Promise<{ success: boolean; message: string }> {
        const reminder = await this.reminderRepo.findOne({
            where: { id: reminderId, ticketId },
        });

        if (!reminder) {
            throw new NotFoundException('Pengingat tidak ditemukan');
        }

        if (reminder.isSent) {
            throw new BadRequestException('Pengingat yang sudah terkirim tidak dapat dibatalkan');
        }

        await this.reminderRepo.remove(reminder);

        this.logger.log(
            `Reminder ${reminderId} for ticket ${ticketId} cancelled by ${actor.fullName} (${actor.userId})`,
        );

        return { success: true, message: 'Pengingat berhasil dibatalkan' };
    }
}
