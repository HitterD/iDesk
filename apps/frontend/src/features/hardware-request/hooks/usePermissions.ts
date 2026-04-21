import { useAuth } from '@/stores/useAuth';
import type { HardwareRole } from '../types';

const ICT_TOKENS = new Set([
    'ADMIN', 'MANAGER', 'AGENT',
    'ICT_LEAD', 'ICT_MANAGER', 'ICT_PROCUREMENT', 'ICT_TECHNICIAN', 'ICT_STAFF',
    'PROCUREMENT', 'TECHNICIAN',
    'AGENT_OPERATIONAL_SUPPORT', 'AGENT_ADMIN',
]);

export function useHardwareRole(): { userId: string; role: HardwareRole } {
    const { user } = useAuth();
    const systemRole = (user?.role ?? '').toUpperCase();
    const role: HardwareRole = ICT_TOKENS.has(systemRole) ? 'ICT_STAFF' : 'USER';
    return { userId: user?.id ?? '', role };
}

export function usePermissions() {
    const { role } = useHardwareRole();
    return {
        isIctRole:  role !== 'USER',
        isIctStaff: role === 'ICT_STAFF',
        isIctLead:  role === 'ICT_STAFF',
        isUser:     role === 'USER',
    };
}
