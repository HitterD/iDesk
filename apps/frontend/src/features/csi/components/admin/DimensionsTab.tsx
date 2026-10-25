import { useState } from 'react';
import {
    useCreateCsiDimension, useCsiDimensions, useDeactivateCsiDimension, useUpdateCsiDimension,
} from '../../hooks/useCsi';
import type { CsiScopeParam } from '../../types';
import { MasterList } from './MasterList';

export function DimensionsTab({ scope }: { scope: CsiScopeParam }) {
    const [showInactive, setShowInactive] = useState(false);
    const list = useCsiDimensions(scope, showInactive);
    const create = useCreateCsiDimension(scope);
    const update = useUpdateCsiDimension(scope);
    const deactivate = useDeactivateCsiDimension(scope);
    return (
        <MasterList noun="dimensi" withDescription items={list.data} isLoading={list.isLoading} isError={list.isError}
            onRetry={() => list.refetch()} showInactive={showInactive} onShowInactiveChange={setShowInactive}
            pending={create.isPending || update.isPending || deactivate.isPending}
            onCreate={(payload, done) => create.mutate(payload, { onSuccess: done })}
            onUpdate={(id, payload, done) => update.mutate({ id, payload }, { onSuccess: done })}
            onDeactivate={(id, done) => deactivate.mutate(id, { onSuccess: done })} />
    );
}
