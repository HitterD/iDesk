import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CsiPeriodDetail } from '../../../types';
import { StepRatees } from '../StepRatees';

vi.mock('../../admin/hc/PicAssignment', () => ({ PicAssignment: () => <p>pemilih PIC</p> }));
vi.mock('../../admin/RateeAssignment', () => ({ RateeAssignment: () => <p>pemilih akun user</p> }));

const period = (over: Partial<CsiPeriodDetail>) => ({ id: 'p1', respondentPicks: false, respondentMode: 'LISTED', ratees: [], ...over }) as CsiPeriodDetail;

afterEach(cleanup);

describe('StepRatees', () => {
    it.each([false, true])('HC always uses the PIC picker (respondentPicks %s)', (respondentPicks) => {
        render(<StepRatees scope="hc" period={period({ scope: 'HC', respondentPicks })} onDirtyChange={() => undefined} />);
        expect(screen.getByText('pemilih PIC')).toBeInTheDocument();
        expect(screen.queryByText('pemilih akun user')).not.toBeInTheDocument();
    });

    it('ICT keeps the user-account picker', () => {
        render(<StepRatees scope="ict" period={period({ scope: 'ICT' })} onDirtyChange={() => undefined} />);
        expect(screen.getByText('pemilih akun user')).toBeInTheDocument();
    });
});
