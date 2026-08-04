export interface RefreshTokenClaims {
    sub: string;
    tokenId: string;
    familyId: string;
    parentId?: string;
    type: 'refresh';
    rememberMe: boolean;
    iat: number;
    exp: number;
}

export interface RefreshSessionInput {
    token: string;
    tokenId: string;
    familyId: string;
    userId: string;
    parentId?: string;
    expiresAt: number;
}

export interface RefreshSessionState {
    tokenId: string;
    familyId: string;
    userId: string;
    parentId?: string;
    tokenDigest: string;
    consumed: boolean;
    consumedAt?: number;
    expiresAt: number;
}

export type RefreshConsumeResult =
    | { status: 'valid'; session: RefreshSessionState }
    | { status: 'reused'; session: RefreshSessionState }
    | { status: 'missing' };
