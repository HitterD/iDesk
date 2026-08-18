import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { RefreshSessionStore } from '../infrastructure/refresh-session.store';
import { RefreshConsumeResult } from './refresh-session.types';
import { ValidatedUser } from './auth-user.types';
import { User } from '../../users/entities/user.entity';
import { IssuedTokens } from './token.service';
import { resolveRefreshSessionMode } from '../../../shared/core/config/security.config';

const REFRESH_SESSION_MODE = resolveRefreshSessionMode();

export class RefreshTokenReuseException extends UnauthorizedException {
    constructor() {
        super('Refresh token reuse detected');
    }
}

@Injectable()
export class SessionService {
    constructor(
        private readonly usersService: UsersService,
        private readonly refreshSessionStore: RefreshSessionStore,
    ) {}

    async persist(user: ValidatedUser, tokens: IssuedTokens): Promise<void> {
        if (REFRESH_SESSION_MODE === 'redis' || REFRESH_SESSION_MODE === 'dual') {
            await this.refreshSessionStore.create({
                token: tokens.refresh_token,
                tokenId: tokens.tokenId,
                familyId: tokens.familyId,
                parentId: tokens.parentId,
                userId: user.id,
                expiresAt: tokens.refreshExpiresAt,
            });
        }
        if (REFRESH_SESSION_MODE !== 'redis') {
            await this.usersService.setCurrentRefreshToken(tokens.refresh_token, user.id);
        }
    }

    async rotate(token: string, claims: { sub: string; tokenId?: string; familyId?: string; rememberMe?: boolean }): Promise<User> {
        const isRotationToken = Boolean(claims.tokenId && claims.familyId);
        if (REFRESH_SESSION_MODE === 'redis' && !isRotationToken) {
            throw new UnauthorizedException('Invalid token type');
        }

        let user;
        if (REFRESH_SESSION_MODE !== 'legacy' && isRotationToken) {
            const consumed: RefreshConsumeResult = await this.refreshSessionStore.consume(claims.familyId!, claims.tokenId!);
            if (consumed.status === 'reused') {
                await this.refreshSessionStore.invalidateFamily(claims.familyId!);
                throw new RefreshTokenReuseException();
            }
            if (consumed.status !== 'valid' || consumed.session.userId !== claims.sub) {
                throw new UnauthorizedException('Invalid refresh token');
            }
            user = await this.usersService.findById(claims.sub);
        } else {
            user = await this.usersService.getUserIfRefreshTokenMatches(token, claims.sub);
        }
        if (!user) throw new UnauthorizedException('Invalid refresh token');
        return user;
    }

    async invalidateUser(userId: string): Promise<void> {
        if (REFRESH_SESSION_MODE === 'redis' || REFRESH_SESSION_MODE === 'dual') {
            await this.refreshSessionStore.invalidateUserSessions(userId);
        }
        if (REFRESH_SESSION_MODE !== 'redis') {
            await this.usersService.removeRefreshToken(userId);
        }
    }
}
