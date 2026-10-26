import { useState } from 'react';
import { SegmentedControl } from '@/components/ui/segmented-control';
import type { CsiScopeParam } from '../../types';
import { DepartmentsTab } from './DepartmentsTab';
import { DimensionsTab } from './DimensionsTab';
import { RatersTab } from './RatersTab';

type MasterTab = 'dimensions' | 'departments' | 'raters';
const MASTER_TABS = [
    { value: 'dimensions', label: 'Dimensi' },
    { value: 'departments', label: 'Departemen' },
    { value: 'raters', label: 'Penilai' },
] as const;

function MasterBody({ scope, tab }: { scope: CsiScopeParam; tab: MasterTab }) {
    switch (tab) {
        case 'departments': return <DepartmentsTab scope={scope} />;
        case 'raters': return <RatersTab scope={scope} />;
        default: return <DimensionsTab scope={scope} />;
    }
}

/** Secondary area: shared dimensions, departments, and registered raters. */
export function MasterDataPanel({ scope }: { scope: CsiScopeParam }) {
    const [tab, setTab] = useState<MasterTab>('dimensions');
    return (
        <div className="grid gap-4">
            <SegmentedControl aria-label="Jenis master data" className="dash-seg w-fit" options={MASTER_TABS} value={tab} onValueChange={setTab} />
            <MasterBody scope={scope} tab={tab} />
        </div>
    );
}
