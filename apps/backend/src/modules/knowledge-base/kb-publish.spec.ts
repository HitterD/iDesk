import { ArticleStatus, ArticleVisibility } from './entities/article.entity';
import { finalPublishStatus, canReviewPending } from './kb-visibility.util';
import { UserRole } from '../users/enums/user-role.enum';

describe('finalPublishStatus', () => {
    it('keeps non-PUBLISHED requested statuses as-is for anyone', () => {
        for (const role of [UserRole.ADMIN, UserRole.AGENT, UserRole.AGENT_OPERATIONAL_SUPPORT, null]) {
            expect(finalPublishStatus(ArticleStatus.DRAFT, ArticleVisibility.PUBLIC, role))
                .toBe(ArticleStatus.DRAFT);
            expect(finalPublishStatus(ArticleStatus.ARCHIVED, ArticleVisibility.PUBLIC, role))
                .toBe(ArticleStatus.ARCHIVED);
        }
    });

    it('defaults an undefined status to DRAFT', () => {
        expect(finalPublishStatus(undefined, ArticleVisibility.PUBLIC, UserRole.AGENT))
            .toBe(ArticleStatus.DRAFT);
    });

    it('lets an ADMIN publish PUBLIC directly', () => {
        expect(finalPublishStatus(ArticleStatus.PUBLISHED, ArticleVisibility.PUBLIC, UserRole.ADMIN))
            .toBe(ArticleStatus.PUBLISHED);
    });

    it('lets an ADMIN publish INTERNAL directly', () => {
        expect(finalPublishStatus(ArticleStatus.PUBLISHED, ArticleVisibility.INTERNAL, UserRole.ADMIN))
            .toBe(ArticleStatus.PUBLISHED);
    });

    it('sends a non-admin PUBLIC publish to PENDING_REVIEW', () => {
        for (const role of [
            UserRole.AGENT,
            UserRole.AGENT_OPERATIONAL_SUPPORT,
            UserRole.AGENT_ORACLE,
            UserRole.AGENT_ADMIN,
            UserRole.MANAGER,
            undefined,
            null,
        ]) {
            expect(finalPublishStatus(ArticleStatus.PUBLISHED, ArticleVisibility.PUBLIC, role))
                .toBe(ArticleStatus.PENDING_REVIEW);
        }
    });

    it('lets a non-admin publish INTERNAL directly (staff-facing only)', () => {
        expect(finalPublishStatus(ArticleStatus.PUBLISHED, ArticleVisibility.INTERNAL, UserRole.AGENT_OPERATIONAL_SUPPORT))
            .toBe(ArticleStatus.PUBLISHED);
    });

    it('routes admin-edited PUBLIC to PENDING_REVIEW when visibility missing', () => {
        // create flow from a non-admin: status PUBLISHED + visibility PUBLIC
        expect(finalPublishStatus(ArticleStatus.PUBLISHED, ArticleVisibility.PUBLIC, UserRole.AGENT))
            .toBe(ArticleStatus.PENDING_REVIEW);
    });
});

describe('canReviewPending', () => {
    it('allows only ADMIN', () => {
        expect(canReviewPending(UserRole.ADMIN)).toBe(true);
        for (const role of [
            UserRole.AGENT,
            UserRole.AGENT_OPERATIONAL_SUPPORT,
            UserRole.AGENT_ORACLE,
            UserRole.AGENT_ADMIN,
            UserRole.MANAGER,
            UserRole.USER,
            undefined,
            null,
        ]) {
            expect(canReviewPending(role)).toBe(false);
        }
    });
});
