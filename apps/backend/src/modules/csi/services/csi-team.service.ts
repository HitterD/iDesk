import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { Site } from '../../sites/entities/site.entity';
import { User } from '../../users/entities/user.entity';
import { CsiPeriodPublishStatus, CsiTeamKind } from '../csi.constants';
import { CSI_CUSTOM_TEAM_NAME_MAX } from '../dto/subject.dto';
import { CsiAssignmentTemplatePic } from '../entities/csi-assignment-template-pic.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiTeamMember } from '../entities/csi-team-member.entity';
import { CsiTeam } from '../entities/csi-team.entity';
import { normalizeName } from '../org/csi-name-match';
import { computeStatus } from './csi-period.service';
import { assertHcScope } from './csi-scope.util';
import { CsiSubjectView, teamView } from './csi-subject.service';

const TEAM_NOT_FOUND_MESSAGE = 'Tim tidak ditemukan';
const SITE_NOT_FOUND_MESSAGE = 'Site tidak ditemukan';
const CUSTOM_REQUIRED_MESSAGE = 'Nama dan layanan tim wajib diisi';
const NAME_TAKEN_MESSAGE = 'Nama tim sudah dipakai di site ini';
const TEAM_IN_USE_MESSAGE = 'Tim dipakai di survei yang belum selesai';

export type CsiCreateCustomTeamInput = { siteId: string; name?: string; serviceCode?: string };
export type CsiUpdateTeamInput = { name?: string; serviceCode?: string };
export type CsiTeamMemberInput = { userId?: string; name?: string };

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

    /** HC only; name and layanan are required and the name is unique (normalised) among the site's active custom teams. */
    async createCustom(scope: ServiceScope, input: CsiCreateCustomTeamInput): Promise<CsiSubjectView> {
        assertHcScope(scope);
        const manager = this.dataSource.manager;
        const name = input.name?.trim();
        if (!name || !input.serviceCode) throw new BadRequestException(CUSTOM_REQUIRED_MESSAGE);
        if (name.length > CSI_CUSTOM_TEAM_NAME_MAX) throw new BadRequestException('Nama tim harus terdiri dari 1–150 karakter');
        const site = await manager.getRepository(Site).findOne({ where: { id: input.siteId } });
        if (!site) throw new NotFoundException(SITE_NOT_FOUND_MESSAGE);
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

    /**
     * Deletes a custom team and its template rows (their template raters cascade; the template_pics FK would only null
     * teamId and leave orphan rows). Refused while a not-cancelled survey that has not ended rates the team. A team still
     * referenced by ended or cancelled surveys is deactivated instead (csi_period_ratees.teamId has no ON DELETE, and
     * those results must stay readable).
     */
    async remove(scope: ServiceScope, id: string): Promise<void> {
        await this.dataSource.transaction(async (manager) => {
            const team = await this.findTeam(manager, scope, id);
            if (team.kind !== CsiTeamKind.CUSTOM) throw new BadRequestException('Hanya tim custom yang bisa dihapus');
            const periods = await this.periodsRating(manager, team.id);
            const now = this.clock();
            const running = periods.some((period) => period.publishStatus !== CsiPeriodPublishStatus.CANCELLED && computeStatus(period, now) !== 'ENDED');
            if (running) throw new BadRequestException(TEAM_IN_USE_MESSAGE);
            await manager.getRepository(CsiAssignmentTemplatePic).delete({ teamId: team.id });
            if (periods.length) await manager.getRepository(CsiTeam).save({ ...team, isActive: false });
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
            for (const [sortOrder, member] of wanted.entries()) {
                await repo.save({ teamId: team.id, name: member.name, userId: member.userId, nik: nikOf.get(normalizeName(member.name)) ?? null, sortOrder });
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

    /** Periods (any status) that rate this team. */
    private async periodsRating(manager: EntityManager, teamId: string): Promise<CsiPeriod[]> {
        const ratees = await manager.getRepository(CsiPeriodRatee).find({ where: { teamId }, select: { id: true, periodId: true } });
        const periodIds = [...new Set(ratees.map((ratee) => ratee.periodId))];
        return periodIds.length ? manager.getRepository(CsiPeriod).find({ where: { id: In(periodIds) } }) : [];
    }

    private async assertNameFree(manager: EntityManager, scope: ServiceScope, siteId: string, name: string) {
        const teams = await manager.getRepository(CsiTeam).find({ where: { scope, siteId, kind: CsiTeamKind.CUSTOM, isActive: true } });
        if (teams.some((team) => normalizeName(team.name) === normalizeName(name))) throw new BadRequestException(NAME_TAKEN_MESSAGE);
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
