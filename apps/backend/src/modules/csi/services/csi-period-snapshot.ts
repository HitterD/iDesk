/**
 * Snapshots written into csi_period_ratees / csi_period_ratee_dimensions when a survey is built or copied. Split from
 * csi-period.service so the service stays below the file-size limit; behaviour is unchanged.
 */
import { CsiRateeKind } from '../csi.constants';
import { User } from '../../users/entities/user.entity';
import { CsiDimension } from '../entities/csi-dimension.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPic } from '../entities/csi-pic.entity';

/** Sort order of the SITE team ratee: before every person. */
export const TEAM_SORT_ORDER = -1;

/** Question definition copied onto a ratee at assignment time (name, shortLabel, type/required/options). */
export type QuestionSnapshot = Pick<CsiDimension, 'id' | 'name' | 'shortLabel' | 'type' | 'required' | 'options'>;
export type RateeSnapshot = {
    kind: CsiRateeKind; userId: string | null; displayName: string; jobTitle: string | null;
    /** PERSON: User.siteId at snapshot time; TEAM: the team's site. */
    siteId: string | null; teamId: string | null;
    /** Per-period overrides; always null in a snapshot (master values are resolved on read). */
    photoUrl: null; tagline: null;
    /** HC PIC ratee: the PIC and its layanan / bagian. */
    picId?: string | null; serviceCode?: string | null; bagian?: string | null; serviceFunction?: string | null;
    /** Explicit order (TEAM = -1); absent means the index in the written list. */
    sortOrder?: number; dimensions: QuestionSnapshot[];
};

export const questionSnapshot = ({ id, name, shortLabel, type, required, options }: CsiDimension): QuestionSnapshot =>
    ({ id, name, shortLabel: shortLabel ?? null, type, required, options });

export const dimensionRow = (periodRateeId: string, question: QuestionSnapshot, sortOrder: number) => ({
    periodRateeId, dimensionId: question.id, dimensionName: question.name, shortLabel: question.shortLabel ?? null,
    type: question.type, required: question.required, options: question.options, sortOrder,
});

export type ServiceSnapshots = Map<string, { serviceCode: string | null; serviceFunction: string | null }>;

export function toSnapshot(user: User, dimensions: CsiDimension[], services: ServiceSnapshots = new Map()): RateeSnapshot {
    const service = services.get(user.id);
    return {
        kind: CsiRateeKind.PERSON, userId: user.id, displayName: user.fullName, jobTitle: user.jobTitle ?? null,
        siteId: user.siteId ?? null, teamId: null, photoUrl: null, tagline: null,
        serviceCode: service?.serviceCode ?? null, serviceFunction: service?.serviceFunction ?? null,
        dimensions: dimensions.map(questionSnapshot),
    };
}

export function picSnapshot(pic: CsiPic, dimensions: CsiDimension[]): RateeSnapshot {
    return {
        kind: CsiRateeKind.PERSON, userId: pic.userId, displayName: pic.fullName, jobTitle: pic.jobTitle,
        siteId: pic.siteId, teamId: null, photoUrl: null, tagline: null,
        picId: pic.id, serviceCode: pic.serviceCode, bagian: pic.bagian, serviceFunction: pic.serviceFunction ?? null,
        dimensions: dimensions.map(questionSnapshot),
    };
}

export function teamSnapshot(team: { teamId: string | null; name: string; siteId: string }, dimensions: CsiDimension[]): RateeSnapshot {
    return {
        kind: CsiRateeKind.TEAM, userId: null, displayName: team.name, jobTitle: null, sortOrder: TEAM_SORT_ORDER,
        siteId: team.siteId, teamId: team.teamId, photoUrl: null, tagline: null,
        dimensions: dimensions.map(questionSnapshot),
    };
}

/** Custom team ratee copied as-is: same team (named after its master), service snapshot kept, overrides dropped. */
export function customTeamSnapshot(source: CsiPeriodRatee & { siteId: string }, dimensions: CsiDimension[]): RateeSnapshot {
    return {
        kind: CsiRateeKind.TEAM, userId: null, displayName: source.team?.name ?? source.displayName, jobTitle: null,
        siteId: source.siteId, teamId: source.teamId, photoUrl: null, tagline: null,
        serviceCode: source.serviceCode ?? null, bagian: null, serviceFunction: source.serviceFunction ?? null,
        dimensions: dimensions.map(questionSnapshot),
    };
}
