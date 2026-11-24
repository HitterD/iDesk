import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { isOrgCsiScope } from '../csi.constants';
import { CsiPeriod } from '../entities/csi-period.entity';

export function assertPeriodInScope(period: CsiPeriod | null, scope: ServiceScope): CsiPeriod {
    if (!period || period.scope !== scope) {
        throw new NotFoundException('Periode tidak ditemukan');
    }
    return period;
}

/** Org-CSI-only features (service report owners, assignment templates, custom teams): ICT is refused with 400. */
export function assertHcScope(scope: ServiceScope): ServiceScope {
    if (!isOrgCsiScope(scope)) throw new BadRequestException('Fitur ini hanya untuk CSI HC atau Procurement');
    return scope;
}

export const assertOrgCsiScope = assertHcScope;
