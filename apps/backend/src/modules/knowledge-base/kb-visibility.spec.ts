import { UserRole } from '../users/enums/user-role.enum';
import { ArticleVisibility } from './entities/article.entity';
import { allowedVisibilities, canReadArticle, isInternalStaff } from './kb-visibility.util';

const INTERNAL_ROLES = [
  UserRole.ADMIN,
  UserRole.AGENT,
  UserRole.AGENT_OPERATIONAL_SUPPORT,
  UserRole.AGENT_ORACLE,
  UserRole.AGENT_ADMIN,
  UserRole.MANAGER,
];

const AUTHOR_ID = 'user-author';

function makeArticle(visibility: ArticleVisibility, authorId: string | null = AUTHOR_ID) {
  return { visibility, authorId };
}

describe('isInternalStaff', () => {
  it.each(INTERNAL_ROLES)('treats %s as internal staff', (role) => {
    expect(isInternalStaff(role)).toBe(true);
  });

  it('rejects the end-user role', () => {
    expect(isInternalStaff(UserRole.USER)).toBe(false);
  });

  it.each([undefined, null, '', 'anything-else'])('rejects %p', (role) => {
    expect(isInternalStaff(role as any)).toBe(false);
  });
});

describe('allowedVisibilities', () => {
  it.each(INTERNAL_ROLES)('grants public + internal to %s', (role) => {
    expect(allowedVisibilities(role)).toEqual([
      ArticleVisibility.PUBLIC,
      ArticleVisibility.INTERNAL,
    ]);
  });

  it.each([UserRole.USER, undefined, null])('grants public only to %p', (role) => {
    expect(allowedVisibilities(role as any)).toEqual([ArticleVisibility.PUBLIC]);
  });

  it('never returns private', () => {
    for (const role of [...INTERNAL_ROLES, UserRole.USER, undefined]) {
      expect(allowedVisibilities(role as any)).not.toContain(ArticleVisibility.PRIVATE);
    }
  });
});

describe('canReadArticle', () => {
  it('lets an admin read every visibility', () => {
    const admin = { userId: 'admin-1', role: UserRole.ADMIN };
    for (const visibility of Object.values(ArticleVisibility)) {
      expect(canReadArticle(makeArticle(visibility), admin)).toBe(true);
    }
  });

  it('lets internal staff read internal articles', () => {
    const agent = { userId: 'agent-1', role: UserRole.AGENT_OPERATIONAL_SUPPORT };
    expect(canReadArticle(makeArticle(ArticleVisibility.INTERNAL), agent)).toBe(true);
  });

  it('blocks an end user from internal articles', () => {
    const endUser = { userId: 'user-1', role: UserRole.USER };
    expect(canReadArticle(makeArticle(ArticleVisibility.INTERNAL), endUser)).toBe(false);
  });

  it('blocks an anonymous caller from internal articles', () => {
    expect(canReadArticle(makeArticle(ArticleVisibility.INTERNAL), {})).toBe(false);
  });

  it('allows public articles for any logged-in role', () => {
    expect(canReadArticle(makeArticle(ArticleVisibility.PUBLIC), { userId: 'u', role: UserRole.USER })).toBe(true);
  });

  it('restricts private articles to their author', () => {
    const article = makeArticle(ArticleVisibility.PRIVATE);
    expect(canReadArticle(article, { userId: AUTHOR_ID, role: UserRole.AGENT })).toBe(true);
    expect(canReadArticle(article, { userId: 'someone-else', role: UserRole.AGENT })).toBe(false);
    expect(canReadArticle(article, { userId: 'someone-else', role: UserRole.MANAGER })).toBe(false);
  });

  it('does not match a private article with no author against an anonymous caller', () => {
    const orphan = makeArticle(ArticleVisibility.PRIVATE, null);
    expect(canReadArticle(orphan, {})).toBe(false);
    expect(canReadArticle(orphan, { userId: undefined, role: UserRole.AGENT })).toBe(false);
  });
});
