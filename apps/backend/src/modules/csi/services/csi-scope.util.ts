import { NotFoundException } from '@nestjs/common';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiPeriod } from '../entities/csi-period.entity';

export function assertPeriodInScope(period: CsiPeriod | null, scope: ServiceScope): CsiPeriod {
    if (!period || period.scope !== scope) {
        throw new NotFoundException('Periode tidak ditemukan');
    }
    return period;
}
