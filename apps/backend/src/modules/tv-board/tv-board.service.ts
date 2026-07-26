import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Site } from '../sites/entities/site.entity';
import { Ticket, TicketStatus, TicketType } from '../ticketing/entities/ticket.entity';

export interface TvBoardCard {
    id: string;
    description: string;
    requesterName: string;
    requesterDepartment: string | null;
    assignedToName: string | null;
    priority: string;
    slaTarget: string | null;
    isOverdue: boolean;
    isOracleRequest: boolean;
}

export interface TvBoardRingtones {
    newTicket: string | null;
    inProgress: string | null;
    closing: string | null;
    closingTime: string | null;
}

export interface TvBoardData {
    siteName: string;
    siteCode: string;
    open: TvBoardCard[];
    inProgress: TvBoardCard[];
    waitingVendorCount: number;
    ringtones: TvBoardRingtones;
}

@Injectable()
export class TvBoardService {
    constructor(
        @InjectRepository(Site)
        private readonly siteRepo: Repository<Site>,
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
    ) { }

    async resolveSiteIdByToken(token: string): Promise<string> {
        if (!token) {
            throw new NotFoundException('TV board link tidak valid');
        }
        const site = await this.siteRepo.findOne({ where: { tvToken: token } });
        if (!site) {
            throw new NotFoundException('TV board link tidak valid');
        }
        return site.id;
    }

    async getBoardData(siteId: string): Promise<TvBoardData> {
        const site = await this.siteRepo.findOne({ where: { id: siteId } });
        if (!site) {
            throw new NotFoundException('Site not found');
        }

        const tickets = await this.ticketRepo.find({
            where: [
                { siteId, status: TicketStatus.TODO },
                { siteId, status: TicketStatus.IN_PROGRESS },
            ],
            relations: ['user', 'user.department', 'assignedTo'],
            order: { createdAt: 'ASC' },
        });

        const waitingVendorCount = await this.ticketRepo.count({
            where: { siteId, status: TicketStatus.WAITING_VENDOR },
        });

        const toCard = (t: Ticket): TvBoardCard => ({
            id: t.id,
            description: t.description,
            requesterName: t.user?.fullName ?? 'Unknown',
            requesterDepartment:
                t.user?.department?.code || t.user?.department?.name || null,
            assignedToName: t.assignedTo?.fullName ?? null,
            priority: t.priority,
            slaTarget: t.slaTarget ? t.slaTarget.toISOString() : null,
            isOverdue: t.isOverdue,
            isOracleRequest:
                t.ticketType === TicketType.ORACLE_REQUEST ||
                t.category === 'ORACLE_REQUEST',
        });

        return {
            siteName: site.name,
            siteCode: site.code,
            open: tickets.filter((t) => t.status === TicketStatus.TODO).map(toCard),
            inProgress: tickets.filter((t) => t.status === TicketStatus.IN_PROGRESS).map(toCard),
            waitingVendorCount,
            ringtones: {
                newTicket: site.ringtoneNewTicket ?? null,
                inProgress: site.ringtoneInProgress ?? null,
                closing: site.ringtoneClosing ?? null,
                closingTime: site.closingTime ?? null,
            },
        };
    }
}
