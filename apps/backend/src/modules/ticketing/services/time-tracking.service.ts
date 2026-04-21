import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { TimeEntry } from '../entities/time-entry.entity';
import { Ticket } from '../entities/ticket.entity';

@Injectable()
export class TimeTrackingService {
    private readonly logger = new Logger(TimeTrackingService.name);

    constructor(
        @InjectRepository(TimeEntry)
        private readonly timeEntryRepo: Repository<TimeEntry>,
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
    ) { }

    /**
     * Start a new time entry for a ticket
     */
    async startTimer(ticketId: string, userId: string, description?: string): Promise<TimeEntry> {
        // Check if there's already a running timer
        const runningEntry = await this.timeEntryRepo.findOne({
            where: { ticketId, userId, isRunning: true },
        });

        if (runningEntry) {
            throw new BadRequestException('A timer is already running for this ticket');
        }

        // Verify ticket exists
        const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
        if (!ticket) {
            throw new NotFoundException('Ticket not found');
        }

        const entry = this.timeEntryRepo.create({
            ticketId,
            userId,
            startTime: new Date(),
            isRunning: true,
            description,
        });

        return this.timeEntryRepo.save(entry);
    }

    /**
     * Stop a running time entry
     */
    async stopTimer(entryId: string, userId: string): Promise<TimeEntry> {
        const entry = await this.timeEntryRepo.findOne({
            where: { id: entryId, userId },
        });

        if (!entry) {
            throw new NotFoundException('Time entry not found');
        }

        if (!entry.isRunning) {
            throw new BadRequestException('Timer is not running');
        }

        const endTime = new Date();
        const durationMinutes = Math.round(
            (endTime.getTime() - entry.startTime.getTime()) / (1000 * 60)
        );

        entry.endTime = endTime;
        entry.durationMinutes = durationMinutes;
        entry.isRunning = false;

        return this.timeEntryRepo.save(entry);
    }

    /**
     * Stop timer by ticket ID (for convenience)
     */
    async stopTimerByTicket(ticketId: string, userId: string): Promise<TimeEntry> {
        const entry = await this.timeEntryRepo.findOne({
            where: { ticketId, userId, isRunning: true },
        });

        if (!entry) {
            throw new NotFoundException('No running timer found for this ticket');
        }

        return this.stopTimer(entry.id, userId);
    }

    /**
     * Add a manual time entry
     */
    async addManualEntry(
        ticketId: string,
        userId: string,
        durationMinutes: number,
        description?: string,
        date?: Date,
    ): Promise<TimeEntry> {
        const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
        if (!ticket) {
            throw new NotFoundException('Ticket not found');
        }

        const entryDate = date || new Date();
        const entry = this.timeEntryRepo.create({
            ticketId,
            userId,
            startTime: entryDate,
            endTime: new Date(entryDate.getTime() + durationMinutes * 60 * 1000),
            durationMinutes,
            isRunning: false,
            description,
        });

        return this.timeEntryRepo.save(entry);
    }

    /**
     * Get all time entries for a ticket
     */
    async getTicketTimeEntries(ticketId: string): Promise<TimeEntry[]> {
        return this.timeEntryRepo.find({
            where: { ticketId },
            relations: ['user'],
            order: { createdAt: 'DESC' },
        });
    }

    /**
     * Get total time spent on a ticket
     */
    async getTicketTotalTime(ticketId: string): Promise<number> {
        const entries = await this.timeEntryRepo.find({
            where: { ticketId },
        });

        return entries.reduce((sum, entry) => {
            if (entry.isRunning) {
                // Calculate current running time
                const runningMinutes = Math.round(
                    (Date.now() - entry.startTime.getTime()) / (1000 * 60)
                );
                return sum + runningMinutes;
            }
            return sum + entry.durationMinutes;
        }, 0);
    }

    /**
     * Get running timer for a user on a ticket
     */
    async getRunningTimer(ticketId: string, userId: string): Promise<TimeEntry | null> {
        return this.timeEntryRepo.findOne({
            where: { ticketId, userId, isRunning: true },
        });
    }

    /**
     * Update a time entry
     */
    async updateEntry(
        entryId: string,
        userId: string,
        updates: { durationMinutes?: number; description?: string },
    ): Promise<TimeEntry> {
        const entry = await this.timeEntryRepo.findOne({
            where: { id: entryId, userId },
        });

        if (!entry) {
            throw new NotFoundException('Time entry not found');
        }

        if (entry.isRunning) {
            throw new BadRequestException('Cannot update a running timer');
        }

        if (updates.durationMinutes !== undefined) {
            entry.durationMinutes = updates.durationMinutes;
            entry.endTime = new Date(
                entry.startTime.getTime() + updates.durationMinutes * 60 * 1000
            );
        }

        if (updates.description !== undefined) {
            entry.description = updates.description;
        }

        return this.timeEntryRepo.save(entry);
    }

    /**
     * Delete a time entry
     */
    async deleteEntry(entryId: string, userId: string): Promise<void> {
        const entry = await this.timeEntryRepo.findOne({
            where: { id: entryId, userId },
        });

        if (!entry) {
            throw new NotFoundException('Time entry not found');
        }

        await this.timeEntryRepo.remove(entry);
    }

    /**
     * Get user's time entries for a date range
     */
    async getUserTimeEntries(
        userId: string,
        startDate: Date,
        endDate: Date,
    ): Promise<TimeEntry[]> {
        return this.timeEntryRepo.find({
            where: {
                userId,
                createdAt: Between(startDate, endDate),
            },
            relations: ['ticket'],
            order: { createdAt: 'DESC' },
        });
    }
}
