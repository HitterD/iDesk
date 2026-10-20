import { UserRole } from '../users/enums/user-role.enum';

/** Roles allowed to work tickets (status, priority, assignment, bulk actions). */
export const TICKET_AGENT_ROLES = [
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.AGENT,
    UserRole.AGENT_ADMIN,
    UserRole.AGENT_OPERATIONAL_SUPPORT,
    UserRole.AGENT_ORACLE,
    UserRole.AGENT_WEB_DEV,
    UserRole.AGENT_MOBILE_DEV,
] as const;
