import { ForbiddenException } from '@nestjs/common';
import { HandlingTeam } from '../../ticketing/entities/ticket.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import {
  ALL_DEV_TEAM,
  applyTeamFilter,
  resolveReportScope,
  rolesForTeam,
  teamForRole,
  teamLabel,
} from './report-team-scope.util';

const SITE_SPJ = 'site-spj';
const SITE_SMG = 'site-smg';

describe('report-team-scope.util', () => {
  describe('teamForRole', () => {
    it.each([
      [UserRole.AGENT, HandlingTeam.OPS_SUPPORT],
      [UserRole.AGENT_ADMIN, HandlingTeam.OPS_SUPPORT],
      [UserRole.AGENT_OPERATIONAL_SUPPORT, HandlingTeam.OPS_SUPPORT],
      [UserRole.AGENT_ORACLE, HandlingTeam.ORACLE_DEV],
      [UserRole.AGENT_WEB_DEV, HandlingTeam.WEB_DEV],
      [UserRole.AGENT_MOBILE_DEV, HandlingTeam.MOBILE_DEV],
    ])('locks %s to %s', (role, team) => {
      expect(teamForRole(role)).toBe(team);
    });

    it('leaves ADMIN/MANAGER free to choose', () => {
      expect(teamForRole(UserRole.ADMIN)).toBeUndefined();
      expect(teamForRole(UserRole.MANAGER)).toBeUndefined();
    });

    it('gives USER no team', () => {
      expect(teamForRole(UserRole.USER)).toBeNull();
    });
  });

  describe('resolveReportScope', () => {
    it('lets a manager pick any team and site', () => {
      expect(resolveReportScope({ role: UserRole.MANAGER, siteId: null }, HandlingTeam.WEB_DEV, SITE_SMG))
        .toEqual({ team: HandlingTeam.WEB_DEV, siteId: SITE_SMG });
      expect(resolveReportScope({ role: UserRole.ADMIN, siteId: null }))
        .toEqual({ team: undefined, siteId: undefined });
    });

    it('pins a support agent to IT Support and their own site', () => {
      expect(resolveReportScope({ role: UserRole.AGENT, siteId: SITE_SPJ }))
        .toEqual({ team: HandlingTeam.OPS_SUPPORT, siteId: SITE_SPJ });
    });

    it('forbids a support agent from another team or site', () => {
      const agent = { role: UserRole.AGENT, siteId: SITE_SPJ };
      expect(() => resolveReportScope(agent, HandlingTeam.ORACLE_DEV)).toThrow(ForbiddenException);
      expect(() => resolveReportScope(agent, ALL_DEV_TEAM)).toThrow(ForbiddenException);
      expect(() => resolveReportScope(agent, undefined, SITE_SMG)).toThrow(ForbiddenException);
    });

    it('fails closed for a support agent without a site', () => {
      expect(() => resolveReportScope({ role: UserRole.AGENT, siteId: null })).toThrow(ForbiddenException);
    });

    it('lets a dev agent pick any site but only their own team', () => {
      const dev = { role: UserRole.AGENT_MOBILE_DEV, siteId: SITE_SPJ };
      expect(resolveReportScope(dev, undefined, SITE_SMG)).toEqual({ team: HandlingTeam.MOBILE_DEV, siteId: SITE_SMG });
      expect(resolveReportScope(dev)).toEqual({ team: HandlingTeam.MOBILE_DEV, siteId: undefined });
      expect(() => resolveReportScope(dev, HandlingTeam.WEB_DEV)).toThrow(ForbiddenException);
    });

    it('rejects unknown teams and USER role', () => {
      expect(() => resolveReportScope({ role: UserRole.ADMIN, siteId: null }, 'HACKERS')).toThrow(ForbiddenException);
      expect(() => resolveReportScope({ role: UserRole.USER, siteId: SITE_SPJ })).toThrow(ForbiddenException);
    });
  });

  describe('applyTeamFilter', () => {
    const makeQb = () => {
      const qb: any = { andWhere: jest.fn(() => qb) };
      return qb;
    };

    it('counts tickets without a handling team as IT Support', () => {
      const qb = makeQb();
      applyTeamFilter(qb, 'ticket', HandlingTeam.OPS_SUPPORT);
      expect(qb.andWhere).toHaveBeenCalledWith(
        '(ticket.handlingTeam = :reportTeam OR ticket.handlingTeam IS NULL)',
        { reportTeam: HandlingTeam.OPS_SUPPORT },
      );
    });

    it('matches all three dev teams for ALL_DEV', () => {
      const qb = makeQb();
      applyTeamFilter(qb, 't', ALL_DEV_TEAM);
      expect(qb.andWhere).toHaveBeenCalledWith('t.handlingTeam IN (:...reportTeams)', {
        reportTeams: [HandlingTeam.ORACLE_DEV, HandlingTeam.WEB_DEV, HandlingTeam.MOBILE_DEV],
      });
    });

    it('does nothing without a team', () => {
      const qb = makeQb();
      applyTeamFilter(qb, 'ticket');
      expect(qb.andWhere).not.toHaveBeenCalled();
    });
  });

  it('labels and roles fall back to every team', () => {
    expect(teamLabel()).toBe('Semua Tim');
    expect(teamLabel(HandlingTeam.ORACLE_DEV)).toBe('Oracle / K2');
    expect(rolesForTeam()).toEqual(expect.arrayContaining([UserRole.AGENT, UserRole.AGENT_WEB_DEV]));
  });
});
