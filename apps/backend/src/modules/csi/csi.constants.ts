import { BadRequestException } from '@nestjs/common';
import { ServiceScope } from '../../shared/core/utils/service-scope.util';
import { PageKey } from '../../shared/core/types/page-access.types';

export const CSI_SCORE_MIN = 1;
export const CSI_SCORE_MAX = 5;
export const CSI_COMMENT_MAX = 1000;
export const CSI_RESET_REASON_MIN = 5;

export enum CsiRespondentMode {
    OPEN = 'OPEN',
    LISTED = 'LISTED',
}

export const CSI_ADMIN_PAGE_KEY: Record<ServiceScope, PageKey> = {
    ICT: 'csi_admin_ict',
    HC: 'csi_admin_hc',
};

export function parseCsiScope(raw: string): ServiceScope {
    if (raw === 'ict') return ServiceScope.ICT;
    if (raw === 'hc') return ServiceScope.HC;
    throw new BadRequestException('Unit CSI tidak valid.');
}
