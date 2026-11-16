import { EventEmitter2 } from '@nestjs/event-emitter';
import { ServiceScope } from '../../shared/core/utils/service-scope.util';

export const CSI_UPDATED_EVENT = 'csi.period.updated';
export type CsiUpdatedEvent = { scope: ServiceScope; periodId?: string };

/** Notifies subscribed CSI admin dashboards/progress views that live survey data changed. */
export function emitCsiUpdated(emitter: EventEmitter2 | undefined, scope: ServiceScope, periodId?: string): void {
    emitter?.emit(CSI_UPDATED_EVENT, { scope, ...(periodId ? { periodId } : {}) } satisfies CsiUpdatedEvent);
}
