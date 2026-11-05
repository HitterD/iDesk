import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { promises as dns } from 'dns';
import { isIP } from 'net';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { UserDevice } from './user-device.entity';
import { Ticket } from '../entities/ticket.entity';
import { DeviceHeartbeatDto } from './device-heartbeat.dto';
import {
    HEARTBEAT_FRESH_MS, HOSTNAME_MAX, HOSTNAME_PATTERN, HostnameSource, RDNS_ENV_FLAG, RDNS_TIMEOUT_MS, RECENT_DEVICES_LIMIT,
} from './requester-device.constants';

export interface RequesterDeviceSnapshot {
    requesterIp: string | null;
    requesterHostname: string | null;
    requesterHostnameSource: HostnameSource | null;
}

export type RecentDevice = Pick<UserDevice, 'hostname' | 'lanIp' | 'osVersion' | 'lastSeenAt'>;

export interface TicketRequesterDevice extends RequesterDeviceSnapshot {
    /** Other computers the requester's desktop app reported recently. */
    recentDevices: RecentDevice[];
}

const EMPTY: RequesterDeviceSnapshot = { requesterIp: null, requesterHostname: null, requesterHostnameSource: null };

/** RFC 1918 / loopback / link-local / IPv6 ULA: the only addresses whose reverse DNS names an office PC. */
export function isPrivateIp(ip: string): boolean {
    if (isIP(ip) === 4) {
        const [a, b] = ip.split('.').map(Number);
        return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
    }
    if (isIP(ip) === 6) {
        const lower = ip.toLowerCase();
        return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80');
    }
    return false;
}

/** Shortest readable name: "pc012.sja.local" stays as is, but trailing dots go and junk is dropped. */
function cleanHostname(name: string | undefined): string | null {
    const trimmed = name?.trim().replace(/\.$/, '') ?? '';
    return trimmed && trimmed.length <= HOSTNAME_MAX && HOSTNAME_PATTERN.test(trimmed) ? trimmed : null;
}

/**
 * The requester's computer, for agents: the desktop app names it (heartbeat), reverse DNS of the
 * request IP is the fallback. Never blocks or fails ticket creation.
 */
@Injectable()
export class RequesterDeviceService {
    private readonly logger = new Logger(RequesterDeviceService.name);

    constructor(
        @InjectRepository(UserDevice)
        private readonly devices: Repository<UserDevice>,
        @InjectRepository(Ticket)
        private readonly tickets: Repository<Ticket>,
    ) { }

    /** What agents see on a ticket. The caller must already have checked handler access. */
    async forTicket(ticketId: string): Promise<TicketRequesterDevice> {
        const ticket = await this.tickets.findOne({
            where: { id: ticketId },
            select: ['id', 'userId', 'requesterIp', 'requesterHostname', 'requesterHostnameSource'],
        });
        if (!ticket) throw new NotFoundException('Ticket not found');
        return {
            requesterIp: ticket.requesterIp ?? null,
            requesterHostname: ticket.requesterHostname ?? null,
            requesterHostnameSource: (ticket.requesterHostnameSource as HostnameSource | null) ?? null,
            recentDevices: ticket.userId ? await this.recent(ticket.userId) : [],
        };
    }

    /** Upsert by (user, hostname); the request IP stands in when the app sends no LAN IP. */
    async recordHeartbeat(userId: string, dto: DeviceHeartbeatDto, requestIp: string | null): Promise<{ ok: true }> {
        const lanIp = dto.lanIp ?? (requestIp && isIP(requestIp) ? requestIp : null);
        await this.devices.upsert({
            userId,
            hostname: dto.hostname,
            lanIp,
            windowsUser: dto.windowsUser ?? null,
            osVersion: dto.osVersion ?? null,
            appVersion: dto.appVersion ?? null,
            lastSeenAt: new Date(),
        }, ['userId', 'hostname']);
        return { ok: true };
    }

    /** Snapshot stored on a new ticket. Any failure yields an empty or partial snapshot, never an error. */
    async snapshot(userId: string, requestIp: string | null): Promise<RequesterDeviceSnapshot> {
        const ip = requestIp && isIP(requestIp) ? requestIp : null;
        try {
            const fromApp = await this.freshHeartbeat(userId, ip);
            if (fromApp) return { requesterIp: ip ?? fromApp.lanIp, requesterHostname: fromApp.hostname, requesterHostnameSource: HostnameSource.AGENT };
            if (!ip) return EMPTY;
            const fromDns = await this.reverseLookup(ip);
            return { requesterIp: ip, requesterHostname: fromDns, requesterHostnameSource: fromDns ? HostnameSource.RDNS : null };
        } catch (error) {
            this.logger.warn(`Requester device lookup failed for user ${userId}: ${(error as Error).message}`);
            return { ...EMPTY, requesterIp: ip };
        }
    }

    /** Last computers the user's desktop app reported, newest first. */
    recent(userId: string): Promise<RecentDevice[]> {
        return this.devices.find({
            where: { userId },
            select: ['hostname', 'lanIp', 'osVersion', 'lastSeenAt'],
            order: { lastSeenAt: 'DESC' },
            take: RECENT_DEVICES_LIMIT,
        });
    }

    /** Heartbeat from the last 15 minutes; one from the request's own IP wins over a newer one elsewhere. */
    private async freshHeartbeat(userId: string, ip: string | null): Promise<UserDevice | null> {
        const fresh = await this.devices.find({
            where: { userId, lastSeenAt: MoreThanOrEqual(new Date(Date.now() - HEARTBEAT_FRESH_MS)) },
            order: { lastSeenAt: 'DESC' },
            take: RECENT_DEVICES_LIMIT,
        });
        return fresh.find((device) => ip && device.lanIp === ip) ?? fresh[0] ?? null;
    }

    private async reverseLookup(ip: string): Promise<string | null> {
        if (process.env[RDNS_ENV_FLAG] === 'false' || !isPrivateIp(ip)) return null;
        let timer: NodeJS.Timeout | undefined;
        const timeout = new Promise<string[]>((resolve) => { timer = setTimeout(() => resolve([]), RDNS_TIMEOUT_MS); });
        try {
            const names = await Promise.race([dns.reverse(ip).catch(() => [] as string[]), timeout]);
            return cleanHostname(names[0]);
        } finally {
            clearTimeout(timer);
        }
    }
}
