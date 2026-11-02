import { UserRole } from '../users/enums/user-role.enum';

/**
 * Single source of truth for "IT" on E-Form requests.
 *
 * These roles provision access: they reject requests, fulfil folder-only
 * requests, and submit credentials. Previously three separate lists disagreed
 * on who counts as ICT (service, expiration cron, frontend), which left
 * AGENT_OPERATIONAL_SUPPORT receiving provisioning notifications for requests
 * it had no permission to act on.
 *
 * Site isolation still applies on top of this: only ADMIN is cross-site.
 */
export const ICT_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.AGENT_ADMIN,
  UserRole.AGENT_OPERATIONAL_SUPPORT,
];

/**
 * Who may read stored credentials — ICT plus MANAGER, whose oversight access
 * predates this constant and is preserved deliberately.
 */
export const CREDENTIAL_READER_ROLES: UserRole[] = [...ICT_ROLES, UserRole.MANAGER];

/**
 * Who may propose access from an IT support ticket: ICT plus the ticket's IT support agents. A proposal is only a
 * draft; the requester still completes, signs and submits it, and approval runs as usual.
 */
export const EFORM_PROPOSER_ROLES: UserRole[] = [...ICT_ROLES, UserRole.AGENT];

/**
 * Who may list every request (to follow where each one is). Matches who may open a single request in
 * getDetails; site isolation still applies, so only ADMIN and MANAGER see other sites.
 */
export const EFORM_MONITOR_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.AGENT_ADMIN,
  UserRole.AGENT,
  UserRole.AGENT_OPERATIONAL_SUPPORT,
  UserRole.AGENT_ORACLE,
  UserRole.AGENT_WEB_DEV,
  UserRole.AGENT_MOBILE_DEV,
];

/** Form types that skip manager approval and go straight to IT. */
export const DIRECT_TO_ICT_FORM_TYPES = ['SYNOLOGY_NAS'] as const;

/** Form types that need the GM after the manager unless ICT says otherwise; others go from the manager to IT. */
export const GM_DEFAULT_FORM_TYPES = ['VPN'] as const;

export const needsGmByDefault = (formType: string): boolean =>
  (GM_DEFAULT_FORM_TYPES as readonly string[]).includes(formType);

/** Synology sub-mode: does the requester already have a Synology account? */
export enum SynologyAccountStatus {
  /** No account yet — IT creates the account and issues credentials. */
  NEW_ACCOUNT = 'NEW_ACCOUNT',
  /** Account exists — IT only grants extra shared folders, no credentials issued. */
  EXISTING_ACCOUNT = 'EXISTING_ACCOUNT',
}
