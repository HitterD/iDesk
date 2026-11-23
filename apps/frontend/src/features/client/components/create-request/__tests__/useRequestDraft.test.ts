import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { draftKey, useRequestDraft } from '../useRequestDraft';

beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); });
afterEach(() => { vi.useRealTimers(); });

const KEY = draftKey('user-1', 'eform');

describe('useRequestDraft', () => {
    it('keys the draft by user and kind', () => {
        expect(KEY).toBe('idesk:req-draft:user-1:eform');
    });

    it('starts from the initial value and saves a change after 500 ms', () => {
        const { result } = renderHook(() => useRequestDraft(KEY, { reason: '' }));
        expect(result.current[0]).toEqual({ reason: '' });
        act(() => result.current[1]({ reason: 'WFH' }));
        expect(localStorage.getItem(KEY)).toBeNull();
        act(() => { vi.advanceTimersByTime(500); });
        expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ reason: 'WFH' });
    });

    it('restores the draft after a reload', () => {
        localStorage.setItem(KEY, JSON.stringify({ reason: 'dari sebelumnya' }));
        const { result } = renderHook(() => useRequestDraft(KEY, { reason: '' }));
        expect(result.current[0]).toEqual({ reason: 'dari sebelumnya' });
    });

    it('clear removes the draft and goes back to the initial value', () => {
        localStorage.setItem(KEY, JSON.stringify({ reason: 'x' }));
        const { result } = renderHook(() => useRequestDraft(KEY, { reason: '' }));
        act(() => result.current[2]());
        expect(localStorage.getItem(KEY)).toBeNull();
        expect(result.current[0]).toEqual({ reason: '' });
    });

    it('still works when storage is blocked or holds garbage', () => {
        localStorage.setItem(KEY, '{not json');
        const { result } = renderHook(() => useRequestDraft(KEY, { reason: '' }));
        expect(result.current[0]).toEqual({ reason: '' });
        const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
        act(() => result.current[1]({ reason: 'ok' }));
        expect(() => act(() => { vi.advanceTimersByTime(500); })).not.toThrow();
        expect(result.current[0]).toEqual({ reason: 'ok' });
        spy.mockRestore();
    });

    it('fills fields an older draft does not have from the initial value', () => {
        localStorage.setItem(KEY, JSON.stringify({ reason: 'lama' }));
        const { result } = renderHook(() => useRequestDraft(KEY, { reason: '', shotUrls: [] as string[] }));
        expect(result.current[0]).toEqual({ reason: 'lama', shotUrls: [] });
    });
});
