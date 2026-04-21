import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { InstallationSchedule } from '../domain/entities/installation-schedule.entity';
import { HardwareRequestItem } from '../domain/entities/hardware-request-item.entity';
import { RequestStatus } from '../domain/enums/request-status.enum';
import { InstallStatus } from '../domain/enums/install-status.enum';

const ACTIVE_STATUSES = [
    RequestStatus.SUBMITTED,
    RequestStatus.UNDER_REVIEW,
    RequestStatus.APPROVED,
    RequestStatus.PROCUREMENT,
    RequestStatus.INSTALLATION,
];

@Injectable()
export class HardwareDashboardService {
    constructor(
        @InjectRepository(HardwareRequest)
        private readonly reqs: Repository<HardwareRequest>,
        @InjectRepository(InstallationSchedule)
        private readonly scheds: Repository<InstallationSchedule>,
        @InjectRepository(HardwareRequestItem)
        private readonly items: Repository<HardwareRequestItem>,
    ) {}

    async kpi() {
        const monthStart = new Date();
        monthStart.setUTCDate(1);
        monthStart.setUTCHours(0, 0, 0, 0);

        const [totalActive, inProcurement, pendingInstall, completedThisMonth] = await Promise.all([
            this.reqs.count({ where: { status: In(ACTIVE_STATUSES) } }),
            this.reqs.count({ where: { status: RequestStatus.PROCUREMENT } }),
            this.reqs.count({ where: { status: RequestStatus.INSTALLATION } }),
            this.reqs
                .createQueryBuilder('r')
                .where('r.status = :s', { s: RequestStatus.COMPLETED })
                .andWhere('r.\"completedAt\" >= :m', { m: monthStart })
                .getCount(),
        ]);

        return { totalActive, inProcurement, pendingInstall, completedThisMonth };
    }

    async statusDistribution() {
        const rows = await this.reqs
            .createQueryBuilder('r')
            .select('r.status', 'status')
            .addSelect('COUNT(*)', 'count')
            .groupBy('r.status')
            .orderBy('r.status', 'ASC')
            .getRawMany();
        return rows.map((r) => ({ status: r.status, count: Number(r.count) }));
    }

    async aging(thresholdDays = 3) {
        const rows = await this.reqs
            .createQueryBuilder('r')
            .select([
                'r.id AS id',
                'r.requestNumber AS "requestNumber"',
                'r.status AS status',
                'r.requesterId AS "requesterId"',
                'EXTRACT(DAY FROM (NOW() - r.\"updatedAt\")) AS days',
            ])
            .where('r.status IN (:...active)', { active: ACTIVE_STATUSES })
            .andWhere('EXTRACT(DAY FROM (NOW() - r.\"updatedAt\")) >= :d', { d: thresholdDays })
            .orderBy('days', 'DESC')
            .getRawMany();
        return rows.map((r) => ({ ...r, days: Number(r.days) }));
    }

    async topCategories(range: '30d' | '90d') {
        const daysBack = range === '90d' ? 90 : 30;
        const rows = await this.items
            .createQueryBuilder('i')
            .innerJoin('i.request', 'r')
            .select("COALESCE(i.\"categorySnapshot\"->>'category', 'OTHER')", 'category')
            .addSelect('SUM(i.quantity)', 'qty')
            .where('r.\"createdAt\" >= NOW() - make_interval(days => :d)', { d: daysBack })
            .groupBy('category')
            .orderBy('qty', 'DESC')
            .limit(10)
            .getRawMany();
        return rows.map((r) => ({ category: r.category, quantity: Number(r.qty) }));
    }

    async weeklySchedule() {
        const weekStart = new Date();
        weekStart.setUTCHours(0, 0, 0, 0);
        weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
        const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3600 * 1000);

        return this.scheds
            .createQueryBuilder('s')
            .leftJoinAndSelect('s.request', 'r')
            .leftJoinAndSelect('s.technician', 't')
            .where('s.\"scheduledStart\" >= :from AND s.\"scheduledStart\" < :to', {
                from: weekStart,
                to: weekEnd,
            })
            .andWhere('s.status IN (:...st)', {
                st: [InstallStatus.PROPOSED, InstallStatus.CONFIRMED, InstallStatus.IN_PROGRESS],
            })
            .orderBy('s.\"scheduledStart\"', 'ASC')
            .getMany();
    }

    async technicianWorkload() {
        const rows = await this.scheds
            .createQueryBuilder('s')
            .select('s.technicianId', 'technicianId')
            .addSelect('u.fullName', 'technicianName')
            .addSelect(
                "COUNT(*) FILTER (WHERE s.status IN ('PROPOSED','CONFIRMED','IN_PROGRESS'))",
                'active',
            )
            .addSelect(
                "COUNT(*) FILTER (WHERE s.status='DONE' AND s.\"completedAt\" >= NOW() - INTERVAL '30 days')",
                'completed30',
            )
            .innerJoin('s.technician', 'u')
            .groupBy('s.technicianId')
            .addGroupBy('u.fullName')
            .orderBy('active', 'DESC')
            .getRawMany();
        return rows.map((r) => ({
            technicianId: r.technicianId,
            technicianName: r.technicianName,
            active: Number(r.active),
            completed30: Number(r.completed30),
        }));
    }
}
