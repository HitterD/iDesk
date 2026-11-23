import { EFormType } from '../../eform-request/entities/eform-request.entity';
import type { RequestKind } from './request-kind';

export type ApprovalRoute = 'NONE' | 'MANAGER' | 'MANAGER_GM';

export function defaultRoute(kind: RequestKind, eformType?: EFormType): ApprovalRoute {
    if (kind === 'EFORM') {
        if (eformType === EFormType.VPN) return 'MANAGER_GM';
        if (eformType === EFormType.SYNOLOGY_NAS) return 'NONE';
    }
    return 'MANAGER';
}

export function canChangeRoute(
    from: ApprovalRoute,
    to: ApprovalRoute,
    signed: { manager: boolean; gm: boolean },
): boolean {
    // Setting the same route again (e.g. after a GM returned the request) changes nothing, so it is always allowed.
    if (from === to) return true;
    if (!signed.manager && !signed.gm) return true;
    return from === 'MANAGER' && to === 'MANAGER_GM';
}
