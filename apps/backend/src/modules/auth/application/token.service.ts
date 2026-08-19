import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { ValidatedUser } from './auth-user.types';
import { RefreshTokenClaims } from './refresh-session.types';

const REFRESH_EXPIRY_SECONDS = { '7d': 7 * 24 * 60 * 60, '90d': 90 * 24 * 60 * 60 } as const;
type TokenExpiry = keyof typeof REFRESH_EXPIRY_SECONDS;
type JwtExpiry = `${number}${'s' | 'm' | 'h' | 'd'}`;

export interface IssuedTokens {
    access_token: string;
    refresh_token: string;
    tokenId: string;
    familyId: string;
    parentId?: string;
    expiresIn: string;
    refreshExpiresIn: TokenExpiry;
    refreshExpiresAt: number;
}

@Injectable()
export class TokenService {
    constructor(private readonly jwtService: JwtService) {}

    issueAccessToken(user: ValidatedUser): { token: string; expiresIn: string } {
        const expiresIn = this.getExpirationByRole(user.role);
        const payload = {
            username: user.email,
            sub: user.id,
            role: user.role,
            type: 'access',
            fullName: user.fullName,
            siteId: user.siteId ?? null,
        };
        return {
            token: this.jwtService.sign(payload, { expiresIn: expiresIn as JwtExpiry }),
            expiresIn,
        };
    }

    issueRefreshToken(
        user: ValidatedUser,
        familyId: string = randomUUID(),
        parentId?: string,
        rememberMe = false,
    ): IssuedTokens {
        const tokenId = randomUUID();
        const refreshExpiresIn: TokenExpiry = rememberMe ? '90d' : '7d';
        const refreshPayload = {
            username: user.email,
            sub: user.id,
            role: user.role,
            type: 'refresh',
            fullName: user.fullName,
            siteId: user.siteId ?? null,
            rememberMe,
            tokenId,
            familyId,
            ...(parentId ? { parentId } : {}),
        };
        const access = this.issueAccessToken(user);
        const refresh_token = this.jwtService.sign(refreshPayload, { expiresIn: refreshExpiresIn });
        const refreshExpiresAt = Date.now() + REFRESH_EXPIRY_SECONDS[refreshExpiresIn] * 1000;

        return {
            access_token: access.token,
            refresh_token,
            tokenId,
            familyId,
            parentId,
            expiresIn: access.expiresIn,
            refreshExpiresIn,
            refreshExpiresAt,
        };
    }

    verifyRefreshToken(token: string): RefreshTokenClaims {
        const claims = this.jwtService.verify(token) as RefreshTokenClaims;
        if (claims.type !== 'refresh' || !claims.sub) {
            throw new Error('Invalid refresh token');
        }
        return claims;
    }

    private getExpirationByRole(role: string): string {
        return new Set(['ADMIN', 'AGENT', 'AGENT_OPERATIONAL_SUPPORT', 'AGENT_ORACLE', 'MANAGER']).has(role)
            ? '8h'
            : '1h';
    }
}
