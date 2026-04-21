import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan, IsNull, Or } from 'typeorm';
import { IpWhitelist, IpWhitelistType, IpWhitelistScope } from './entities/ip-whitelist.entity';
import { CreateIpWhitelistDto, UpdateIpWhitelistDto } from './dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';

@Injectable()
export class IpWhitelistService {
    private readonly logger = new Logger(IpWhitelistService.name);

    constructor(
        @InjectRepository(IpWhitelist)
        private readonly ipWhitelistRepo: Repository<IpWhitelist>,
        private readonly auditService: AuditService,
    ) { }

    /**
     * Create a new whitelist entry
     */
    async create(dto: CreateIpWhitelistDto, createdById?: string): Promise<IpWhitelist> {
        const entry = this.ipWhitelistRepo.create({
            ...dto,
            createdById,
            expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        } as Partial<IpWhitelist>);
        return this.ipWhitelistRepo.save(entry);
    }

    /**
     * Get all whitelist entries
     */
    async findAll(includeInactive = false): Promise<IpWhitelist[]> {
        const queryBuilder = this.ipWhitelistRepo
            .createQueryBuilder('ip')
            .leftJoinAndSelect('ip.createdBy', 'user')
            .orderBy('ip.createdAt', 'DESC');

        if (!includeInactive) {
            queryBuilder.where('ip.isActive = :active', { active: true });
        }

        return queryBuilder.getMany();
    }

    /**
     * Get a single entry by ID
     */
    async findOne(id: string): Promise<IpWhitelist | null> {
        return this.ipWhitelistRepo.findOne({
            where: { id },
            relations: ['createdBy'],
        });
    }

    /**
     * Update a whitelist entry
     */
    async update(id: string, dto: UpdateIpWhitelistDto, userId?: string): Promise<IpWhitelist | null> {
        const entry = await this.findOne(id);
        if (!entry) return null;

        Object.assign(entry, dto);
        if (dto.expiresAt !== undefined) {
            entry.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
        }
        return this.ipWhitelistRepo.save(entry);
    }

    /**
     * Delete a whitelist entry
     */
    async remove(id: string, userId?: string): Promise<boolean> {
        const result = await this.ipWhitelistRepo.delete(id);
        return (result.affected ?? 0) > 0;
    }

    /**
     * Check if an IP address is whitelisted
     */
    async isIpWhitelisted(ipAddress: string, scope?: IpWhitelistScope): Promise<boolean> {
        // If no whitelist entries exist, allow all (open mode)
        const count = await this.ipWhitelistRepo.count({
            where: { isActive: true },
        });
        if (count === 0) {
            this.logger.debug('No whitelist entries configured, allowing all IPs');
            return true;
        }

        // Get active, non-expired entries
        const entries = await this.ipWhitelistRepo.find({
            where: {
                isActive: true,
                expiresAt: Or(IsNull(), MoreThan(new Date())),
                ...(scope ? { scope: Or(IpWhitelistScope.GLOBAL as any, scope as any) } : {}),
            },
        });

        for (const entry of entries) {
            if (this.matchesEntry(ipAddress, entry)) {
                // Update hit count
                await this.recordHit(entry.id);
                this.logger.debug(`IP ${ipAddress} matched rule: ${entry.name}`);
                return true;
            }
        }

        this.logger.warn(`IP ${ipAddress} not in whitelist`);
        return false;
    }

    /**
     * Match an IP against a whitelist entry
     */
    private matchesEntry(ip: string, entry: IpWhitelist): boolean {
        switch (entry.type) {
            case IpWhitelistType.SINGLE:
                return ip === entry.ipAddress;

            case IpWhitelistType.RANGE:
                return this.isInRange(ip, entry.ipAddress);

            case IpWhitelistType.CIDR:
                return this.isInCidr(ip, entry.ipAddress);

            default:
                return false;
        }
    }

    /**
     * Check if IP is in range (format: "start-end")
     */
    private isInRange(ip: string, range: string): boolean {
        const [start, end] = range.split('-').map(s => s.trim());
        if (!start || !end) return false;

        const ipNum = this.ipToNumber(ip);
        const startNum = this.ipToNumber(start);
        const endNum = this.ipToNumber(end);

        return ipNum >= startNum && ipNum <= endNum;
    }

    /**
     * Check if IP is in CIDR block (format: "ip/prefix")
     */
    private isInCidr(ip: string, cidr: string): boolean {
        const [network, prefixStr] = cidr.split('/');
        if (!network || !prefixStr) return false;

        const prefix = parseInt(prefixStr, 10);
        if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;

        const ipNum = this.ipToNumber(ip);
        const networkNum = this.ipToNumber(network);
        const mask = ~((1 << (32 - prefix)) - 1) >>> 0;

        return (ipNum & mask) === (networkNum & mask);
    }

    /**
     * Convert IP address to 32-bit number
     */
    private ipToNumber(ip: string): number {
        const parts = ip.split('.');
        if (parts.length !== 4) return 0;

        return parts.reduce((acc, octet, i) => {
            const num = parseInt(octet, 10);
            if (isNaN(num) || num < 0 || num > 255) return acc;
            return acc + (num << (8 * (3 - i)));
        }, 0) >>> 0;
    }

    /**
     * Record a hit for an entry
     */
    private async recordHit(id: string): Promise<void> {
        await this.ipWhitelistRepo.update(id, {
            hitCount: () => 'hitCount + 1',
            lastHitAt: new Date(),
        });
    }

    /**
     * Get whitelist statistics
     */
    async getStats(): Promise<{
        total: number;
        active: number;
        expired: number;
        topHits: { name: string; hitCount: number }[];
    }> {
        const total = await this.ipWhitelistRepo.count();
        const active = await this.ipWhitelistRepo.count({
            where: {
                isActive: true,
                expiresAt: Or(IsNull(), MoreThan(new Date())),
            },
        });
        const expired = await this.ipWhitelistRepo.count({
            where: {
                expiresAt: LessThan(new Date()),
            },
        });

        const topHits = await this.ipWhitelistRepo.find({
            select: ['name', 'hitCount'],
            order: { hitCount: 'DESC' },
            take: 5,
        });

        return { total, active, expired, topHits };
    }

    /**
     * Test if an IP would be whitelisted (without recording hit)
     */
    async testIp(ip: string): Promise<{ allowed: boolean; matchedRule?: string }> {
        const entries = await this.ipWhitelistRepo.find({
            where: {
                isActive: true,
                expiresAt: Or(IsNull(), MoreThan(new Date())),
            },
        });

        if (entries.length === 0) {
            return { allowed: true, matchedRule: 'No rules configured (allow all)' };
        }

        for (const entry of entries) {
            if (this.matchesEntry(ip, entry)) {
                return { allowed: true, matchedRule: entry.name };
            }
        }

        return { allowed: false };
    }
}
