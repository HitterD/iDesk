import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { Site } from '../../sites/entities/site.entity';
import { User } from '../../users/entities/user.entity';
import { CsiPeriodPublishStatus, CsiTeamKind } from '../csi.constants';
import { CSI_CUSTOM_TEAM_NAME_MAX } from '../dto/subject.dto';
import { CsiAssignmentTemplatePic } from '../entities/csi-assignment-template-pic.entity';
import { CsiPeriodRateeDimension } from '../entities/csi-period-ratee-dimension.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriodRaterRatee } from '../entities/csi-period-rater-ratee.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiResponse } from '../entities/csi-response.entity';
import { CsiTeamMember } from '../entities/csi-team-member.entity';
import { CsiTeam } from '../entities/csi-team.entity';
import { normalizeName } from '../org/csi-name-match';
import { lockUnlockedPeriod } from './csi-period-lock.util';
import { computeStatus } from './csi-period.service';
import { assertHcScope } from './csi-scope.util';
import { CsiSubjectView, teamView } from './csi-subject.service';

const TEAM_NOT_FOUND_MESSAGE = 'Tim tidak ditemukan';
const SITE_NOT_FOUND_MESSAGE = 'Site tidak ditemukan';
const CUSTOM_REQUIRED_MESSAGE = 'Nama dan layanan tim wajib diisi';
const NAME_TAKEN_MESSAGE = 'Nama tim sudah dipakai di site ini';
const TEAM_IN_USE_MESSAGE = 'Tim dipakai di survei yang sedang berjalan';

export type CsiCreateCustomTeamInput = { siteId: string; name?: string; serviceCode?: string };
export type CsiUpdateTeamInput = { name?: string; serviceCode?: string };
export type CsiTeamMemberInput = { userId?: string; name?: string };
export type CsiTeamSurveyRef = { periodId: string; title: string };
/** `running`: published and open now; `answered`: the survey already has responses (its assignments are locked). */
export type CsiTeamBlockReason = 'running' | 'answered';
/**
 * What deleting a team does to the surveys that rate it: `blocked` surveys refuse the delete; the team ratee of each
 * `draftSurveys` entry (DRAFT, or published but not started, without answers) is removed with it; `finishedSurveys`
 * (ended or cancelled) keep their results, so the team is deactivated instead of deleted.
 */
export type CsiTeamDeleteImpact = {
    blocked: Array<CsiTeamSurveyRef & { reason: CsiTeamBlockReason }>;
    draftSurveys: CsiTeamSurveyRef[];
    finishedSurveys: number;
};
type ImpactPlan = CsiTeamDeleteImpact & { draftRateeIds: string[] };

/**
 * HC CUSTOM teams of a site (name + layanan, members with or without an account) and edits of any team. The single SITE
 * team is still created by CsiSubjectService.createTeam (also used by the period service). Kept apart from the subject
 * service so both stay small.
 */
@Injectable()
export class CsiTeamService {
    /** Clock seam for "survey still running" checks. */
    clock: () => Date = () => new Date();

    constructor(@InjectDataSource() private readonly dataSource: DataSource) { }

    /**
     * HC only; name and layanan are required. A deactivated custom team of the site with the same (normalised) name is
     * reactivated with the new layanan instead of inserting a twin, so names stay unique per site.
     */
    async createCustom(scope: ServiceScope, input: CsiCreateCustomTeamInput): Promise<CsiSubjectView> {
        assertHcScope(scope);
        const manager = this.dataSource.manager;
        const name = input.name?.trim();
        if (!name || !input.serviceCode) throw new BadRequestException(CUSTOM_REQUIRED_MESSAGE);
        if (name.length > CSI_CUSTOM_TEAM_NAME_MAX) throw new BadRequestException('Nama tim harus terdiri dari 1–150 karakter');
        const site = await manager.getRepository(Site).findOne({ where: { id: input.siteId } });
        if (!site) throw new NotFoundException(SITE_NOT_FOUND_MESSAGE);
        const inactive = (await this.customTeamsOf(manager, scope, site.id))
            .find((team) => !team.isActive && normalizeName(team.name) === normalizeName(name));
        if (inactive) {
            const revived = await manager.getRepository(CsiTeam).save({ ...inactive, isActive: true, serviceCode: input.serviceCode });
            return teamView(revived, await this.membersOf(manager, revived.id));
        }
        await this.assertNameFree(manager, scope, site.id, name);
        const saved = await manager.getRepository(CsiTeam).save({
            scope, siteId: site.id, kind: CsiTeamKind.CUSTOM, name, serviceCode: input.serviceCode,
            photoUrl: null, tagline: null, jobTitle: null, isActive: true,
        } as Partial<CsiTeam>) as CsiTeam;
        return teamView(saved, []);
    }

    /** Renames any team of the scope; the layanan belongs to custom teams only. */
    async update(scope: ServiceScope, id: string, input: CsiUpdateTeamInput): Promise<CsiSubjectView> {
        const manager = this.dataSource.manager;
        const team = await this.findTeam(manager, scope, id);
        const isCustom = team.kind === CsiTeamKind.CUSTOM;
        if (input.serviceCode !== undefined && !isCustom) throw new BadRequestException('Layanan hanya untuk tim custom');
        const name = input.name?.trim();
        if (input.name !== undefined && !name) throw new BadRequestException(CUSTOM_REQUIRED_MESSAGE);
        if (name && isCustom && normalizeName(name) !== normalizeName(team.name)) await this.assertNameFree(manager, scope, team.siteId, name);
        const saved = await manager.getRepository(CsiTeam).save({
            ...team, ...(name ? { name } : {}), ...(input.serviceCode !== undefined ? { serviceCode: input.serviceCode } : {}),
        });
        return isCustom ? teamView(saved, await this.membersOf(manager, saved.id)) : teamView(saved);
    }

    /** Dry run of `remove` (HC; SITE and CUSTOM teams alike). */
    async deleteImpact(scope: ServiceScope, id: string): Promise<CsiTeamDeleteImpact> {
        const manager = this.dataSource.manager;
        const { draftRateeIds: _ids, ...impact } = await this.planDelete(manager, await this.findTeam(manager, scope, id));
        return impact;
    }

    /**
     * Deletes a team (SITE or CUSTOM) with its template rows (their template raters cascade; the template_pics FK would
     * only null teamId and leave orphan rows). Refused, naming the surveys, while a running or answered survey rates the
     * team. Its ratee (with pairs and question snapshots) is first removed from draft / not-yet-started surveys. A team
     * still referenced by ended or cancelled surveys is deactivated instead (csi_period_ratees.teamId has no ON DELETE,
     * and those results must stay readable).
     */
    async remove(scope: ServiceScope, id: string): Promise<void> {
        await this.dataSource.transaction(async (manager) => {
            const team = await this.findTeam(manager, scope, id);
            const plan = await this.planDelete(manager, team);
            if (plan.blocked.length) throw new BadRequestException(`${TEAM_IN_USE_MESSAGE}: ${plan.blocked.map((survey) => survey.title).join(', ')}`);
            // Re-checked under the period row lock: a respondent submitting meanwhile turns the delete into a 409.
            for (const survey of plan.draftSurveys) await lockUnlockedPeriod(manager, survey.periodId);
            if (plan.draftRateeIds.length) {
                const periodRateeId = In(plan.draftRateeIds);
                await manager.getRepository(CsiPeriodRaterRatee).delete({ periodRateeId });
                await manager.getRepository(CsiPeriodRateeDimension).delete({ periodRateeId });
                await manager.getRepository(CsiPeriodRatee).delete({ id: periodRateeId });
            }
            await manager.getRepository(CsiAssignmentTemplatePic).delete({ teamId: team.id });
            if (plan.finishedSurveys) await manager.getRepository(CsiTeam).save({ ...team, isActive: false });
            else await manager.getRepository(CsiTeam).delete({ id: team.id });
        });
    }

    /**
     * Replaces the member list of a custom team (an explicit admin action, so members may be removed). With a userId the
     * name comes from the active account; with a name only the member has no account. Duplicates by normalised name are
     * dropped (first wins); a known member's NIK is kept.
     */
    async replaceMembers(scope: ServiceScope, id: string, input: CsiTeamMemberInput[]): Promise<CsiSubjectView> {
        return this.dataSource.transaction(async (manager) => {
            const team = await this.findTeam(manager, scope, id);
            if (team.kind !== CsiTeamKind.CUSTOM) throw new BadRequestException('Anggota hanya untuk tim custom');
            const wanted = await this.resolveMembers(manager, input);
            const repo = manager.getRepository(CsiTeamMember);
            const previous = await repo.find({ where: { teamId: team.id } });
            const nikOf = new Map(previous.map((member) => [normalizeName(member.name), member.nik ?? null]));
            await repo.delete({ teamId: team.id });
            if (wanted.length) {
                await repo.save(wanted.map((member, sortOrder) => ({
                    teamId: team.id, name: member.name, userId: member.userId, nik: nikOf.get(normalizeName(member.name)) ?? null, sortOrder,
                })));
            }
            return teamView(team, await this.membersOf(manager, team.id));
        });
    }

    private async resolveMembers(manager: EntityManager, input: CsiTeamMemberInput[]): Promise<Array<{ name: string; userId: string | null }>> {
        const userIds = [...new Set(input.flatMap((member) => (member.userId ? [member.userId] : [])))];
        const users = userIds.length
            ? await manager.getRepository(User).find({ where: { id: In(userIds), isActive: true }, select: { id: true, fullName: true } }) : [];
        if (users.length !== userIds.length) throw new BadRequestException('Pengguna tidak ditemukan atau tidak aktif');
        const nameOf = new Map(users.map((user) => [user.id, user.fullName]));
        const seen = new Set<string>();
        const resolved: Array<{ name: string; userId: string | null }> = [];
        for (const member of input) {
            const name = member.userId ? nameOf.get(member.userId)! : member.name?.trim().replace(/\s+/g, ' ');
            if (!name || name.length > CSI_CUSTOM_TEAM_NAME_MAX) throw new BadRequestException('Nama anggota harus terdiri dari 1–150 karakter');
            const key = normalizeName(name);
            if (seen.has(key)) continue;
            seen.add(key);
            resolved.push({ name, userId: member.userId ?? null });
        }
        return resolved;
    }

    /** Sorts every survey rating the team into finished (ended/cancelled), blocked (answered or running) and draft. */
    private async planDelete(manager: EntityManager, team: CsiTeam): Promise<ImpactPlan> {
        const ratees = await manager.getRepository(CsiPeriodRatee).find({ where: { teamId: team.id }, select: { id: true, periodId: true } });
        const periodIds = [...new Set(ratees.map((ratee) => ratee.periodId))];
        const periods = periodIds.length ? await manager.getRepository(CsiPeriod).find({ where: { id: In(periodIds) } }) : [];
        const answered = new Set(periodIds.length
            ? (await manager.getRepository(CsiResponse).find({ where: { periodId: In(periodIds) }, select: { id: true, periodId: true } })).map((row) => row.periodId)
            : []);
        const now = this.clock();
        const plan: ImpactPlan = { blocked: [], draftSurveys: [], finishedSurveys: 0, draftRateeIds: [] };
        const ordered = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title));
        for (const period of ordered) {
            const status = computeStatus(period, now);
            const ref = { periodId: period.id, title: period.title };
            if (period.publishStatus === CsiPeriodPublishStatus.CANCELLED || status === 'ENDED') plan.finishedSurveys += 1;
            else if (answered.has(period.id)) plan.blocked.push({ ...ref, reason: 'answered' });
            else if (period.publishStatus === CsiPeriodPublishStatus.PUBLISHED && status === 'ACTIVE') plan.blocked.push({ ...ref, reason: 'running' });
            else {
                plan.draftSurveys.push(ref);
                plan.draftRateeIds.push(...ratees.filter((ratee) => ratee.periodId === period.id).map((ratee) => ratee.id));
            }
        }
        return plan;
    }

    /** Checks active and deactivated custom teams alike: a name never matches two teams of a site (template import links by name). */
    private async assertNameFree(manager: EntityManager, scope: ServiceScope, siteId: string, name: string) {
        const teams = await this.customTeamsOf(manager, scope, siteId);
        if (teams.some((team) => normalizeName(team.name) === normalizeName(name))) throw new BadRequestException(NAME_TAKEN_MESSAGE);
    }

    private customTeamsOf(manager: EntityManager, scope: ServiceScope, siteId: string) {
        return manager.getRepository(CsiTeam).find({ where: { scope, siteId, kind: CsiTeamKind.CUSTOM } });
    }

    private async findTeam(manager: EntityManager, scope: ServiceScope, id: string): Promise<CsiTeam> {
        const team = await manager.getRepository(CsiTeam).findOne({ where: { id, scope } });
        if (!team) throw new NotFoundException(TEAM_NOT_FOUND_MESSAGE);
        return team;
    }

    private membersOf(manager: EntityManager, teamId: string) {
        return manager.getRepository(CsiTeamMember).find({ where: { teamId } });
    }
}
