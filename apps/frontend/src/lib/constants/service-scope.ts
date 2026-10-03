/**
 * Department that services tickets — the "handler" side (ICT today, HC later).
 * Not the same as a user's `department`, which is the requester's HRIS unit.
 * Mirrors backend `shared/core/utils/service-scope.util.ts`; the backend is
 * the authority, this copy only drives labels and grouping in the UI.
 */
export const SERVICE_SCOPES = ['ICT', 'HC'] as const;

export type ServiceScope = (typeof SERVICE_SCOPES)[number];

export const DEFAULT_SERVICE_SCOPE: ServiceScope = 'ICT';

export const SERVICE_SCOPE_LABELS: Readonly<Record<ServiceScope, string>> = {
  ICT: 'ICT',
  HC: 'HC (Human Capital)',
};

/** ADMIN is absent on purpose (cross-scope); USER is a requester with no scope. */
export const ROLE_SCOPE: Readonly<Partial<Record<string, ServiceScope>>> = {
  AGENT: 'ICT',
  AGENT_OPERATIONAL_SUPPORT: 'ICT',
  AGENT_ADMIN: 'ICT',
  AGENT_ORACLE: 'ICT',
  AGENT_WEB_DEV: 'ICT',
  AGENT_MOBILE_DEV: 'ICT',
  MANAGER: 'ICT',
};

export const scopeOfRole = (role?: string | null): ServiceScope | null =>
  (role && ROLE_SCOPE[role]) || null;

export interface RoleScopeGroup<R extends string> {
  scope: ServiceScope | null;
  roles: R[];
}

/** Splits an ordered role list into consecutive runs sharing the same scope. */
export function groupRolesByScope<R extends string>(roles: readonly R[]): RoleScopeGroup<R>[] {
  const groups: RoleScopeGroup<R>[] = [];
  for (const role of roles) {
    const scope = scopeOfRole(role);
    const last = groups[groups.length - 1];
    if (last && last.scope === scope) {
      last.roles.push(role);
    } else {
      groups.push({ scope, roles: [role] });
    }
  }
  return groups;
}
