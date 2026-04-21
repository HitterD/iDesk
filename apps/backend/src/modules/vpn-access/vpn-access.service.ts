import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, Between } from 'typeorm';
import { VpnAccess, VpnStatusCreate, VpnArea } from './entities/vpn-access.entity';
import { CreateVpnAccessDto, UpdateVpnAccessDto } from './dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';

@Injectable()
export class VpnAccessService {
    private readonly logger = new Logger(VpnAccessService.name);

    constructor(
        private readonly auditService: AuditService,
        @InjectRepository(VpnAccess)
        private readonly repo: Repository<VpnAccess>,
    ) { }

    async findAll(filters?: {
        statusCreateVpn?: VpnStatusCreate;
        area?: VpnArea;
        search?: string;
    }): Promise<VpnAccess[]> {
        const query = this.repo.createQueryBuilder('vpn')
            .leftJoinAndSelect('vpn.requestedBy', 'requestedBy')
            .leftJoinAndSelect('vpn.approvedBy', 'approvedBy')
            .orderBy('vpn.tanggalNonAktif', 'ASC');

        if (filters?.statusCreateVpn) {
            query.andWhere('vpn.statusCreateVpn = :statusCreate', { statusCreate: filters.statusCreateVpn });
        }

        if (filters?.area) {
            query.andWhere('vpn.area = :area', { area: filters.area });
        }

        if (filters?.search) {
            query.andWhere(
                '(vpn.namaUser ILIKE :search OR vpn.emailUser ILIKE :search)',
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
        });
        return this.repo.save(vpn);
    }

    async update(id: string, dto: UpdateVpnAccessDto, userId?: string): Promise<VpnAccess> {
        const vpn = await this.findById(id);
        Object.assign(vpn, dto);
        return this.repo.save(vpn);
    }

    async delete(id: string, userId?: string): Promise<void> {
        const vpn = await this.findById(id);
        await this.repo.softRemove(vpn);
    }

    async deleteMany(ids: string[], userId?: string): Promise<void> {
        if (!ids || ids.length === 0) return;
        
        const vpns = await this.repo.findByIds(ids);
        await this.repo.softDelete(ids);

        if (userId) {
            vpns.forEach(vpn => {
                this.auditService.logAsync({
                    userId,
                    action: AuditAction.VPN_ACCESS_DELETE,
                    entityType: 'VpnAccess',
                    entityId: vpn.id,
                    description: `Deleted VPN access (bulk) for ${vpn.namaUser}`,
                });
            });
        }
    }

    async getStats(): Promise<{
        total: number;
        active: number;
        expired: number;
        expiringSoon: number;
        byArea: Record<string, number>;
    }> {
        const today = new Date();
        const thirtyDays = new Date();
        thirtyDays.setDate(today.getDate() + 30);

        const [total, active, expired, expiringSoon] = await Promise.all([
            this.repo.count(),
            this.repo.count({ where: { statusCreateVpn: VpnStatusCreate.SELESAI } }),
            this.repo.count({ where: { statusCreateVpn: VpnStatusCreate.NON_AKTIF } }),
            this.repo.count({
                where: {
                    statusCreateVpn: VpnStatusCreate.SELESAI,
                    tanggalNonAktif: Between(today, thirtyDays),
                },
            }),
        ]);

        const byAreaRaw = await this.repo
            .createQueryBuilder('vpn')
            .select('vpn.area', 'area')
            .addSelect('COUNT(*)', 'count')
            .groupBy('vpn.area')
            .getRawMany();

        const byArea: Record<string, number> = {};
        byAreaRaw.forEach(r => {
            byArea[r.area] = parseInt(r.count, 10);
        });

        return { total, active, expired, expiringSoon, byArea };
    }

    async findAllForSync(): Promise<VpnAccess[]> {
        return this.repo.find({
            order: { updatedAt: 'DESC' },
            take: 1000,
        });
    }
}
