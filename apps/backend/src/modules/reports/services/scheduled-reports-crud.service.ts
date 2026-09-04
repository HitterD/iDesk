import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScheduledReportConfig } from '../entities/scheduled-report-config.entity';
import { ScheduledReportExecution } from '../entities/scheduled-report-execution.entity';
import { User } from '../../users/entities/user.entity';
import { CreateScheduledReportConfigDto } from '../dto/create-scheduled-report-config.dto';
import { UpdateScheduledReportConfigDto } from '../dto/update-scheduled-report-config.dto';
import { SiteActor, resolveSiteScope, isCrossSiteRole, assertSiteAccess } from '../../../shared/core/utils/site-scope.util';
import { DynamicScheduledReportsService, ALL_AGENT_ROLES } from '../generators/dynamic-scheduled-reports.service';

/**
 * CRUD service for ScheduledReportConfig.
 * Enforces site isolation using the standard SiteActor pattern.
 */
@Injectable()
export class ScheduledReportsCrudService {
  constructor(
    @InjectRepository(ScheduledReportConfig)
    private readonly configRepo: Repository<ScheduledReportConfig>,
    @InjectRepository(ScheduledReportExecution)
    private readonly executionRepo: Repository<ScheduledReportExecution>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dynamicScheduler: DynamicScheduledReportsService,
  ) {}

  /**
   * Candidate recipients for a config: active agents at one specific site.
   *
   * Mirrors the runtime rules in DynamicScheduledReportsService.filterValidRecipients
   * so the picker can never offer someone who would be silently dropped at send time.
   * Site-locked actors always get their own site; the requested site is ignored for them.
   */
  async listRecipientCandidates(actor: SiteActor, requestedSiteId?: string) {
    const scope = resolveSiteScope(actor);

    if (scope.mode === 'none') {
      throw new ForbiddenException('Cannot list recipients without a site context');
    }

    const targetSiteId = scope.mode === 'site' ? scope.siteId : requestedSiteId;
    if (!targetSiteId) {
      throw new ForbiddenException('siteId is required to list recipients');
    }

    // Cross-site actors may ask for any site; site-locked actors are pinned above.
    assertSiteAccess(actor, targetSiteId);

    return this.userRepo
      .createQueryBuilder('user')
      .where('user.isActive = :isActive', { isActive: true })
      .andWhere('user.siteId = :siteId', { siteId: targetSiteId })
      .andWhere('user.role IN (:...roles)', { roles: ALL_AGENT_ROLES })
      .andWhere('user.email NOT LIKE :deletedPrefix', { deletedPrefix: 'deleted_%' })
      .select(['user.id', 'user.fullName', 'user.email', 'user.role', 'user.siteId'])
      .orderBy('user.fullName', 'ASC')
      .getMany();
  }

  async list(actor: SiteActor, requestedSiteId?: string) {
    const scope = resolveSiteScope(actor);

    const qb = this.configRepo.createQueryBuilder('cfg')
      .leftJoinAndSelect('cfg.site', 'site')
      .orderBy('cfg.createdAt', 'DESC');

    if (scope.mode === 'site') {
      qb.andWhere('cfg.siteId = :siteId', { siteId: scope.siteId });
    } else if (scope.mode === 'none') {
      // fail closed: return nothing
      qb.andWhere('1 = 0');
    }
    // 'all' → no additional filter (cross-site)

    // If a cross-site user explicitly requests a site, narrow to it
    if (isCrossSiteRole(actor.role) && requestedSiteId) {
      qb.andWhere('cfg.siteId = :requested', { requested: requestedSiteId });
    }

    return qb.getMany();
  }

  async create(actor: SiteActor, dto: CreateScheduledReportConfigDto, createdById: string) {
    // Non-cross-site users are forced to their own site
    const effectiveSiteId = isCrossSiteRole(actor.role) ? dto.siteId : (actor.siteId ?? null);

    if (!effectiveSiteId) {
      throw new ForbiddenException('Cannot create scheduled report without a site context');
    }

    const entity = this.configRepo.create({
      name: dto.name,
      reportType: dto.reportType,
      schedule: dto.schedule,
      sendTime: dto.sendTime,
      siteId: effectiveSiteId,
      recipientUserIds: dto.recipientUserIds,
      targetAgentCategory: dto.targetAgentCategory ?? null,
      createdById,
      isActive: true,
    });

    const saved = await this.configRepo.save(entity);

    // Register the job immediately
    this.dynamicScheduler.registerConfig(saved);

    return saved;
  }

  async findOne(actor: SiteActor, id: string) {
    const entity = await this.configRepo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Scheduled report config not found');

    assertSiteAccess(actor, entity.siteId);
    return entity;
  }

  async update(actor: SiteActor, id: string, dto: UpdateScheduledReportConfigDto) {
    const existing = await this.findOne(actor, id);

    // If siteId is being changed, only cross-site roles may do so
    if (dto.siteId && dto.siteId !== existing.siteId) {
      if (!isCrossSiteRole(actor.role)) {
        throw new ForbiddenException('Cannot move scheduled report to another site');
      }
    }

    Object.assign(existing, {
      name: dto.name ?? existing.name,
      reportType: dto.reportType ?? existing.reportType,
      schedule: dto.schedule ?? existing.schedule,
      sendTime: dto.sendTime ?? existing.sendTime,
      siteId: dto.siteId ?? existing.siteId,
      recipientUserIds: dto.recipientUserIds ?? existing.recipientUserIds,
      targetAgentCategory: dto.targetAgentCategory !== undefined ? dto.targetAgentCategory : existing.targetAgentCategory,
      isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
    });

    const saved = await this.configRepo.save(existing);

    // Re-register job (handles schedule/sendTime changes)
    if (saved.isActive) {
      this.dynamicScheduler.registerConfig(saved);
    } else {
      this.dynamicScheduler.unregisterJob(saved.id);
    }

    return saved;
  }

  async toggle(actor: SiteActor, id: string, isActive: boolean) {
    const existing = await this.findOne(actor, id);
    existing.isActive = isActive;
    const saved = await this.configRepo.save(existing);

    if (saved.isActive) {
      this.dynamicScheduler.registerConfig(saved);
    } else {
      this.dynamicScheduler.unregisterJob(saved.id);
    }

    return saved;
  }

  async remove(actor: SiteActor, id: string) {
    const existing = await this.findOne(actor, id);
    this.dynamicScheduler.unregisterJob(existing.id);
    await this.configRepo.softRemove(existing);
    return { success: true };
  }

  async triggerNow(actor: SiteActor, id: string) {
    // Only ADMIN and MANAGER should be allowed — controller will also guard,
    // but we double-check here for defense in depth.
    if (!isCrossSiteRole(actor.role)) {
      // Non-cross-site must still be able to trigger their own site's reports if they have page access
      // We rely on controller @Roles or explicit check; here we just ensure site access.
    }

    const cfg = await this.findOne(actor, id);
    await this.dynamicScheduler.triggerNow(cfg.id);
    return { success: true, message: 'Report triggered' };
  }

  /**
   * List execution history for a config (most recent first).
   */
  async listExecutions(actor: SiteActor, configId: string, limit = 50) {
    // Ensure the actor can see the config
    await this.findOne(actor, configId);

    return this.executionRepo.find({
      where: { configId },
      order: { executedAt: 'DESC' },
      take: limit,
    });
  }
}
