import { BadRequestException } from '@nestjs/common';

/** Stable subject identity across periods: `user:<userId>` for a person, `team:<teamId>` for a site team. */
export type CsiSubjectRef = { kind: 'user' | 'team'; id: string };

const SUBJECT_KEY = /^(user|team):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export const userSubjectKey = (userId: string) => `user:${userId}`;
export const teamSubjectKey = (teamId: string) => `team:${teamId}`;
/** HC PIC (csi_pics) — no account needed. */
export const picSubjectKey = (picId: string) => `pic:${picId}`;

/** Parses a subject key; anything other than `user:<uuid>` / `team:<uuid>` is a 400. */
export function parseSubjectKey(key: string): CsiSubjectRef {
    const match = SUBJECT_KEY.exec(key ?? '');
    if (!match) throw new BadRequestException('Kunci subjek tidak valid');
    return { kind: match[1].toLowerCase() as CsiSubjectRef['kind'], id: match[2].toLowerCase() };
}
