import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs';
import { In, Repository } from 'typeorm';
import { ROLE_SCOPE, ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { Site } from '../../sites/entities/site.entity';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { CSI_JOB_TITLE_MAX, CSI_TAGLINE_MAX, CSI_TEAM_NAME_MAX, UpdateSubjectDto } from '../dto/subject.dto';
import { CsiRateeKind, CsiTeamKind } from '../csi.constants';
import { CsiAssignmentTemplatePic } from '../entities/csi-assignment-template-pic.entity';
import { CsiAssignmentTemplate } from '../entities/csi-assignment-template.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPic } from '../entities/csi-pic.entity';
import { CsiSubjectProfile } from '../entities/csi-subject-profile.entity';
import { CsiTeamMember } from '../entities/csi-team-member.entity';
import { CsiTeam } from '../entities/csi-team.entity';
import { CsiPicRenameService } from './csi-pic-rename.service';
import { parseSubjectKey, picSubjectKey, teamSubjectKey, userSubjectKey } from './csi-subject-key.util';

/** Public prefix of uploaded CSI photos; only files under it are ever deleted. */
export const CSI_PHOTO_URL_PREFIX = '/uploads/csi/';
const SUBJECT_NOT_FOUND_MESSAGE = 'Subjek tidak ditemukan';
const SITE_NOT_FOUND_MESSAGE = 'Site tidak ditemukan';
const TEAM_NAME_PREFIX = 'Tim ';

export type CsiTeamMemberView = { id: string; name: string; userId: string | null };
export type CsiSubjectView = {
    key: string; kind: 'PERSON' | 'TEAM'; userId: string | null; teamId: string | null; siteId: string;
    name: string; jobTitle: string | null; photoUrl: string | null; tagline: string | null;
    /** Fungsi pelayanan (people only; teams have none). */
    serviceFunction: string | null;
    /** Teams only: SITE (one per site) or CUSTOM (HC, named, with members). */
    teamKind: CsiTeamKind | null;
    /** HC layanan (HCC/HCD/HCS) of a PIC or a custom team. */
    serviceCode: string | null;
    /** HC PIC master (csi_pics) behind a `pic:` subject. */
    picId: string | null;
    /** False for HC PICs without an iDesk account (and for teams). */
    hasAccount: boolean;
    /** Custom teams only. */
    members?: CsiTeamMemberView[];
};
/** `team` is the SITE team (ICT and back-compat); `teams` are the HC custom teams ([] for ICT). */
export type CsiSubjectGroup = {
    siteId: string; siteCode: string; siteName: string; team: CsiSubjectView | null; teams: CsiSubjectView[]; people: CsiSubjectView[];
};

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
    teamKind: null, serviceCode: null, picId: null, hasAccount: true,
});

const byMemberOrder = (a: CsiTeamMember, b: CsiTeamMember) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);

/** `members` is passed for custom teams only, so the SITE team view keeps its former shape. */
export const teamView = (team: CsiTeam, members?: CsiTeamMember[]): CsiSubjectView => ({
    key: teamSubjectKey(team.id), kind: 'TEAM', userId: null, teamId: team.id, siteId: team.siteId, name: team.name,
    jobTitle: team.jobTitle ?? null, photoUrl: team.photoUrl ?? null, tagline: team.tagline ?? null, serviceFunction: null,
    teamKind: team.kind ?? CsiTeamKind.SITE, serviceCode: team.serviceCode ?? null, picId: null, hasAccount: false,
    ...(members ? { members: [...members].sort(byMemberOrder).map(({ id, name, userId }) => ({ id, name, userId: userId ?? null })) } : {}),
});

/**
 * A PIC master: its own photo/tagline first, then the linked account's legacy csi_subject_profiles row (set before the
 * PIC master existed), then the account avatar (a PIC without account can still have a photo).
 */
const picPhoto = (pic: CsiPic, profile: CsiSubjectProfile | undefined, user: SubjectUser | undefined) =>
    pic.photoUrl ?? profile?.photoUrl ?? user?.avatarUrl ?? null;
const picTagline = (pic: CsiPic, profile: CsiSubjectProfile | undefined) => pic.tagline ?? profile?.tagline ?? null;

const picView = (pic: CsiPic, siteId: string, user: SubjectUser | undefined, profile: CsiSubjectProfile | undefined): CsiSubjectView => ({
    key: picSubjectKey(pic.id), kind: 'PERSON', userId: pic.userId ?? null, teamId: null, siteId, name: pic.fullName,
    jobTitle: pic.jobTitle ?? null, photoUrl: picPhoto(pic, profile, user), tagline: picTagline(pic, profile),
    serviceFunction: pic.serviceFunction ?? null, teamKind: null, serviceCode: pic.serviceCode, picId: pic.id, hasAccount: !!pic.userId,
});

/** Sorts people without a layanan (legacy hand-picked members) after the PICs. */
const NO_SERVICE_SORT_KEY = '\uffff';
const byServiceThenName = (a: CsiSubjectView, b: CsiSubjectView) =>
    (a.serviceCode ?? NO_SERVICE_SORT_KEY).localeCompare(b.serviceCode ?? NO_SERVICE_SORT_KEY) || a.name.localeCompare(b.name);

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
const picMaster = (pic: CsiPic, user: SubjectUser | undefined, profile: CsiSubjectProfile | undefined): RateeMaster => ({
    siteId: pic.siteId ?? user?.siteId ?? null,
    photoUrl: picPhoto(pic, profile, user),
    tagline: picTagline(pic, profile),
    jobTitle: pic.jobTitle ?? null,
});

/** Service-side copy of the DTO limits, so non-HTTP callers get the same 400s. */
function assertLengths(dto: UpdateSubjectDto) {
    if (typeof dto.tagline === 'string' && dto.tagline.length > CSI_TAGLINE_MAX) throw new BadRequestException('Tagline maksimal 90 karakter');
    if (typeof dto.jobTitle === 'string' && dto.jobTitle.length > CSI_JOB_TITLE_MAX) throw new BadRequestException('Jabatan maksimal 150 karakter');
    if (typeof dto.serviceFunction === 'string' && dto.serviceFunction.trim().length > CSI_JOB_TITLE_MAX) throw new BadRequestException('Fungsi pelayanan maksimal 150 karakter');
}

/** Team names keep their 100-character limit; PIC names are checked by the rename (2–150). */
function assertTeamName(name: string | undefined) {
    if (name !== undefined && (!name || name.length > CSI_TEAM_NAME_MAX)) {
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
        @InjectRepository(CsiPic) private readonly pics: Repository<CsiPic>,
        @InjectRepository(CsiAssignmentTemplate) private readonly templates: Repository<CsiAssignmentTemplate>,
        @InjectRepository(CsiAssignmentTemplatePic) private readonly templatePics: Repository<CsiAssignmentTemplatePic>,
        @InjectRepository(CsiTeamMember) private readonly members: Repository<CsiTeamMember>,
        private readonly picRename: CsiPicRenameService,
    ) { }

    /**
     * Every active site (by code) with its SITE team (or null). ICT: the scope's active agents whose User.siteId is that
     * site, no custom teams. HC: see `hcList`.
     */
    async list(scope: ServiceScope): Promise<CsiSubjectGroup[]> {
        const sites = (await this.sites.find({ where: { isActive: true } })).sort((a, b) => a.code.localeCompare(b.code));
        if (scope === ServiceScope.HC) return this.hcList(sites);
        const people = await this.eligibleUsers(scope);
        const profiles = people.length ? await this.profiles.find({ where: { scope, userId: In(people.map((user) => user.id)) } }) : [];
        const profileByUser = new Map(profiles.map((profile) => [profile.userId, profile]));
        const teams = await this.teams.find({ where: { scope, kind: CsiTeamKind.SITE } });
        return sites.map((site) => {
            const team = teams.find((row) => row.siteId === site.id);
            return {
                siteId: site.id, siteCode: site.code, siteName: site.name,
                team: team ? teamView(team) : null, teams: [],
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
        const [masters, templateSites] = await Promise.all([
            this.mastersOf(scope, ratees),
            scope === ServiceScope.HC ? this.templateSitesByPic(ratees) : Promise.resolve(new Map<string, string[]>()),
        ]);
        const siteOf = (ratee: CsiPeriodRatee): string | null => {
            const stored = ratee.siteId ?? masters.get(ratee.id)!.siteId;
            if (ratee.kind === CsiRateeKind.TEAM || !ratee.picId) return stored;
            const allowed = templateSites.get(ratee.picId) ?? [];
            if (!allowed.length) return stored;
            // Already-running surveys may carry a stale siteId (e.g. PIC moved from SMG to SKD); keep stored only if a template still lists them there.
            return stored && allowed.includes(stored) ? stored : allowed[0];
        };
        const siteIds = unique(ratees.flatMap((ratee) => {
            const siteId = siteOf(ratee);
            return siteId ? [siteId] : [];
        }));
        const sites = siteIds.length ? await this.sites.find({ where: { id: In(siteIds) } }) : [];
        const codeOf = new Map(sites.map((site) => [site.id, site.code]));
        return new Map(ratees.map((ratee) => {
            const master = masters.get(ratee.id)!;
            const siteId = siteOf(ratee);
            return [ratee.id, {
                siteId, siteCode: siteId ? codeOf.get(siteId) ?? null : null,
                photoUrl: ratee.photoUrl ?? master.photoUrl,
                tagline: ratee.tagline ?? master.tagline,
                jobTitle: master.jobTitle ?? ratee.jobTitle ?? null,
            }];
        }));
    }

    /**
     * Master profile per ratee: team → csi_teams; HC PIC (picId) → csi_pics, photo falling back to the linked account's
     * avatar; other people → csi_subject_profiles over User.
     */
    private async mastersOf(scope: ServiceScope, ratees: CsiPeriodRatee[]): Promise<Map<string, RateeMaster>> {
        const isTeam = (ratee: CsiPeriodRatee) => ratee.kind === CsiRateeKind.TEAM;
        const teamIds = unique(ratees.flatMap((ratee) => (isTeam(ratee) && ratee.teamId ? [ratee.teamId] : [])));
        const picIds = unique(ratees.flatMap((ratee) => (!isTeam(ratee) && ratee.picId ? [ratee.picId] : [])));
        const teams = teamIds.length ? await this.teams.find({ where: { id: In(teamIds) } }) : [];
        const pics = picIds.length ? await this.pics.find({ where: { id: In(picIds) } }) : [];
        const userIds = unique([
            ...ratees.flatMap((ratee) => (!isTeam(ratee) && ratee.userId ? [ratee.userId] : [])),
            ...pics.flatMap((pic) => (pic.userId ? [pic.userId] : [])),
        ]);
        const users = userIds.length ? await this.users.find({ where: { id: In(userIds) }, select: USER_FIELDS }) : [];
        const profiles = userIds.length ? await this.profiles.find({ where: { scope, userId: In(userIds) } }) : [];
        const teamById = new Map(teams.map((team) => [team.id, team]));
        const picById = new Map(pics.map((pic) => [pic.id, pic]));
        const userById = new Map(users.map((user) => [user.id, user]));
        const profileByUser = new Map(profiles.map((profile) => [profile.userId, profile]));
        const userOf = (id: string | null | undefined) => (id ? userById.get(id) : undefined);
        return new Map(ratees.map((ratee): [string, RateeMaster] => {
            if (isTeam(ratee)) return [ratee.id, teamMaster(ratee.teamId ? teamById.get(ratee.teamId) : undefined)];
            const pic = ratee.picId ? picById.get(ratee.picId) : undefined;
            if (pic) {
                const accountId = pic.userId ?? ratee.userId;
                return [ratee.id, picMaster(pic, userOf(accountId), accountId ? profileByUser.get(accountId) : undefined)];
            }
            return [ratee.id, personMaster(userOf(ratee.userId), ratee.userId ? profileByUser.get(ratee.userId) : undefined)];
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
        if (ref.kind === 'pic') return this.updatePic(scope, ref.id, dto, fields);
        if (ref.kind === 'team') {
            if (dto.serviceFunction !== undefined) throw new BadRequestException('Fungsi pelayanan hanya untuk orang');
            assertTeamName(dto.name);
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
            if (ref.kind === 'pic') {
                const pic = await this.findPic(scope, ref.id);
                const saved = await this.pics.save({ ...pic, photoUrl });
                await this.removeOldPhoto(pic.photoUrl);
                return this.picSubject(saved);
            }
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
        const existing = await this.teams.findOne({ where: { scope, siteId, kind: CsiTeamKind.SITE } });
        // A site team deleted while ended surveys still rate it is only deactivated (one SITE row per site): revive it.
        if (existing) return teamView(existing.isActive === false ? await this.teams.save({ ...existing, isActive: true }) : existing);
        const site = await this.sites.findOne({ where: { id: siteId } });
        if (!site) throw new NotFoundException(SITE_NOT_FOUND_MESSAGE);
        const saved = await this.teams.save({
            scope, siteId, kind: CsiTeamKind.SITE, name: `${TEAM_NAME_PREFIX}${site.name}`.slice(0, CSI_TEAM_NAME_MAX),
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

    /**
     * HC per site: the SITE team, the active CUSTOM teams with their members, and as people the active PIC masters
     * linked from the template of that location (template.locationCode = site.code) plus legacy hand-picked members of
     * that site whose account no listed PIC already represents.
     */
    private async hcList(sites: Site[]): Promise<CsiSubjectGroup[]> {
        const scope = ServiceScope.HC;
        const picsBySite = await this.templatePicsBySite(sites);
        const allPics = [...picsBySite.values()].flat();
        const legacy = (await this.eligibleUsers(scope)).filter((user) => !allPics.some((pic) => pic.userId === user.id));
        const accountIds = unique(allPics.flatMap((pic) => (pic.userId ? [pic.userId] : [])));
        // Legacy members plus PIC accounts: a PIC falls back to its account's old profile photo/tagline.
        const profileIds = unique([...legacy.map((user) => user.id), ...accountIds]);
        const profiles = profileIds.length ? await this.profiles.find({ where: { scope, userId: In(profileIds) } }) : [];
        const profileByUser = new Map(profiles.map((profile) => [profile.userId, profile]));
        const accounts = accountIds.length ? await this.users.find({ where: { id: In(accountIds) }, select: USER_FIELDS }) : [];
        const accountById = new Map(accounts.map((user) => [user.id, user]));
        const teams = (await this.teams.find({ where: { scope } })).filter((team) => team.isActive);
        const customIds = teams.filter((team) => team.kind === CsiTeamKind.CUSTOM).map((team) => team.id);
        const members = customIds.length ? await this.members.find({ where: { teamId: In(customIds) } }) : [];
        return sites.map((site) => {
            const siteTeam = teams.find((team) => team.siteId === site.id && team.kind !== CsiTeamKind.CUSTOM);
            const people = [
                ...(picsBySite.get(site.id) ?? []).map((pic) => picView(pic, site.id,
                    pic.userId ? accountById.get(pic.userId) : undefined, pic.userId ? profileByUser.get(pic.userId) : undefined)),
                ...legacy.filter((user) => user.siteId === site.id).map((user) => personView(user, profileByUser.get(user.id))),
            ];
            return {
                siteId: site.id, siteCode: site.code, siteName: site.name, team: siteTeam ? teamView(siteTeam) : null,
                teams: teams.filter((team) => team.siteId === site.id && team.kind === CsiTeamKind.CUSTOM)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((team) => teamView(team, members.filter((member) => member.teamId === team.id))),
                people: people.sort(byServiceThenName),
            };
        });
    }

    /** Active HC PIC masters linked from each site's template rows (team rows and unlinked names are skipped). */
    private async templatePicsBySite(sites: Site[]): Promise<Map<string, CsiPic[]>> {
        const scope = ServiceScope.HC;
        const templates = sites.length ? await this.templates.find({ where: { scope, locationCode: In(sites.map((site) => site.code)) } }) : [];
        const rows = templates.length ? await this.templatePics.find({ where: { templateId: In(templates.map((template) => template.id)) } }) : [];
        const picIds = unique(rows.flatMap((row) => (row.picId ? [row.picId] : [])));
        const pics = picIds.length ? await this.pics.find({ where: { scope, id: In(picIds), isActive: true } }) : [];
        const picById = new Map(pics.map((pic) => [pic.id, pic]));
        return new Map(sites.map((site): [string, CsiPic[]] => {
            const templateIds = new Set(templates.filter((template) => template.locationCode === site.code).map((template) => template.id));
            const ids = unique(rows.flatMap((row) => (templateIds.has(row.templateId) && row.picId ? [row.picId] : [])));
            return [site.id, ids.flatMap((id) => { const pic = picById.get(id); return pic ? [pic] : []; })];
        }));
    }

    /** Sorted template site ids (`picId -> siteId[]`) so running surveys follow template moves when `ratee.siteId` is stale. */
    private async templateSitesByPic(ratees: CsiPeriodRatee[]): Promise<Map<string, string[]>> {
        const picIds = unique(ratees.flatMap((ratee) => (ratee.kind !== CsiRateeKind.TEAM && ratee.picId ? [ratee.picId] : [])));
        if (!picIds.length) return new Map();
        const rows = await this.templatePics.find({ where: { picId: In(picIds) } });
        const templateIds = unique(rows.map((row) => row.templateId));
        if (!templateIds.length) return new Map();
        const templates = await this.templates.find({ where: { scope: ServiceScope.HC, id: In(templateIds) } });
        const codes = unique(templates.map((template) => template.locationCode));
        const sites = codes.length ? await this.sites.find({ where: { code: In(codes) } }) : [];
        const siteByCode = new Map(sites.map((site) => [site.code, site.id]));
        const entryOf = new Map(templates.flatMap((template) => {
            const siteId = siteByCode.get(template.locationCode);
            return siteId ? [[template.id, { siteId, code: template.locationCode }] as const] : [];
        }));
        return new Map(picIds.map((picId) => {
            const entries = rows.filter((row) => row.picId === picId)
                .flatMap((row) => { const entry = entryOf.get(row.templateId); return entry ? [entry] : []; })
                .sort((a, b) => a.code.localeCompare(b.code));
            return [picId, unique(entries.map((entry) => entry.siteId))];
        }));
    }

    /**
     * Tagline / jabatan of an HC PIC live on csi_pics (no account needed); fungsi comes from the PIC master. A name is
     * the same rename as PIC HC (master, template rows, draft surveys).
     */
    private async updatePic(scope: ServiceScope, picId: string, dto: UpdateSubjectDto,
        fields: Partial<{ tagline: string | null; jobTitle: string | null }>): Promise<CsiSubjectView> {
        if (dto.serviceFunction !== undefined) throw new BadRequestException('Fungsi pelayanan PIC diatur di master PIC HC');
        await this.findPic(scope, picId);
        if (dto.name !== undefined) await this.picRename.rename(scope, picId, dto.name);
        const pic = await this.findPic(scope, picId);
        return this.picSubject(await this.pics.save({ ...pic, ...fields }));
    }

    private async findPic(scope: ServiceScope, picId: string): Promise<CsiPic> {
        const pic = await this.pics.findOne({ where: { id: picId, scope } });
        if (!pic) throw new NotFoundException(SUBJECT_NOT_FOUND_MESSAGE);
        return pic;
    }

    private async picSubject(pic: CsiPic): Promise<CsiSubjectView> {
        const user = pic.userId ? await this.users.findOne({ where: { id: pic.userId }, select: USER_FIELDS }) : null;
        const profile = pic.userId ? await this.profiles.findOne({ where: { scope: pic.scope, userId: pic.userId } }) : null;
        return picView(pic, pic.siteId ?? user?.siteId ?? '', user ?? undefined, profile ?? undefined);
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
