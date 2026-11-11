import { BadRequestException } from '@nestjs/common';
import { ServiceScope } from '../../shared/core/utils/service-scope.util';
import { PageKey } from '../../shared/core/types/page-access.types';

export const CSI_SCORE_MIN = 1;
export const CSI_SCORE_MAX = 5;
export const CSI_COMMENT_MAX = 1000;
export const CSI_ANSWER_TEXT_MAX = 1000;
/** Answers per submission: room for every HC PIC (73 x 5 dimensions = 365) with margin. */
export const CSI_ITEMS_MAX = 500;
export const CSI_RESPONDENT_NAME_MIN = 2;
export const CSI_RESPONDENT_NAME_MAX = 150;
export const CSI_RESET_REASON_MIN = 5;
export const CSI_OPTIONS_MIN = 2;
export const CSI_OPTIONS_MAX = 10;
export const CSI_OPTION_LABEL_MAX = 200;
export const CSI_TEAM_LABEL_DEFAULT = 'Tim IT Support';
export const CSI_SLA_TARGET_DEFAULT = 80;
/** New HC surveys aim higher; ICT keeps CSI_SLA_TARGET_DEFAULT. */
export const CSI_SLA_TARGET_DEFAULT_HC = 90;
/** Score colour bands: < fair red, fair..good orange, >= good green (legacy surveys keep these). */
export const CSI_SCORE_FAIR_MIN_DEFAULT = 4.0;
export const CSI_SCORE_GOOD_MIN_DEFAULT = 4.5;
/** A person or team is ranked in the report only from this many raters on (fewer = "Belum cukup penilai"). */
export const CSI_RANK_MIN_RATERS = 5;
/** Respondent/rater groups smaller than this are merged in reports, so nobody can be singled out. */
export const CSI_ANON_MIN_GROUP = 3;
/** Row that holds every merged small group (CSI_ANON_MIN_GROUP). */
export const CSI_SMALL_GROUP_LABEL = 'Departemen kecil (gabungan)';
/** Survey titles starting with this prefix are simulations: the report PDF carries CSI_SIMULATION_BANNER on every page. */
export const CSI_SIMULATION_TITLE_PREFIX = 'SIMULASI – ';
/** Simulation survey: kept out of real comparisons (previous period, dashboard trend and lists). */
export const isSimulation = (period: { title?: string | null }) => (period.title ?? '').startsWith(CSI_SIMULATION_TITLE_PREFIX);
export const CSI_SIMULATION_BANNER ='SIMULASI — data jawaban fiktif, bukan hasil survei sebenarnya';

/** Question kinds; only STAR and SCALE carry a 1–5 score. */
export enum CsiQuestionType {
    STAR = 'STAR',
    SCALE = 'SCALE',
    CHOICE = 'CHOICE',
    TEXT = 'TEXT',
}

export type CsiOption = { label: string; points: number | null };

/** SITE preserves the existing per-site team; CUSTOM allows additional named teams. */
export enum CsiTeamKind {
    SITE = 'SITE',
    CUSTOM = 'CUSTOM',
}

export enum CsiRateeKind {
    PERSON = 'PERSON',
    TEAM = 'TEAM',
}

export enum CsiRespondentMode {
    OPEN = 'OPEN',
    LISTED = 'LISTED',
}

/** Admin-controlled visibility, independent of the date-based time status (UPCOMING/ACTIVE/ENDED). */
export enum CsiPeriodPublishStatus {
    DRAFT = 'DRAFT',
    PUBLISHED = 'PUBLISHED',
    /** Stopped by an admin: hidden from respondents, dashboards and clash checks; answers and report are kept. */
    CANCELLED = 'CANCELLED',
}
export enum CsiPairMode {
    ALL = 'ALL',
    CUSTOM = 'CUSTOM',
}
export const CSI_CANCEL_REASON_MIN = 5;
export const CSI_CANCEL_REASON_MAX = 500;

export const CSI_ADMIN_PAGE_KEY: Record<ServiceScope, PageKey> = {
    ICT: 'csi_admin_ict',
    HC: 'csi_admin_hc',
};

export function parseCsiScope(raw: string): ServiceScope {
    if (raw === 'ict') return ServiceScope.ICT;
    if (raw === 'hc') return ServiceScope.HC;
    throw new BadRequestException('Unit CSI tidak valid.');
}
