import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LostItemReport, LostItemStatus } from './entities/lost-item-report.entity';
import { Ticket, TicketType, TicketStatus } from '../ticketing/entities/ticket.entity';
import { User } from '../users/entities/user.entity';
import { CreateLostItemDto, UpdateLostItemStatusDto } from './dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';

@Injectable()
export class LostItemService {
    constructor(
        private readonly auditService: AuditService,
        @InjectRepository(LostItemReport)
        private readonly lostItemRepo: Repository<LostItemReport>,
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    async create(userId: string, dto: CreateLostItemDto): Promise<LostItemReport> {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        // Create ticket
        const ticket = this.ticketRepo.create({
            title: dto.title || `Lost Item Report: ${dto.itemName}`,
            description: dto.description || `${dto.itemType} hilang di ${dto.lastSeenLocation}`,
            ticketType: TicketType.LOST_ITEM,
            status: TicketStatus.TODO,
            priority: 'HIGH',
            category: 'LOST_ITEM',
            userId: userId,
            siteId: user.siteId,
        } as Partial<Ticket>);

        const savedTicket = await this.ticketRepo.save(ticket);

        // Create Lost Item report
        const lostItem = this.lostItemRepo.create({
            ticketId: savedTicket.id,
            itemType: dto.itemType,
            itemName: dto.itemName,
            serialNumber: dto.serialNumber,
            assetTag: dto.assetTag,
            lastSeenLocation: dto.lastSeenLocation,
            lastSeenDatetime: new Date(dto.lastSeenDatetime),
            circumstances: dto.circumstances,
            witnessContact: dto.witnessContact,
            hasPoliceReport: dto.hasPoliceReport || false,
            policeReportNumber: dto.policeReportNumber,
            estimatedValue: dto.estimatedValue,
            finderRewardOffered: dto.finderRewardOffered || false,
            status: LostItemStatus.REPORTED,
        } as Partial<LostItemReport>);

        const saved = await this.lostItemRepo.save(lostItem);

        this.eventEmitter.emit('lost-item.created', { lostItem: saved, ticket: savedTicket, user });

        this.auditService.logAsync({
            userId,
            action: AuditAction.LOST_ITEM_CREATE,
            entityType: 'LostItemReport',
            entityId: saved.id,
            description: `Created lost item report for ${dto.itemName}`,
            newValue: { itemName: dto.itemName, itemType: dto.itemType },
        });

        return saved;
    }

    async findAll(options: { siteId?: string; status?: string } = {}): Promise<LostItemReport[]> {
        const qb = this.lostItemRepo.createQueryBuilder('lost')
            .leftJoinAndSelect('lost.ticket', 'ticket')
            .leftJoinAndSelect('ticket.user', 'user');

        if (options.siteId) {
            qb.andWhere('ticket.siteId = :siteId', { siteId: options.siteId });
        }

        if (options.status) {
            qb.andWhere('lost.status = :status', { status: options.status });
        }

        return qb.orderBy('lost.createdAt', 'DESC').getMany();
    }

    async findOne(id: string): Promise<LostItemReport> {
        const lostItem = await this.lostItemRepo.findOne({
            where: { id },
            relations: ['ticket', 'ticket.user'],
        });
        if (!lostItem) {
            throw new NotFoundException('Lost Item report not found');
        }
        return lostItem;
    }

    async findByTicketId(ticketId: string): Promise<LostItemReport | null> {
        return this.lostItemRepo.findOne({
            where: { ticketId },
            relations: ['ticket'],
        });
    }

    async updateStatus(id: string, dto: UpdateLostItemStatusDto, userId?: string): Promise<LostItemReport> {
        const lostItem = await this.findOne(id);

        lostItem.status = dto.status as LostItemStatus;

        if (dto.status === 'FOUND') {
            lostItem.foundAt = new Date();
            lostItem.foundLocation = dto.foundLocation || null;
            lostItem.foundBy = dto.foundBy || null;

            // Resolve ticket
            await this.ticketRepo.update(lostItem.ticketId, {
                status: TicketStatus.RESOLVED,
                resolvedAt: new Date(),
            });
        } else if (dto.status === 'CLOSED_LOST') {
            // Close ticket as cancelled
            await this.ticketRepo.update(lostItem.ticketId, {
                status: TicketStatus.CANCELLED,
            });
        }

        const saved = await this.lostItemRepo.save(lostItem);

        this.eventEmitter.emit('lost-item.status-updated', { lostItem: saved, newStatus: dto.status });

        return saved;
    }

    async uploadPoliceReport(id: string, filePath: string, reportNumber: string): Promise<LostItemReport> {
        const lostItem = await this.findOne(id);

        lostItem.hasPoliceReport = true;
        lostItem.policeReportNumber = reportNumber;
        lostItem.policeReportFile = filePath;

        return this.lostItemRepo.save(lostItem);
    }
}
