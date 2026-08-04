import { CookieOptions } from 'express';

export const ACCESS_COOKIE_NAME = 'access_token';
export const REFRESH_COOKIE_NAME = 'refresh_token';

export const AUTH_COOKIE_OPTIONS: CookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
};

export function withCookieMaxAge(maxAge: number): CookieOptions {
    return { ...AUTH_COOKIE_OPTIONS, maxAge };
}

export function clearCookieOptions(): CookieOptions {
    return { ...AUTH_COOKIE_OPTIONS };
}

