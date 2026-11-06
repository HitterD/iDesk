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

/** Question kinds; only STAR and SCALE carry a 1–5 score. */
export enum CsiQuestionType {
    STAR = 'STAR',
    SCALE = 'SCALE',
    CHOICE = 'CHOICE',
    TEXT = 'TEXT',
}

export type CsiOption = { label: string; points: number | null };

/** A TEAM ratee is the single "Penilaian tim" section of a period (no user). */
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
