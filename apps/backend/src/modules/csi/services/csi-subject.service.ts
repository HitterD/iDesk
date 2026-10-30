import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs';
import { In, Repository } from 'typeorm';
import { ROLE_SCOPE, ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { Site } from '../../sites/entities/site.entity';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { CSI_JOB_TITLE_MAX, CSI_TAGLINE_MAX, CSI_TEAM_NAME_MAX, UpdateSubjectDto } from '../dto/subject.dto';
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
};
export type CsiSubjectGroup = { siteId: string; siteCode: string; siteName: string; team: CsiSubjectView | null; people: CsiSubjectView[] };

type SubjectUser = Pick<User, 'id' | 'fullName' | 'siteId' | 'jobTitle' | 'avatarUrl'>;
const USER_FIELDS = { id: true, fullName: true, siteId: true, jobTitle: true, avatarUrl: true } as const;

/** Staff roles mapped to the scope (ROLE_SCOPE is the single source of truth); ADMIN is cross-scope and not a subject. */
const agentRolesOf = (scope: ServiceScope) =>
    (Object.keys(ROLE_SCOPE) as UserRole[]).filter((role) => ROLE_SCOPE[role] === scope);

const personView = (user: SubjectUser, profile: CsiSubjectProfile | undefined): CsiSubjectView => ({
    key: userSubjectKey(user.id), kind: 'PERSON', userId: user.id, teamId: null, siteId: user.siteId, name: user.fullName,
    jobTitle: profile?.jobTitle ?? user.jobTitle ?? null,
    photoUrl: profile?.photoUrl ?? user.avatarUrl ?? null,
    tagline: profile?.tagline ?? null,
});

const teamView = (team: CsiTeam): CsiSubjectView => ({
    key: teamSubjectKey(team.id), kind: 'TEAM', userId: null, teamId: team.id, siteId: team.siteId, name: team.name,
    jobTitle: team.jobTitle ?? null, photoUrl: team.photoUrl ?? null, tagline: team.tagline ?? null,
});

/** Service-side copy of the DTO limits, so non-HTTP callers get the same 400s. */
function assertLengths(dto: UpdateSubjectDto) {
    if (typeof dto.tagline === 'string' && dto.tagline.length > CSI_TAGLINE_MAX) throw new BadRequestException('Tagline maksimal 90 karakter');
    if (typeof dto.jobTitle === 'string' && dto.jobTitle.length > CSI_JOB_TITLE_MAX) throw new BadRequestException('Jabatan maksimal 150 karakter');
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

    /** Edits tagline/jobTitle (person → csi_subject_profiles upsert) or also name (team → csi_teams). */
    async update(scope: ServiceScope, key: string, dto: UpdateSubjectDto): Promise<CsiSubjectView> {
        const ref = parseSubjectKey(key);
        assertLengths(dto);
        const fields = definedOnly({ tagline: nullable(dto.tagline), jobTitle: nullable(dto.jobTitle) });
        if (ref.kind === 'team') {
            const team = await this.findTeam(scope, ref.id);
            return teamView(await this.teams.save({ ...team, ...fields, ...(dto.name !== undefined ? { name: dto.name } : {}) }));
        }
        if (dto.name !== undefined) throw new BadRequestException('Nama hanya bisa diubah untuk tim');
        const user = await this.findPerson(scope, ref.id);
        const profile = await this.profiles.findOne({ where: { scope, userId: user.id } });
        const saved = await this.profiles.save({ ...(profile ?? { scope, userId: user.id, photoUrl: null, tagline: null, jobTitle: null }), ...fields });
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

    private eligibleUsers(scope: ServiceScope): Promise<SubjectUser[]> {
        const roles = agentRolesOf(scope);
        if (!roles.length) return Promise.resolve([]);
        return this.users.find({ where: { isActive: true, role: In(roles) }, select: USER_FIELDS });
    }

    private async findPerson(scope: ServiceScope, userId: string): Promise<SubjectUser> {
        const roles = agentRolesOf(scope);
        const user = roles.length
            ? await this.users.findOne({ where: { id: userId, isActive: true, role: In(roles) }, select: USER_FIELDS })
            : null;
        if (!user) throw new NotFoundException(SUBJECT_NOT_FOUND_MESSAGE);
        return user;
    }

    private async findTeam(scope: ServiceScope, teamId: string): Promise<CsiTeam> {
        const team = await this.teams.findOne({ where: { id: teamId, scope } });
        if (!team) throw new NotFoundException(SUBJECT_NOT_FOUND_MESSAGE);
        return team;
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
