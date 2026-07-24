import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Site } from '../sites/entities/site.entity';
import { Ticket, TicketStatus } from '../ticketing/entities/ticket.entity';

export interface TvBoardCard {
    id: string;
    description: string;
    requesterName: string;
    assignedToName: string | null;
    priority: string;
    slaTarget: string | null;
    isOverdue: boolean;
}

export interface TvBoardData {
    siteName: string;
    siteCode: string;
    open: TvBoardCard[];
    inProgress: TvBoardCard[];
    resolved: TvBoardCard[];
    waitingVendorCount: number;
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

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const tomorrowStart = new Date(todayStart);
        tomorrowStart.setDate(tomorrowStart.getDate() + 1);

        const tickets = await this.ticketRepo.find({
            where: [
                { siteId, status: TicketStatus.TODO },
                { siteId, status: TicketStatus.IN_PROGRESS },
                { siteId, status: TicketStatus.RESOLVED, resolvedAt: Between(todayStart, tomorrowStart) },
            ],
            relations: ['user', 'assignedTo'],
            order: { createdAt: 'ASC' },
        });

        const waitingVendorCount = await this.ticketRepo.count({
            where: { siteId, status: TicketStatus.WAITING_VENDOR },
        });

        const toCard = (t: Ticket): TvBoardCard => ({
            id: t.id,
            description: t.description,
            requesterName: t.user?.fullName ?? 'Unknown',
            assignedToName: t.assignedTo?.fullName ?? null,
            priority: t.priority,
            slaTarget: t.slaTarget ? t.slaTarget.toISOString() : null,
            isOverdue: t.isOverdue,
        });

        return {
            siteName: site.name,
            siteCode: site.code,
            open: tickets.filter((t) => t.status === TicketStatus.TODO).map(toCard),
            inProgress: tickets.filter((t) => t.status === TicketStatus.IN_PROGRESS).map(toCard),
            resolved: tickets.filter((t) => t.status === TicketStatus.RESOLVED).map(toCard),
            waitingVendorCount,
        };
    }
}
