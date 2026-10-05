import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { act, type ReactNode } from 'react';
import * as appUpdate from '@/lib/appUpdate';
import { useReloadOnAppUpdate } from '../useReloadOnAppUpdate';

const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={['/a']}>{children}</MemoryRouter>;

describe('useReloadOnAppUpdate', () => {
    const reload = vi.fn();

    beforeEach(() => {
        reload.mockReset();
        vi.stubGlobal('location', { ...window.location, reload });
    });
    afterEach(() => vi.unstubAllGlobals());

    const setup = () => renderHook(() => { useReloadOnAppUpdate(); return useNavigate(); }, { wrapper });

    it('reloads on the next navigation once a new build is deployed', () => {
        vi.spyOn(appUpdate, 'isUpdatePending').mockReturnValue(true);
        const { result } = setup();
        expect(reload).not.toHaveBeenCalled();

        act(() => result.current('/b'));

        expect(reload).toHaveBeenCalledTimes(1);
    });

    it('never reloads while the build is current', () => {
        vi.spyOn(appUpdate, 'isUpdatePending').mockReturnValue(false);
        const { result } = setup();

        act(() => result.current('/b'));

        expect(reload).not.toHaveBeenCalled();
    });
});
