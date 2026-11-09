import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs';
import { In, Repository } from 'typeorm';
import { ROLE_SCOPE, ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { Site } from '../../sites/entities/site.entity';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { CSI_JOB_TITLE_MAX, CSI_TAGLINE_MAX, CSI_TEAM_NAME_MAX, UpdateSubjectDto } from '../dto/subject.dto';
import { CsiRateeKind } from '../csi.constants';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiSubjectProfile } from '../entities/csi-subject-profile.entity';
import { CsiTeam } from '../entities/csi-team.entity';
import { parseSubjectKey, teamSubjectKey, userSubjectKey } from './csi-subject-key.util';

/** Public prefix of uploaded CSI photos; only files under it are ever deleted. */
export const CSI_PHOTO_URL_PREFIX = '/uploads/csi/';
const SUBJECT_NOT_FOUND_MESSAGE = 'Subjek tidak ditemukan';
const SITE_NOT_FOUND_MESSAGE = 'Site tidak ditemukan';
const TEAM_NAME_PREFIX = 'Tim ';

export type CsiSubjectView = {
    key: string; kind: 'PERSON' | 'TEAM'; userId: string | null; teamId: string | null; siteId: string;
    name: string; jobTitle: string | null; photoUrl: string | null; tagline: string | null;
    /** Fungsi pelayanan (people only; teams have none). */
    serviceFunction: string | null;
};
export type CsiSubjectGroup = { siteId: string; siteCode: string; siteName: string; team: CsiSubjectView | null; people: CsiSubjectView[] };

type SubjectUser = Pick<User, 'id' | 'fullName' | 'siteId' | 'jobTitle' | 'avatarUrl'>;
const USER_FIELDS = { id: true, fullName: true, siteId: true, jobTitle: true, avatarUrl: true } as const;

/** Administrator roles of a scope: they run the survey, they are not rated by it (HC people are picked by hand). */
const SCOPE_ADMIN_ROLES: readonly UserRole[] = [UserRole.HC_ADMIN];

/** Staff roles mapped to the scope (ROLE_SCOPE is the single source of truth); ADMIN and scope admins are not subjects. */
const agentRolesOf = (scope: ServiceScope) =>
    (Object.keys(ROLE_SCOPE) as UserRole[]).filter((role) => ROLE_SCOPE[role] === scope && !SCOPE_ADMIN_ROLES.includes(role));

const personView = (user: SubjectUser, profile: CsiSubjectProfile | undefined): CsiSubjectView => ({
    key: userSubjectKey(user.id), kind: 'PERSON', userId: user.id, teamId: null, siteId: user.siteId, name: user.fullName,
    jobTitle: profile?.jobTitle ?? user.jobTitle ?? null,
    photoUrl: profile?.photoUrl ?? user.avatarUrl ?? null,
    tagline: profile?.tagline ?? null,
    serviceFunction: profile?.serviceFunction ?? null,
});

const teamView = (team: CsiTeam): CsiSubjectView => ({
    key: teamSubjectKey(team.id), kind: 'TEAM', userId: null, teamId: team.id, siteId: team.siteId, name: team.name,
    jobTitle: team.jobTitle ?? null, photoUrl: team.photoUrl ?? null, tagline: team.tagline ?? null, serviceFunction: null,
});

/** Resolved display profile of one period ratee. */
export type CsiRateeView = { siteId: string | null; siteCode: string | null; photoUrl: string | null; tagline: string | null; jobTitle: string | null };
type RateeMaster = { siteId: string | null; photoUrl: string | null; tagline: string | null; jobTitle: string | null };

const unique = (ids: string[]) => [...new Set(ids)];
const teamMaster = (team: CsiTeam | undefined): RateeMaster => ({
    siteId: team?.siteId ?? null, photoUrl: team?.photoUrl ?? null, tagline: team?.tagline ?? null, jobTitle: team?.jobTitle ?? null,
});
const personMaster = (user: SubjectUser | undefined, profile: CsiSubjectProfile | undefined): RateeMaster => ({
    siteId: user?.siteId ?? null,
    photoUrl: profile?.photoUrl ?? user?.avatarUrl ?? null,
    tagline: profile?.tagline ?? null,
    jobTitle: profile?.jobTitle ?? null,
});

/** Service-side copy of the DTO limits, so non-HTTP callers get the same 400s. */
function assertLengths(dto: UpdateSubjectDto) {
    if (typeof dto.tagline === 'string' && dto.tagline.length > CSI_TAGLINE_MAX) throw new BadRequestException('Tagline maksimal 90 karakter');
    if (typeof dto.jobTitle === 'string' && dto.jobTitle.length > CSI_JOB_TITLE_MAX) throw new BadRequestException('Jabatan maksimal 150 karakter');
    if (typeof dto.serviceFunction === 'string' && dto.serviceFunction.trim().length > CSI_JOB_TITLE_MAX) throw new BadRequestException('Fungsi pelayanan maksimal 150 karakter');
    if (dto.name !== undefined && (!dto.name || dto.name.length > CSI_TEAM_NAME_MAX)) {
        throw new BadRequestException('Nama tim harus terdiri dari 1–100 karakter');
    }
}

/** Empty strings clear a nullable text field. */
const nullable = (value: string | null | undefined) => (value === undefined ? undefined : value || null);
const definedOnly = <T extends object>(value: T): Partial<T> =>
    Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)) as Partial<T>;

/** Master data of CSI subjects: people (csi_subject_profiles over User) and one team per site (csi_teams). */
@Injectable()
export class CsiSubjectService {
    private readonly logger = new Logger(CsiSubjectService.name);

    constructor(
        @InjectRepository(User) private readonly users: Repository<User>,
        @InjectRepository(Site) private readonly sites: Repository<Site>,
        @InjectRepository(CsiTeam) private readonly teams: Repository<CsiTeam>,
        @InjectRepository(CsiSubjectProfile) private readonly profiles: Repository<CsiSubjectProfile>,
    ) { }

    /** Every active site (by code) with its team (or null) and the scope's active agents whose User.siteId is that site. */
    async list(scope: ServiceScope): Promise<CsiSubjectGroup[]> {
        const sites = (await this.sites.find({ where: { isActive: true } })).sort((a, b) => a.code.localeCompare(b.code));
        const people = await this.eligibleUsers(scope);
        const profiles = people.length ? await this.profiles.find({ where: { scope, userId: In(people.map((user) => user.id)) } }) : [];
        const profileByUser = new Map(profiles.map((profile) => [profile.userId, profile]));
        const teams = await this.teams.find({ where: { scope } });
        return sites.map((site) => {
            const team = teams.find((row) => row.siteId === site.id);
            return {
                siteId: site.id, siteCode: site.code, siteName: site.name,
                team: team ? teamView(team) : null,
                people: people.filter((user) => user.siteId === site.id)
                    .sort((a, b) => a.fullName.localeCompare(b.fullName))
                    .map((user) => personView(user, profileByUser.get(user.id))),
            };
        });
    }

    /**
     * Display profile of period ratees (one query per table): per-period override (csi_period_ratees.photoUrl/tagline)
     * → master (team: csi_teams; person: csi_subject_profiles, photo falling back to User.avatarUrl). Master values are
     * resolved on read and never copied into the period row.
     */
    async viewsFor(scope: ServiceScope, ratees: CsiPeriodRatee[]): Promise<Map<string, CsiRateeView>> {
        const teamIds = unique(ratees.flatMap((ratee) => (ratee.kind === CsiRateeKind.TEAM && ratee.teamId ? [ratee.teamId] : [])));
        const userIds = unique(ratees.flatMap((ratee) => (ratee.kind !== CsiRateeKind.TEAM && ratee.userId ? [ratee.userId] : [])));
        const teams = teamIds.length ? await this.teams.find({ where: { id: In(teamIds) } }) : [];
        const users = userIds.length ? await this.users.find({ where: { id: In(userIds) }, select: USER_FIELDS }) : [];
        const profiles = userIds.length ? await this.profiles.find({ where: { scope, userId: In(userIds) } }) : [];
        const teamById = new Map(teams.map((team) => [team.id, team]));
        const userById = new Map(users.map((user) => [user.id, user]));
        const profileByUser = new Map(profiles.map((profile) => [profile.userId, profile]));
        const masters = new Map(ratees.map((ratee) => [ratee.id, ratee.kind === CsiRateeKind.TEAM
            ? teamMaster(ratee.teamId ? teamById.get(ratee.teamId) : undefined)
            : personMaster(ratee.userId ? userById.get(ratee.userId) : undefined, ratee.userId ? profileByUser.get(ratee.userId) : undefined)]));
        const siteIds = unique(ratees.flatMap((ratee) => {
            const siteId = ratee.siteId ?? masters.get(ratee.id)!.siteId;
            return siteId ? [siteId] : [];
        }));
        const sites = siteIds.length ? await this.sites.find({ where: { id: In(siteIds) } }) : [];
        const codeOf = new Map(sites.map((site) => [site.id, site.code]));
        return new Map(ratees.map((ratee) => {
            const master = masters.get(ratee.id)!;
            const siteId = ratee.siteId ?? master.siteId;
            return [ratee.id, {
                siteId, siteCode: siteId ? codeOf.get(siteId) ?? null : null,
                photoUrl: ratee.photoUrl ?? master.photoUrl,
                tagline: ratee.tagline ?? master.tagline,
                jobTitle: master.jobTitle ?? ratee.jobTitle ?? null,
            }];
        }));
    }

    /** Fungsi pelayanan of people of a scope (only those with one set). */
    async serviceFunctionsOf(scope: ServiceScope, userIds: string[]): Promise<Map<string, string>> {
        const ids = unique(userIds);
        if (!ids.length) return new Map();
        const rows = await this.profiles.find({ where: { scope, userId: In(ids) }, select: { userId: true, serviceFunction: true } });
        return new Map(rows.filter((row) => row.serviceFunction).map((row) => [row.userId, row.serviceFunction!]));
    }

    /** Single-ratee form of `viewsFor`. */
    async viewFor(scope: ServiceScope, ratee: CsiPeriodRatee): Promise<CsiRateeView> {
        return (await this.viewsFor(scope, [ratee])).get(ratee.id)!;
    }

    /** Edits tagline/jobTitle (person → csi_subject_profiles upsert) or also name (team → csi_teams). */
    async update(scope: ServiceScope, key: string, dto: UpdateSubjectDto): Promise<CsiSubjectView> {
        const ref = parseSubjectKey(key);
        assertLengths(dto);
        const fields = definedOnly({ tagline: nullable(dto.tagline), jobTitle: nullable(dto.jobTitle) });
        if (ref.kind === 'team') {
            if (dto.serviceFunction !== undefined) throw new BadRequestException('Fungsi pelayanan hanya untuk orang');
            const team = await this.findTeam(scope, ref.id);
            return teamView(await this.teams.save({ ...team, ...fields, ...(dto.name !== undefined ? { name: dto.name } : {}) }));
        }
        if (dto.name !== undefined) throw new BadRequestException('Nama hanya bisa diubah untuk tim');
        const serviceFunction = dto.serviceFunction === undefined ? {} : { serviceFunction: nullable(dto.serviceFunction?.trim()) ?? null };
        const user = await this.findPerson(scope, ref.id);
        const profile = await this.profiles.findOne({ where: { scope, userId: user.id } });
        const saved = await this.profiles.save({ ...(profile ?? { scope, userId: user.id, photoUrl: null, tagline: null, jobTitle: null }), ...fields, ...serviceFunction });
        return personView(user, saved as CsiSubjectProfile);
    }

    /**
     * Stores an uploaded photo and deletes the previous one when it is a CSI upload (never a user avatar).
     * On an unknown subject the freshly uploaded file is removed before rethrowing.
     */
    async setPhoto(scope: ServiceScope, key: string, photoUrl: string, uploadedPath?: string): Promise<CsiSubjectView> {
        try {
            const ref = parseSubjectKey(key);
            if (ref.kind === 'team') {
                const team = await this.findTeam(scope, ref.id);
                const saved = await this.teams.save({ ...team, photoUrl });
                await this.removeOldPhoto(team.photoUrl);
                return teamView(saved);
            }
            const user = await this.findPerson(scope, ref.id);
            const profile = await this.profiles.findOne({ where: { scope, userId: user.id } });
            const saved = await this.profiles.save({ ...(profile ?? { scope, userId: user.id, tagline: null, jobTitle: null }), photoUrl });
            await this.removeOldPhoto(profile?.photoUrl ?? null);
            return personView(user, saved as CsiSubjectProfile);
        } catch (error) {
            if (uploadedPath) await this.unlinkQuietly(uploadedPath);
            throw error;
        }
    }

    /** Idempotent: returns the existing team of the site, otherwise creates `Tim <site.name>`. */
    async createTeam(scope: ServiceScope, siteId: string): Promise<CsiSubjectView> {
        const existing = await this.teams.findOne({ where: { scope, siteId } });
        if (existing) return teamView(existing);
        const site = await this.sites.findOne({ where: { id: siteId } });
        if (!site) throw new NotFoundException(SITE_NOT_FOUND_MESSAGE);
        const saved = await this.teams.save({
            scope, siteId, name: `${TEAM_NAME_PREFIX}${site.name}`.slice(0, CSI_TEAM_NAME_MAX),
            photoUrl: null, tagline: null, jobTitle: null, isActive: true,
        });
        return teamView(saved as CsiTeam);
    }

    /**
     * Adds active users as hand-picked members of the scope (HC subjects; any department). Idempotent.
     * Returns the refreshed subject list.
     */
    async addMembers(scope: ServiceScope, userIds: string[]): Promise<CsiSubjectGroup[]> {
        const ids = unique(userIds);
        const users = ids.length ? await this.users.find({ where: { id: In(ids), isActive: true }, select: { id: true } }) : [];
        if (users.length !== ids.length) throw new BadRequestException('Pengguna tidak ditemukan atau tidak aktif');
        const existing = ids.length ? await this.profiles.find({ where: { scope, userId: In(ids) } }) : [];
        const byUser = new Map(existing.map((profile) => [profile.userId, profile]));
        const rows = ids.map((userId) => ({ ...(byUser.get(userId) ?? { scope, userId, photoUrl: null, tagline: null, jobTitle: null }), isMember: true }));
        for (const row of rows) await this.profiles.save(row);
        return this.list(scope);
    }

    /** Removes a hand-picked member (photo and tagline are kept should they be added back). */
    async removeMember(scope: ServiceScope, userId: string): Promise<CsiSubjectGroup[]> {
        const profile = await this.profiles.findOne({ where: { scope, userId, isMember: true } });
        if (!profile) throw new NotFoundException(SUBJECT_NOT_FOUND_MESSAGE);
        await this.profiles.save({ ...profile, isMember: false });
        return this.list(scope);
    }

    /** Scope staff roles (ICT) plus hand-picked members (HC, or extra people of any scope). */
    private async eligibleUsers(scope: ServiceScope): Promise<SubjectUser[]> {
        const roles = agentRolesOf(scope);
        const members = (await this.profiles.find({ where: { scope, isMember: true }, select: { userId: true } })).map((row) => row.userId);
        const where = [
            ...(roles.length ? [{ isActive: true, role: In(roles) }] : []),
            ...(members.length ? [{ isActive: true, id: In(members) }] : []),
        ];
        return where.length ? this.users.find({ where, select: USER_FIELDS }) : [];
    }

    private async findPerson(scope: ServiceScope, userId: string): Promise<SubjectUser> {
        const user = (await this.eligibleUsers(scope)).find((row) => row.id === userId);
        if (!user) throw new NotFoundException(SUBJECT_NOT_FOUND_MESSAGE);
        return user;
    }

    private async findTeam(scope: ServiceScope, teamId: string): Promise<CsiTeam> {
        const team = await this.teams.findOne({ where: { id: teamId, scope } });
        if (!team) throw new NotFoundException(SUBJECT_NOT_FOUND_MESSAGE);
        return team;
    }

    /** Deletes a CSI-uploaded photo (PIC photos); anything outside /uploads/csi/ is never touched. */
    removeCsiPhoto(url: string | null) {
        return this.removeOldPhoto(url);
    }

    private async removeOldPhoto(oldUrl: string | null) {
        if (oldUrl?.startsWith(CSI_PHOTO_URL_PREFIX)) await this.unlinkQuietly(`.${oldUrl}`);
    }

    /** Pattern of user-crud.service updateAvatar: a failed delete is logged, never fatal. */
    private async unlinkQuietly(path: string) {
        try {
            await fs.promises.unlink(path);
        } catch (error) {
            this.logger.warn(`Failed to delete CSI photo ${path}: ${(error as Error).message}`);
        }
    }
}
