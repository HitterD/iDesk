import { Injectable, BadRequestException, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HR_EVT } from '../domain/events/hardware-request.events';
import { InstallationSchedule } from '../domain/entities/installation-schedule.entity';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { RequestStatus } from '../domain/enums/request-status.enum';
import { InstallStatus, INSTALL_TERMINAL } from '../domain/enums/install-status.enum';
import { ScheduleInstallDto } from '../dto/schedule-install.dto';
import { RescheduleInstallDto } from '../dto/reschedule-install.dto';
import { HardwareActivityService } from './hardware-activity.service';
import { CalendarQueryDto } from '../dto/calendar-query.dto';

export interface ActingUser { id: string; role: 'USER'|'ICT_STAFF' }

@Injectable()
export class InstallationScheduleService {
    constructor(
        @InjectRepository(InstallationSchedule) private readonly repo: Repository<InstallationSchedule>,
        @InjectRepository(HardwareRequest) private readonly reqRepo: Repository<HardwareRequest>,
        private readonly activity: HardwareActivityService,
        private readonly emitter: EventEmitter2,
        private readonly dataSource: DataSource,
    ) {}

    async propose(requestId: string, dto: ScheduleInstallDto, actor: ActingUser): Promise<InstallationSchedule> {
        const start = new Date(dto.scheduledStart);
        const end = new Date(dto.scheduledEnd);
        if (end <= start) throw new BadRequestException('end must be after start');

        const req = await this.reqRepo.findOne({ where: { id: requestId } });
        if (!req) throw new NotFoundException('request not found');
        if (req.status !== RequestStatus.INSTALLATION) throw new ConflictException('invalid state: must be INSTALLATION');

        const allowed = (actor.role === 'USER' && actor.id === req.requesterId)
            || actor.role === 'ICT_STAFF';
        if (!allowed) throw new ForbiddenException('HR_PERMISSION_DENIED');

        const technicianId = dto.technicianId
            ?? (actor.role === 'ICT_STAFF' ? actor.id : undefined);
        if (!technicianId) throw new BadRequestException('technicianId required when proposer is USER');

        const existing = await this.repo.findOne({ where: { requestId } });
        if (existing && !INSTALL_TERMINAL.has(existing.status)) {
            throw new ConflictException('active schedule exists; use reschedule');
        }

        const row = this.repo.create({
            requestId, technicianId,
            scheduledStart: start, scheduledEnd: end,
            locationDetail: dto.locationDetail ?? null,
            status: InstallStatus.PROPOSED,
            proposedBy: actor.id,
            confirmedBy: null,
        });
        const saved = await this.repo.save(row);

        await this.activity.log(requestId, actor.id, 'SCHEDULE_PROPOSED', {
            scheduleId: saved.id, scheduledStart: start, scheduledEnd: end, technicianId,
        });
        this.emitter.emit(HR_EVT.SCHEDULE_PROPOSED, {
            requestId, scheduleId: saved.id, proposerId: actor.id, technicianId,
            requesterId: req.requesterId, actorId: actor.id, occurredAt: new Date(),
        });
        return saved;
    }

    async confirm(requestId: string, actor: ActingUser): Promise<InstallationSchedule> {
        const sched = await this.repo.findOne({ where: { requestId } });
        if (!sched) throw new NotFoundException('schedule not found');
        if (sched.status !== InstallStatus.PROPOSED) throw new ConflictException('invalid state: must be PROPOSED');

        const req = await this.reqRepo.findOne({ where: { id: requestId } });
        if (!req) throw new NotFoundException('request');

        const isRequester = actor.role === 'USER' && actor.id === req.requesterId;
        const isTech = actor.role === 'ICT_STAFF';
        if (!isRequester && !isTech) throw new ForbiddenException('HR_PERMISSION_DENIED');
        if (actor.id === sched.proposedBy) throw new ForbiddenException('counterparty must confirm');

        sched.status = InstallStatus.CONFIRMED;
        sched.confirmedBy = actor.id;
        const saved = await this.repo.save(sched);

        await this.activity.log(requestId, actor.id, 'SCHEDULE_CONFIRMED', { scheduleId: saved.id });
        this.emitter.emit(HR_EVT.SCHEDULE_CONFIRMED, {
            requestId, scheduleId: saved.id, confirmedBy: actor.id,
            technicianId: sched.technicianId, requesterId: req.requesterId,
            actorId: actor.id, occurredAt: new Date(),
        });
        return saved;
    }

    async reschedule(requestId: string, dto: RescheduleInstallDto, actor: ActingUser): Promise<InstallationSchedule> {
        const start = new Date(dto.scheduledStart);
        const end = new Date(dto.scheduledEnd);
        if (end <= start) throw new BadRequestException('end must be after start');

        const scheds = await this.repo.createQueryBuilder('s')
            .where('s.requestId = :requestId', { requestId })
            .orderBy('s.createdAt', 'DESC')
            .getMany();
        const oldSched = scheds[0];
            
        if (!oldSched) throw new NotFoundException('schedule');
        if (oldSched.status === InstallStatus.IN_PROGRESS) throw new ConflictException('cannot reschedule while in progress');
        if (INSTALL_TERMINAL.has(oldSched.status)) throw new ConflictException('schedule already terminal');

        const req = await this.reqRepo.findOne({ where: { id: requestId } });
        if (!req || req.status !== RequestStatus.INSTALLATION) throw new ConflictException('invalid state');

        const allowed = (actor.role === 'USER' && actor.id === req.requesterId) || actor.role === 'ICT_STAFF';
        if (!allowed) throw new ForbiddenException('HR_PERMISSION_DENIED');

        oldSched.status = InstallStatus.RESCHEDULED;
        oldSched.rescheduleReason = dto.reason ?? null;
        await this.repo.save(oldSched);

        const technicianId = oldSched.technicianId;
        const next = this.repo.create({
            requestId, technicianId,
            scheduledStart: start, scheduledEnd: end,
            status: InstallStatus.PROPOSED,
            proposedBy: actor.id, confirmedBy: null,
            locationDetail: oldSched.locationDetail,
        });
        const saved = await this.repo.save(next);

        await this.activity.log(requestId, actor.id, 'SCHEDULE_RESCHEDULED', {
            oldId: oldSched.id, newId: saved.id, reason: dto.reason ?? null,
        });
        this.emitter.emit(HR_EVT.SCHEDULE_RESCHEDULED, {
            requestId, oldId: oldSched.id, newId: saved.id, actorId: actor.id,
            reason: dto.reason, technicianId, requesterId: req.requesterId,
            occurredAt: new Date(),
        });
        return saved;
    }

    async startInstallation(requestId: string, actor: ActingUser): Promise<InstallationSchedule> {
        const sched = await this.repo.findOne({ where: { requestId, status: InstallStatus.CONFIRMED } });
        if (!sched) throw new ConflictException('no confirmed schedule');
        if (actor.role !== 'ICT_STAFF' || sched.technicianId !== actor.id) throw new ForbiddenException('HR_PERMISSION_DENIED');

        sched.status = InstallStatus.IN_PROGRESS;
        sched.startedAt = new Date();
        const saved = await this.repo.save(sched);
        await this.activity.log(requestId, actor.id, 'INSTALL_STARTED', { scheduleId: saved.id });
        const req = await this.reqRepo.findOne({ where: { id: requestId } });
        this.emitter.emit(HR_EVT.INSTALL_STARTED, { 
            requestId, scheduleId: saved.id, requesterId: req?.requesterId ?? '',
            actorId: actor.id, occurredAt: new Date() 
        });
        return saved;
    }

    async completeInstallation(requestId: string, actor: ActingUser): Promise<InstallationSchedule> {
        return this.dataSource.transaction(async (mgr) => {
            const repo = mgr.getRepository(InstallationSchedule);

            let sched = await repo.findOne({
                where: { requestId },
                order: { createdAt: 'DESC' },
            });

            if (!sched || INSTALL_TERMINAL.has(sched.status)) {
                sched = repo.create({
                    requestId, technicianId: actor.id,
                    scheduledStart: new Date(), scheduledEnd: new Date(),
                    status: InstallStatus.IN_PROGRESS,
                    proposedBy: actor.id, confirmedBy: actor.id,
                    startedAt: new Date(),
                });
                sched = await repo.save(sched);
            } else if (sched.status !== InstallStatus.IN_PROGRESS) {
                sched.status = InstallStatus.IN_PROGRESS;
                sched.startedAt = new Date();
                sched = await repo.save(sched);
            }

            sched.status = InstallStatus.DONE;
            sched.completedAt = new Date();
            sched.technicianId = actor.id;
            const saved = await repo.save(sched);
            await this.activity.log(requestId, actor.id, 'INSTALL_SCHEDULE_DONE', { scheduleId: saved.id });

            return saved;
        });
    }

    async calendar(q: CalendarQueryDto): Promise<any[]> {
        const qb = this.repo.createQueryBuilder('s')
            .leftJoinAndSelect('s.request', 'r')
            .leftJoinAndSelect('r.site', 'site')
            .leftJoinAndSelect('s.technician', 'tech')
            .where('s.scheduledStart >= :from AND s.scheduledStart < :to', { from: q.from, to: q.to });

        if (q.technicianIds?.length) qb.andWhere('s.technicianId IN (:...t)', { t: q.technicianIds });
        if (q.status?.length) qb.andWhere('s.status IN (:...st)', { st: q.status });
        if (q.requesterId) qb.andWhere('r.requesterId = :rid', { rid: q.requesterId });
        
        const rows = await qb.orderBy('s.scheduledStart', 'ASC').getMany();
        return rows.map(s => ({
            scheduleId: s.id,
            requestId: s.requestId,
            requestNumber: s.request?.requestNumber,
            siteName: s.request?.site?.name,
            technicianName: s.technician?.fullName,
            recipientName: s.request?.recipientName,
            division: s.request?.division,
            status: s.status,
            requestStatus: s.request?.status,
            scheduledAt: s.scheduledStart?.toISOString(),
            endsAt: s.scheduledEnd?.toISOString(),
        }));
    }

    async unscheduled(): Promise<Array<{ id: string; requestNumber: string; siteName: string }>> {
        const qb = this.reqRepo.createQueryBuilder('hr')
            .leftJoin('hr.site', 'site')
            .leftJoin(InstallationSchedule, 'sch',
                `sch."requestId" = hr.id AND sch.status IN ('${InstallStatus.PROPOSED}','${InstallStatus.CONFIRMED}','${InstallStatus.IN_PROGRESS}')`)
            .where('hr.status = :st', { st: RequestStatus.INSTALLATION })
            .andWhere('sch.id IS NULL')
            .select(['hr.id AS id', 'hr.\"requestNumber\" AS "requestNumber"', 'site.name AS "siteName"']);
        return qb.getRawMany();
    }

    async myToday(userId: string): Promise<Array<{
        id: string; requestId: string; requestNumber: string; siteName: string; scheduledAt: string;
    }>> {
        const start = new Date(); start.setHours(0,0,0,0);
        const end = new Date();   end.setHours(23,59,59,999);
        const rows = await this.repo.createQueryBuilder('sch')
            .leftJoin('sch.request', 'hr')
            .leftJoin('hr.site', 'site')
            .where('sch.\"technicianId\" = :uid', { uid: userId })
            .andWhere('sch.\"scheduledStart\" BETWEEN :s AND :e', { s: start, e: end })
            .andWhere(`sch.status IN ('${InstallStatus.PROPOSED}','${InstallStatus.CONFIRMED}','${InstallStatus.IN_PROGRESS}')`)
            .select([
                'sch.id AS id',
                'hr.id AS "requestId"',
                'hr.\"requestNumber\" AS "requestNumber"',
                'site.name AS "siteName"',
                'sch.\"scheduledStart\" AS "scheduledAt"',
            ])
            .getRawMany();
        return rows;
    }
}
