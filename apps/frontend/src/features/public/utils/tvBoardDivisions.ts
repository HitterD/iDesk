import type React from 'react';
import { Database, Globe, Headphones, Smartphone } from 'lucide-react';
import type { TvBoardCard } from '../hooks/useTvBoardSocket';

export type DivisionKey = 'OPS_SUPPORT' | 'ORACLE_DEV' | 'WEB_DEV' | 'MOBILE_DEV';

export interface DivisionConfig {
    key: DivisionKey;
    label: string;
    shortLabel: string;
    icon: React.ElementType;
    /** Apple system color, readable on the light TV background */
    color: string;
}

export const DIVISION_ORDER: DivisionKey[] = ['OPS_SUPPORT', 'ORACLE_DEV', 'WEB_DEV', 'MOBILE_DEV'];

export const DIVISION_CONFIGS: Record<DivisionKey, DivisionConfig> = {
    OPS_SUPPORT: {
        key: 'OPS_SUPPORT',
        label: 'IT Support',
        shortLabel: 'IT Support',
        icon: Headphones,
        color: '#007AFF',
    },
    ORACLE_DEV: {
        key: 'ORACLE_DEV',
        label: 'Oracle / K2',
        shortLabel: 'Oracle K2',
        icon: Database,
        color: '#FF9500',
    },
    WEB_DEV: {
        key: 'WEB_DEV',
        label: 'Web Developer',
        shortLabel: 'Web Dev',
        icon: Globe,
        color: '#34C759',
    },
    MOBILE_DEV: {
        key: 'MOBILE_DEV',
        label: 'Mobile Developer',
        shortLabel: 'Mobile Dev',
        icon: Smartphone,
        color: '#AF52DE',
    },
};

export function isHardwareCard(card: TvBoardCard): boolean {
    return (card.category || '').toLowerCase().includes('hardware') || (card.ticketType || '').toLowerCase().includes('hardware');
}

export function resolveCardDivision(card: TvBoardCard): DivisionKey {
    const team = card.handlingTeam?.toUpperCase();
    if (team === 'ORACLE_DEV' || card.isOracleRequest) return 'ORACLE_DEV';
    if (team === 'WEB_DEV') return 'WEB_DEV';
    if (team === 'MOBILE_DEV') return 'MOBILE_DEV';

    const cat = (card.category || '').toLowerCase();
    const type = (card.ticketType || '').toLowerCase();

    if (cat.includes('oracle') || cat.includes('k2') || type.includes('oracle')) return 'ORACLE_DEV';
    if (cat.includes('web') || cat.includes('api') || type.includes('web')) return 'WEB_DEV';
    if (cat.includes('mobile') || cat.includes('android') || cat.includes('ios') || type.includes('mobile')) return 'MOBILE_DEV';

    return 'OPS_SUPPORT';
}
