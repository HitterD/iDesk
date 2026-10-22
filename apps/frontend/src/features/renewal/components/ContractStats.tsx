import React from 'react';
import { Files, CircleCheck, Hourglass, CircleX, FilePen } from 'lucide-react';
import type { TicketPillTone } from '@/components/ui/ticket-pill';
import { MgStat } from '@/components/management/MgmtParts';
import { DashboardStats, ContractStatus } from '../types/renewal.types';

interface ContractStatsProps {
    stats: DashboardStats | undefined;
    isLoading: boolean;
    onStatClick?: (status: ContractStatus | '') => void;
    activeStatus?: ContractStatus | '';
}

export const ContractStats: React.FC<ContractStatsProps> = ({
    stats,
    isLoading,
    onStatClick,
    activeStatus = ''
}) => {
    const cards: { key: ContractStatus | ''; label: string; value: number; icon: React.ElementType; tone: TicketPillTone; urgent?: boolean }[] = [
        { key: '', label: 'Total Contracts', value: stats?.total ?? 0, icon: Files, tone: 'neutral' },
        { key: ContractStatus.ACTIVE, label: 'Active', value: stats?.active ?? 0, icon: CircleCheck, tone: 'green' },
        { key: ContractStatus.EXPIRING_SOON, label: 'Expiring Soon', value: stats?.expiringSoon ?? 0, icon: Hourglass, tone: 'amber', urgent: true },
        { key: ContractStatus.EXPIRED, label: 'Expired', value: stats?.expired ?? 0, icon: CircleX, tone: 'red', urgent: true },
        { key: ContractStatus.DRAFT, label: 'Draft', value: stats?.draft ?? 0, icon: FilePen, tone: 'neutral' },
    ];

    return (
        <section className="res-stats is-five" aria-label="Ringkasan kontrak">
            {cards.map((c) => (
                <MgStat key={c.key || 'all'} icon={c.icon} tone={c.tone} label={c.label} value={c.value} isLoading={isLoading}
                    attention={Boolean(c.urgent && c.value > 0)} zero={!c.urgent && c.key !== '' && c.value === 0}
                    active={activeStatus === c.key}
                    onClick={onStatClick ? () => onStatClick(activeStatus === c.key && c.key !== '' ? '' : c.key) : undefined} />
            ))}
        </section>
    );
};
