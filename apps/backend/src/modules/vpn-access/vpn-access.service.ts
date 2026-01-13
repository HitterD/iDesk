import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, Between } from 'typeorm';
import { VpnAccess, VpnStatus, VpnType } from './entities/vpn-access.entity';
import { CreateVpnAccessDto, UpdateVpnAccessDto } from './dto';

@Injectable()
export class VpnAccessService {
    private readonly logger = new Logger(VpnAccessService.name);

    constructor(
        @InjectRepository(VpnAccess)
        private readonly repo: Repository<VpnAccess>,
    ) { }

    // === CRUD ===

    async findAll(filters?: {
        status?: VpnStatus;
        vpnType?: VpnType;
        site?: string;
        search?: string;
    }): Promise<VpnAccess[]> {
        const query = this.repo.createQueryBuilder('vpn')
            .leftJoinAndSelect('vpn.requestedBy', 'requestedBy')
            .leftJoinAndSelect('vpn.approvedBy', 'approvedBy')
            .orderBy('vpn.validUntil', 'ASC');

        if (filters?.status) {
            query.andWhere('vpn.status = :status', { status: filters.status });
        }

        if (filters?.vpnType) {
            query.andWhere('vpn.vpnType = :vpnType', { vpnType: filters.vpnType });
        }

        if (filters?.site) {
            query.andWhere('vpn.site = :site', { site: filters.site });
        }

        if (filters?.search) {
            query.andWhere(
                '(vpn.username ILIKE :search OR vpn.fullName ILIKE :search OR vpn.email ILIKE :search)',
                { search: `%${filters.search}%` },
            );
        }

        return query.getMany();
    }

    async findById(id: string): Promise<VpnAccess> {
        const vpn = await this.repo.findOne({
            where: { id },
            relations: ['requestedBy', 'approvedBy'],
        });
        if (!vpn) throw new NotFoundException('VPN access record not found');
        return vpn;
    }

    async create(dto: CreateVpnAccessDto, userId?: string): Promise<VpnAccess> {
        const vpn = this.repo.create({
            ...dto,
            requestedById: userId,
            status: VpnStatus.ACTIVE,
        });
        return this.repo.save(vpn);
    }

    async update(id: string, dto: UpdateVpnAccessDto): Promise<VpnAccess> {
        const vpn = await this.findById(id);
        Object.assign(vpn, dto);
        return this.repo.save(vpn);
    }

    async delete(id: string): Promise<void> {
        const vpn = await this.findById(id);
        await this.repo.remove(vpn);
    }

    // === STATUS MANAGEMENT ===

    async setStatus(id: string, status: VpnStatus, userId?: string): Promise<VpnAccess> {
        const vpn = await this.findById(id);
        vpn.status = status;
        if (status === VpnStatus.REVOKED) {
            vpn.approvedById = userId;
        }
        return this.repo.save(vpn);
    }

    async acknowledge(id: string, userId: string): Promise<VpnAccess> {
        const vpn = await this.findById(id);
        vpn.isAcknowledged = true;
        vpn.acknowledgedById = userId;
        vpn.acknowledgedAt = new Date();
        return this.repo.save(vpn);
    }

    // === EXPIRY QUERIES ===

    async findExpiring(daysAhead: number): Promise<VpnAccess[]> {
        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(today.getDate() + daysAhead);

        return this.repo.find({
            where: {
                status: VpnStatus.ACTIVE,
                validUntil: Between(today, futureDate),
            },
            relations: ['requestedBy'],
            order: { validUntil: 'ASC' },
        });
    }

    async findExpired(): Promise<VpnAccess[]> {
        const today = new Date();

        return this.repo.find({
            where: {
                status: VpnStatus.ACTIVE,
                validUntil: LessThanOrEqual(today),
            },
        });
    }

    async updateExpiredStatuses(): Promise<number> {
        const expired = await this.findExpired();

        for (const vpn of expired) {
            vpn.status = VpnStatus.EXPIRED;
            await this.repo.save(vpn);
        }

        return expired.length;
    }

    // === STATS ===

    async getStats(): Promise<{
        total: number;
        active: number;
        expired: number;
        expiringSoon: number;
        byType: Record<string, number>;
    }> {
        const today = new Date();
        const thirtyDays = new Date();
        thirtyDays.setDate(today.getDate() + 30);

        const [total, active, expired, expiringSoon] = await Promise.all([
            this.repo.count(),
            this.repo.count({ where: { status: VpnStatus.ACTIVE } }),
            this.repo.count({ where: { status: VpnStatus.EXPIRED } }),
            this.repo.count({
                where: {
                    status: VpnStatus.ACTIVE,
                    validUntil: Between(today, thirtyDays),
                },
            }),
        ]);

        const byTypeRaw = await this.repo
            .createQueryBuilder('vpn')
            .select('vpn.vpnType', 'type')
            .addSelect('COUNT(*)', 'count')
            .groupBy('vpn.vpnType')
            .getRawMany();

        const byType: Record<string, number> = {};
        byTypeRaw.forEach(r => {
            byType[r.type] = parseInt(r.count, 10);
        });

        return { total, active, expired, expiringSoon, byType };
    }

    // === FOR GOOGLE SYNC ===

    async findAllForSync(): Promise<VpnAccess[]> {
        return this.repo.find({
            order: { updatedAt: 'DESC' },
            take: 1000,
        });
    }
}
