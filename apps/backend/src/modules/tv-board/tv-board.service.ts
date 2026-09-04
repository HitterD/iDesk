import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Site } from '../sites/entities/site.entity';
import { Ticket, TicketStatus, TicketType, HandlingTeam } from '../ticketing/entities/ticket.entity';
import { resolveInitialHandlingTeam } from '../ticketing/utils/oracle-ticket-access.util';

export interface TvBoardCard {
    id: string;
    ticketNumber?: string;
    title: string;
    description: string;
    requesterName: string;
    requesterDepartment: string | null;
    assignedToName: string | null;
    priority: string;
    slaTarget: string | null;
    isOverdue: boolean;
    isOracleRequest: boolean;
    handlingTeam: 'OPS_SUPPORT' | 'ORACLE_DEV' | 'WEB_DEV' | 'MOBILE_DEV' | string;
    category?: string | null;
    ticketType?: string | null;
}

export interface TvBoardRingtones {
    newTicket: string | null;
    newTicketSupport?: string | null;
    newTicketOracle?: string | null;
    newTicketWebDev?: string | null;
    newTicketMobileDev?: string | null;
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

        const toCard = (t: Ticket): TvBoardCard => {
            const team = t.handlingTeam || resolveInitialHandlingTeam(t.category, t.ticketType);
            return {
                id: t.id,
                ticketNumber: t.ticketNumber || t.id.slice(0, 8),
                title: t.title || t.description || 'No Title',
                description: t.description,
                requesterName: t.user?.fullName ?? 'Unknown',
                requesterDepartment:
                    t.user?.department?.code || t.user?.department?.name || null,
                assignedToName: t.assignedTo?.fullName ?? null,
                priority: t.priority,
                slaTarget: t.slaTarget ? t.slaTarget.toISOString() : null,
                isOverdue: t.isOverdue,
                isOracleRequest:
                    team === HandlingTeam.ORACLE_DEV ||
                    t.ticketType === TicketType.ORACLE_REQUEST ||
                    t.category === 'ORACLE_REQUEST',
                handlingTeam: team,
                category: t.category,
                ticketType: t.ticketType,
            };
        };

        return {
            siteName: site.name,
            siteCode: site.code,
            open: tickets.filter((t) => t.status === TicketStatus.TODO).map(toCard),
            inProgress: tickets.filter((t) => t.status === TicketStatus.IN_PROGRESS).map(toCard),
            waitingVendorCount,
            ringtones: {
                newTicket: site.ringtoneNewTicket ?? null,
                newTicketSupport: site.ringtoneNewTicketSupport ?? null,
                newTicketOracle: site.ringtoneNewTicketOracle ?? null,
                newTicketWebDev: site.ringtoneNewTicketWebDev ?? null,
                newTicketMobileDev: site.ringtoneNewTicketMobileDev ?? null,
                inProgress: site.ringtoneInProgress ?? null,
                closing: site.ringtoneClosing ?? null,
                closingTime: site.closingTime ?? null,
            },
        };
    }
}
