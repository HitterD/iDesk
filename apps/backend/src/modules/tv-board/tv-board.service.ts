import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { Site, TvTheme } from '../sites/entities/site.entity';
import { Ticket, TicketStatus, TicketType, HandlingTeam } from '../ticketing/entities/ticket.entity';
import { resolveInitialHandlingTeam } from '../ticketing/utils/oracle-ticket-access.util';
import { SlaConfig } from '../ticketing/entities/sla-config.entity';
import { BusinessHoursService } from '../sla-config/business-hours.service';
import { buildSlaClockInfo, SlaClockInfo } from '../sla-config/sla-clock-info';

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
    /** Origin site code; the hub board labels dev tickets from other sites with it. */
    siteCode: string | null;
    /** Team it was last forwarded from ("Diteruskan dari ..."); null if never forwarded. */
    forwardedFromTeam: string | null;
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
    /** This board is the dev-team hub (shows dev tickets from every site). */
    showsDevTickets: boolean;
    theme: TvTheme;
    open: TvBoardCard[];
    inProgress: TvBoardCard[];
    waitingVendorCount: number;
    ringtones: TvBoardRingtones;
    slaClock: SlaClockInfo;
}

export const DEV_HANDLING_TEAMS = [HandlingTeam.ORACLE_DEV, HandlingTeam.WEB_DEV, HandlingTeam.MOBILE_DEV];

/**
 * Every board shows its own site's Support tickets; the hub board(s) also
 * show the dev teams' tickets from all sites, since those teams sit there.
 */
export function buildBoardTicketFilter(
    site: Pick<Site, 'id' | 'tvShowsDevTickets'>,
    status: TicketStatus,
): FindOptionsWhere<Ticket>[] {
    const filters: FindOptionsWhere<Ticket>[] = [{ siteId: site.id, status, handlingTeam: HandlingTeam.OPS_SUPPORT }];
    if (site.tvShowsDevTickets) {
        filters.push({ status, handlingTeam: In(DEV_HANDLING_TEAMS) });
    }
    return filters;
}

@Injectable()
export class TvBoardService {
    constructor(
        @InjectRepository(Site)
        private readonly siteRepo: Repository<Site>,
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(SlaConfig)
        private readonly slaConfigRepo: Repository<SlaConfig>,
        private readonly businessHours: BusinessHoursService,
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
                ...buildBoardTicketFilter(site, TicketStatus.TODO),
                ...buildBoardTicketFilter(site, TicketStatus.IN_PROGRESS),
            ],
            relations: ['user', 'user.department', 'assignedTo', 'site'],
            order: { createdAt: 'ASC' },
        });

        const [waitingVendorCount, schedule, slaConfigs] = await Promise.all([
            this.ticketRepo.count({ where: buildBoardTicketFilter(site, TicketStatus.WAITING_VENDOR) }),
            this.businessHours.getSchedule(),
            this.slaConfigRepo.find(),
        ]);

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
                siteCode: t.site?.code ?? null,
                forwardedFromTeam: t.forwardedFromTeam ?? null,
            };
        };

        return {
            siteName: site.name,
            siteCode: site.code,
            showsDevTickets: Boolean(site.tvShowsDevTickets),
            theme: site.tvTheme === 'dark' ? 'dark' : 'light',
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
            slaClock: buildSlaClockInfo(schedule, slaConfigs),
        };
    }
}
