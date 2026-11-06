import { describe, expect, it } from 'vitest';
import { detectBoardSounds, detectBoardSoundDetails } from '../detectBoardSounds';

describe('detectBoardSounds', () => {
    it('stays silent on the first snapshot even when the board is full', () => {
        expect(detectBoardSounds(null, { open: ['a', 'b'], inProgress: ['c'] })).toEqual([]);
    });

    it('reports newTicket when an unseen id appears in open', () => {
        expect(detectBoardSounds(
            { open: ['a'], inProgress: [] },
            { open: ['a', 'b'], inProgress: [] },
        )).toEqual(['newTicket']);
    });

    it('reports inProgress when an id moves from open to in progress', () => {
        expect(detectBoardSounds(
            { open: ['a'], inProgress: [] },
            { open: [], inProgress: ['a'] },
        )).toEqual(['inProgress']);
    });

    it('reports each event once no matter how many tickets triggered it', () => {
        expect(detectBoardSounds(
            { open: ['a', 'b'], inProgress: [] },
            { open: ['x', 'y', 'z'], inProgress: ['a', 'b'] },
        )).toEqual(['newTicket', 'inProgress']);
    });

    it('returns nothing when the board is unchanged', () => {
        expect(detectBoardSounds(
            { open: ['a'], inProgress: ['b'] },
            { open: ['a'], inProgress: ['b'] },
        )).toEqual([]);
    });

    it('ignores tickets that leave the board', () => {
        expect(detectBoardSounds(
            { open: ['a'], inProgress: ['b'] },
            { open: ['a'], inProgress: [] },
        )).toEqual([]);
    });

    it('does not report inProgress for a ticket that was never in open', () => {
        expect(detectBoardSounds(
            { open: [], inProgress: [] },
            { open: [], inProgress: ['a'] },
        )).toEqual([]);
    });

    it('reports specific division sound events for new tickets', () => {
        const prev = { open: [{ id: '1', division: 'OPS_SUPPORT' as const }], inProgress: [] };
        const next = {
            open: [
                { id: '1', division: 'OPS_SUPPORT' as const },
                { id: '2', division: 'ORACLE_DEV' as const },
                { id: '3', division: 'WEB_DEV' as const },
            ],
            inProgress: [{ id: '1' }],
        };
        const results = detectBoardSoundDetails(prev, next);
        expect(results).toEqual([
            { event: 'newTicket', division: 'ORACLE_DEV', ticketId: '2' },
            { event: 'newTicket', division: 'WEB_DEV', ticketId: '3' },
            { event: 'inProgress' },
        ]);
    });
});

describe('detectBoardSoundDetails: forwarded tickets', () => {
    it('replays the new-ticket sound of the target team when a ticket moves to another team', () => {
        expect(detectBoardSoundDetails(
            { open: [{ id: 'a', division: 'OPS_SUPPORT' }], inProgress: [] },
            { open: [{ id: 'a', division: 'ORACLE_DEV' }], inProgress: [] },
        )).toEqual([{ event: 'newTicket', division: 'ORACLE_DEV', ticketId: 'a' }]);
    });

    it('also replays for an in-progress ticket that moves team', () => {
        expect(detectBoardSoundDetails(
            { open: [], inProgress: [{ id: 'a', division: 'OPS_SUPPORT' }] },
            { open: [], inProgress: [{ id: 'a', division: 'WEB_DEV' }] },
        )).toEqual([{ event: 'newTicket', division: 'WEB_DEV', ticketId: 'a' }]);
    });

    it('stays silent when the team is unchanged', () => {
        expect(detectBoardSoundDetails(
            { open: [{ id: 'a', division: 'ORACLE_DEV' }], inProgress: [] },
            { open: [{ id: 'a', division: 'ORACLE_DEV' }], inProgress: [] },
        )).toEqual([]);
    });
});

