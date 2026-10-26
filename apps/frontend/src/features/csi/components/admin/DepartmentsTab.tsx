import { useState } from 'react';
import {
    useCreateCsiDepartment, useCsiDepartments, useDeactivateCsiDepartment, useUpdateCsiDepartment,
} from '../../hooks/useCsi';
import type { CsiScopeParam } from '../../types';
import { MasterList } from './MasterList';

export function DepartmentsTab({ scope, compact }: { scope: CsiScopeParam; compact?: boolean }) {
    const [showInactive, setShowInactive] = useState(false);
    const list = useCsiDepartments(scope, showInactive);
    const create = useCreateCsiDepartment(scope);
    const update = useUpdateCsiDepartment(scope);
    const deactivate = useDeactivateCsiDepartment(scope);
    return (
        <MasterList noun="departemen" items={list.data} isLoading={list.isLoading} isError={list.isError}
            onRetry={() => list.refetch()} compact={compact} showInactive={showInactive} onShowInactiveChange={setShowInactive}
            pending={create.isPending || update.isPending || deactivate.isPending}
            onCreate={(payload, done) => create.mutate(payload, { onSuccess: done })}
            onUpdate={(id, payload, done) => update.mutate({ id, payload }, { onSuccess: done })}
            onDeactivate={(id, done) => deactivate.mutate(id, { onSuccess: done })} />
    );
}
