import { UserRole } from '../users/enums/user-role.enum';
import { ArticleStatus, ArticleVisibility } from './entities/article.entity';

/**
 * Roles that belong to the internal ICT/agent staff.
 * These roles may read articles marked as INTERNAL.
 */
const INTERNAL_STAFF_ROLES: readonly UserRole[] = [
    UserRole.ADMIN,
    UserRole.AGENT,
    UserRole.AGENT_OPERATIONAL_SUPPORT,
    UserRole.AGENT_ORACLE,
    UserRole.AGENT_ADMIN,
    UserRole.MANAGER,
];

export const isInternalStaff = (role?: UserRole | string | null): boolean =>
    !!role && INTERNAL_STAFF_ROLES.includes(role as UserRole);

/**
 * Visibility levels a caller is allowed to read.
 *
 * PUBLIC   - everyone who is logged in
 * INTERNAL - ICT/agent staff only
 * PRIVATE  - author + admin only, resolved per-article (never listed in bulk)
 */
export function allowedVisibilities(role?: UserRole | string | null): ArticleVisibility[] {
    return isInternalStaff(role)
        ? [ArticleVisibility.PUBLIC, ArticleVisibility.INTERNAL]
        : [ArticleVisibility.PUBLIC];
}

/**
 * Whether a caller may read a single article of the given visibility.
 * PRIVATE articles are readable only by their author or an ADMIN.
 */
export function canReadArticle(
    article: { visibility: ArticleVisibility; authorId?: string | null },
    user: { userId?: string; role?: UserRole | string | null },
): boolean {
    if (user.role === UserRole.ADMIN) return true;

    if (article.visibility === ArticleVisibility.PRIVATE) {
        return !!user.userId && article.authorId === user.userId;
    }

    return allowedVisibilities(user.role).includes(article.visibility);
}

/**
 * Publishing is role-gated. Articles marked PUBLIC need an admin review
 * before they reach the whole company: a non-admin author who asks to
 * "publish" gets PENDING_REVIEW instead. INTERNAL is staff-facing so
 * agents may publish it directly. Admins publish anything directly.
 */
export function finalPublishStatus(
    requested: ArticleStatus | undefined,
    visibility: ArticleVisibility | undefined,
    actorRole?: UserRole | string | null,
): ArticleStatus {
    if (requested !== ArticleStatus.PUBLISHED) {
        return requested ?? ArticleStatus.DRAFT;
    }

    if (actorRole === UserRole.ADMIN) {
        return ArticleStatus.PUBLISHED;
    }

    return visibility === ArticleVisibility.INTERNAL
        ? ArticleStatus.PUBLISHED
        : ArticleStatus.PENDING_REVIEW;
}

/**
 * Whether the actor may move an article out of PENDING_REVIEW.
 * Only an admin may decide the fate of a PENDING_REVIEW article.
 */
export const canReviewPending = (actorRole?: UserRole | string | null): boolean =>
    actorRole === UserRole.ADMIN;
