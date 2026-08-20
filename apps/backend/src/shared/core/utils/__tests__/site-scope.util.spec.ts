import { UserRole } from '../../../../modules/users/enums/user-role.enum';
import {
  resolveSiteScope,
  assertSiteAccess,
  scopeKey,
  isCrossSiteRole,
  CROSS_SITE_ROLES,
  TICKET_CROSS_SITE_ROLES,
} from '../site-scope.util';
import { ForbiddenException } from '@nestjs/common';

describe('site-scope.util', () => {
  const ADMIN = { role: UserRole.ADMIN, siteId: null };
  const MANAGER = { role: UserRole.MANAGER, siteId: 's1' };
  const AGENT_SPJ = { role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: 'spj' };
  const AGENT_NULL = { role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: null };
  const AGENT_ORACLE = { role: UserRole.AGENT_ORACLE, siteId: 'spj' };

  it('ADMIN and MANAGER are cross-site', () => {
    expect(isCrossSiteRole(UserRole.ADMIN)).toBe(true);
    expect(isCrossSiteRole(UserRole.MANAGER)).toBe(true);
    expect(resolveSiteScope(ADMIN).mode).toBe('all');
    expect(resolveSiteScope(MANAGER).mode).toBe('all');
  });

  it('TICKET_CROSS_SITE_ROLES includes AGENT_ORACLE but general CROSS_SITE_ROLES does not', () => {
    expect(TICKET_CROSS_SITE_ROLES).toContain(UserRole.AGENT_ORACLE);
    expect(CROSS_SITE_ROLES).not.toContain(UserRole.AGENT_ORACLE);
  });

  it('site-locked with site pins to that site', () => {
    expect(resolveSiteScope(AGENT_SPJ)).toEqual({ mode: 'site', siteId: 'spj' });
  });

  it('site-locked without site → none (fail-closed)', () => {
    expect(resolveSiteScope(AGENT_NULL)).toEqual({ mode: 'none' });
  });

  it('AGENT_ORACLE is cross-site only in ticket context', () => {
    // In general modules, AGENT_ORACLE should be treated as site-locked
    // (the ticketing util will use the ticket-specific list)
    expect(isCrossSiteRole(UserRole.AGENT_ORACLE)).toBe(false);
  });

  it('assertSiteAccess throws for cross-site violation by site-locked role', () => {
    expect(() => assertSiteAccess(AGENT_SPJ, 'smg')).toThrow(ForbiddenException);
  });

  it('assertSiteAccess allows when site matches', () => {
    assertSiteAccess(AGENT_SPJ, 'spj'); // should not throw
  });

  it('assertSiteAccess allows cross-site roles to any site', () => {
    assertSiteAccess(ADMIN, 'anything');
    assertSiteAccess(MANAGER, 'smg');
  });

  it('assertSiteAccess throws for none scope', () => {
    expect(() => assertSiteAccess(AGENT_NULL, 'spj')).toThrow(ForbiddenException);
  });

  it('scopeKey produces stable fragments for cache keys', () => {
    expect(scopeKey(ADMIN)).toBe('all');
    expect(scopeKey(AGENT_NULL)).toBe('none');
    expect(scopeKey(AGENT_SPJ)).toBe('spj');
    expect(scopeKey(MANAGER)).toBe('all');
  });
});
