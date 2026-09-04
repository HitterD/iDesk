import { ArticleStatus, ArticleVisibility } from './entities/article.entity';
import { canFeatureArticle, canBeFeatured, shouldDropFeatured } from './kb-visibility.util';
import { UserRole } from '../users/enums/user-role.enum';

const NON_ADMIN_ROLES = [
    UserRole.AGENT,
    UserRole.AGENT_OPERATIONAL_SUPPORT,
    UserRole.AGENT_ORACLE,
    UserRole.AGENT_ADMIN,
    UserRole.MANAGER,
    UserRole.USER,
    undefined,
    null,
];

describe('canFeatureArticle', () => {
    it('allows only ADMIN to pin the landing page article', () => {
        expect(canFeatureArticle(UserRole.ADMIN)).toBe(true);
        for (const role of NON_ADMIN_ROLES) {
            expect(canFeatureArticle(role)).toBe(false);
        }
    });
});

describe('canBeFeatured', () => {
    it('accepts a published, public article', () => {
        expect(canBeFeatured({
            status: ArticleStatus.PUBLISHED,
            visibility: ArticleVisibility.PUBLIC,
        })).toBe(true);
    });

    it('rejects every unpublished status, so a draft can never reach the hero card', () => {
        for (const status of [ArticleStatus.DRAFT, ArticleStatus.PENDING_REVIEW, ArticleStatus.ARCHIVED]) {
            expect(canBeFeatured({ status, visibility: ArticleVisibility.PUBLIC })).toBe(false);
        }
    });

    it('rejects non-public visibility, so staff-only material is not pinned for end users', () => {
        for (const visibility of [ArticleVisibility.INTERNAL, ArticleVisibility.PRIVATE]) {
            expect(canBeFeatured({ status: ArticleStatus.PUBLISHED, visibility })).toBe(false);
        }
    });
});

describe('shouldDropFeatured', () => {
    const featured = { isFeatured: true };
    const notFeatured = { isFeatured: false };

    it('keeps the flag while the article stays published and public', () => {
        expect(shouldDropFeatured(featured, {
            status: ArticleStatus.PUBLISHED,
            visibility: ArticleVisibility.PUBLIC,
        })).toBe(false);
    });

    it('drops the flag when the article is unpublished', () => {
        for (const status of [ArticleStatus.DRAFT, ArticleStatus.PENDING_REVIEW, ArticleStatus.ARCHIVED]) {
            expect(shouldDropFeatured(featured, { status, visibility: ArticleVisibility.PUBLIC })).toBe(true);
        }
    });

    it('drops the flag when visibility narrows below public', () => {
        for (const visibility of [ArticleVisibility.INTERNAL, ArticleVisibility.PRIVATE]) {
            expect(shouldDropFeatured(featured, { status: ArticleStatus.PUBLISHED, visibility })).toBe(true);
        }
    });

    it('is a no-op for an article that was never featured', () => {
        expect(shouldDropFeatured(notFeatured, {
            status: ArticleStatus.DRAFT,
            visibility: ArticleVisibility.PRIVATE,
        })).toBe(false);
        expect(shouldDropFeatured({}, {
            status: ArticleStatus.DRAFT,
            visibility: ArticleVisibility.PRIVATE,
        })).toBe(false);
    });
});
