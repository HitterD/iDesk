export enum UserRole {
    ADMIN = 'ADMIN',
    AGENT = 'AGENT', // Deprecated, but keeping for backward compatibility if needed, though we should migrate it
    AGENT_OPERATIONAL_SUPPORT = 'AGENT_OPERATIONAL_SUPPORT',
    AGENT_ORACLE = 'AGENT_ORACLE',
    AGENT_ADMIN = 'AGENT_ADMIN',
    USER = 'USER',
    MANAGER = 'MANAGER',
}
