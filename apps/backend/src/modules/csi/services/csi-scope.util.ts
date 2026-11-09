import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiPeriod } from '../entities/csi-period.entity';

export function assertPeriodInScope(period: CsiPeriod | null, scope: ServiceScope): CsiPeriod {
    if (!period || period.scope !== scope) {
        throw new NotFoundException('Periode tidak ditemukan');
    }
    return period;
}

/** HC-only features (service report owners, assignment templates): any other scope is a 400. */
export function assertHcScope(scope: ServiceScope): ServiceScope {
    if (scope !== ServiceScope.HC) throw new BadRequestException('Fitur ini hanya untuk CSI HC');
    return scope;
}
