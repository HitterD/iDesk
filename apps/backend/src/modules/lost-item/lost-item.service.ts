import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { LostItemReport, LostItemStatus } from './entities/lost-item-report.entity';
import { LostItemStatusLog } from './entities/lost-item-status-log.entity';
import { Ticket, TicketType, TicketStatus } from '../ticketing/entities/ticket.entity';
import { User } from '../users/entities/user.entity';
import { CreateLostItemDto, UpdateLostItemStatusDto } from './dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LostItemService {
    constructor(
        private readonly auditService: AuditService,
        private readonly configService: ConfigService,
        @InjectRepository(LostItemReport)
        private readonly lostItemRepo: Repository<LostItemReport>,
        @InjectRepository(LostItemStatusLog)
        private readonly statusLogRepo: Repository<LostItemStatusLog>,
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    private generateQrToken(): string {
        return randomUUID();
    }

    private buildQrUrl(token: string): string {
        const base = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
        return `${base}/found?r=${token}`;
    }

    private async logStatusChange(
        lostItemReportId: string,
        fromStatus: string | null,
        toStatus: string,
        changedById?: string,
        notes?: string,
    ): Promise<void> {
        const log = this.statusLogRepo.create({
            lostItemReportId,
            fromStatus,
            toStatus,
            changedById: changedById ?? null,
            notes: notes ?? null,
        });
        await this.statusLogRepo.save(log);
    }

    async create(userId: string, dto: CreateLostItemDto): Promise<LostItemReport> {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        const ticket = this.ticketRepo.create({
            title: dto.title || `Lost Item Report: ${dto.itemName}`,
            description: dto.description || `${dto.itemType} hilang di ${dto.lastSeenLocation}`,
            ticketType: TicketType.LOST_ITEM,
            status: TicketStatus.TODO,
            priority: 'HIGH',
            category: 'LOST_ITEM',
            userId,
            siteId: user.siteId,
        } as Partial<Ticket>);
        const savedTicket = await this.ticketRepo.save(ticket);

        const qrCodeToken = this.generateQrToken();
        const qrCodeUrl = this.buildQrUrl(qrCodeToken);

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
            photoUrls: dto.photoUrls || [],
            qrCodeToken,
            qrCodeUrl,
            status: LostItemStatus.REPORTED,
        } as Partial<LostItemReport>);
        const saved = await this.lostItemRepo.save(lostItem);

        await this.logStatusChange(saved.id, null, LostItemStatus.REPORTED, userId, 'Report created');

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
        const qb = this.lostItemRepo.createQueryBuilder('r')
            .leftJoinAndSelect('r.ticket', 'ticket')
            .leftJoinAndSelect('ticket.user', 'user')
            .orderBy('r.createdAt', 'DESC');
        if (options.status) qb.andWhere('r.status = :status', { status: options.status });
        if (options.siteId) qb.andWhere('ticket.siteId = :siteId', { siteId: options.siteId });
        return qb.getMany();
    }

    async findMy(userId: string): Promise<LostItemReport[]> {
        return this.lostItemRepo.createQueryBuilder('r')
            .leftJoinAndSelect('r.ticket', 'ticket')
            .where('ticket.userId = :userId', { userId })
            .orderBy('r.createdAt', 'DESC')
            .getMany();
    }

    async findOne(id: string): Promise<LostItemReport & { statusLogs: LostItemStatusLog[] }> {
        const lostItem = await this.lostItemRepo.findOne({
            where: { id },
            relations: ['ticket', 'ticket.user'],
        });
        if (!lostItem) throw new NotFoundException('Lost Item report not found');

        const statusLogs = await this.statusLogRepo.find({
            where: { lostItemReportId: id },
            relations: ['changedBy'],
            order: { timestamp: 'ASC' },
        });

        return { ...lostItem, statusLogs };
    }

    async findByTicketId(ticketId: string): Promise<LostItemReport | null> {
        return this.lostItemRepo.findOne({ where: { ticketId }, relations: ['ticket'] });
    }

    async findByQrToken(token: string): Promise<{
        reportId: string;
        itemName: string;
        itemType: string;
        circumstances: string;
        lastSeenLocation: string;
        lastSeenDatetime: Date;
        photoUrls: string[];
        status: LostItemStatus;
        reporter: { name: string; email: string } | null;
    }> {
        const report = await this.lostItemRepo.findOne({
            where: { qrCodeToken: token },
            relations: ['ticket', 'ticket.user'],
        });
        if (!report) throw new NotFoundException('QR code not found or expired');

        const user = report.ticket?.user;
        return {
            reportId: report.id,
            itemName: report.itemName,
            itemType: report.itemType,
            circumstances: report.circumstances,
            lastSeenLocation: report.lastSeenLocation,
            lastSeenDatetime: report.lastSeenDatetime,
            photoUrls: report.photoUrls,
            status: report.status,
            reporter: user ? { name: user.fullName || user.email, email: user.email } : null,
        };
    }

    async updateStatus(id: string, dto: UpdateLostItemStatusDto, userId?: string): Promise<LostItemReport> {
        const lostItem = await this.lostItemRepo.findOne({ where: { id } });
        if (!lostItem) throw new NotFoundException('Lost Item report not found');

        const prevStatus = lostItem.status;
        lostItem.status = dto.status as LostItemStatus;

        if (dto.status === LostItemStatus.RETURNED) {
            lostItem.foundAt = new Date();
            lostItem.foundLocation = dto.foundLocation || null;
            lostItem.foundBy = dto.foundBy || null;

            await this.ticketRepo.update(lostItem.ticketId, {
                status: TicketStatus.RESOLVED,
                resolvedAt: new Date(),
            });
        }
        if (dto.status === LostItemStatus.CLOSED_LOST) {
            await this.ticketRepo.update(lostItem.ticketId, { status: TicketStatus.CANCELLED });
        }

        const saved = await this.lostItemRepo.save(lostItem);
        await this.logStatusChange(id, prevStatus, dto.status, userId, dto.notes);
        this.eventEmitter.emit('lost-item.status-updated', { lostItem: saved, newStatus: dto.status });
        return saved;
    }

    async uploadPoliceReport(id: string, filePath: string, reportNumber: string): Promise<LostItemReport> {
        const lostItem = await this.lostItemRepo.findOne({ where: { id } });
        if (!lostItem) throw new NotFoundException('Lost Item report not found');
        lostItem.hasPoliceReport = true;
        lostItem.policeReportNumber = reportNumber;
        lostItem.policeReportFile = filePath;
        return this.lostItemRepo.save(lostItem);
    }
}
