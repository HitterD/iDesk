import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SurveyPreview } from '../SurveyPreview';
import type { CsiPeriodDetail } from '../../../types';

vi.mock('@/stores/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin', fullName: 'Admin Preview' } }) }));
vi.mock('../../../hooks/useCsi', () => ({
    useCsiDepartments: () => ({ data: [{ id: 'g1', name: 'Finance', isActive: true }] }),
    useCsiDimensions: () => ({ data: [{ id: 'd1', description: 'Respons cepat' }] }),
}));

const PERIOD: CsiPeriodDetail = {
    id: 'p1', scope: 'ICT', siteId: 's1', title: 'Survei ICT', intro: 'Nilai tim kami', thankYou: '',
    startDate: '2026-10-01', endDate: '2026-10-31', respondentMode: 'OPEN', createdById: 'admin',
    createdAt: '', updatedAt: '', site: null, status: 'ACTIVE', publishStatus: 'DRAFT', locked: false,
    readiness: { ready: false, checks: [] }, raters: [],
    ratees: [{ id: 'r1', periodId: 'p1', userId: 'admin', displayName: 'Admin Preview', jobTitle: 'Support',
        sortOrder: 0, createdAt: '', updatedAt: '', dimensions: [
            { id: 'x1', periodRateeId: 'r1', dimensionId: 'd1', dimensionName: 'Kecepatan', sortOrder: 0, createdAt: '', updatedAt: '' },
        ] }],
};

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

const openPreview = (period = PERIOD) => render(<SurveyPreview open onOpenChange={vi.fn()} period={period} />);

describe('SurveyPreview', () => {
    it('renders the real flow with the admin name and never touches localStorage through review and unmount', () => {
        const read = vi.spyOn(Storage.prototype, 'getItem');
        const write = vi.spyOn(Storage.prototype, 'setItem');
        const remove = vi.spyOn(Storage.prototype, 'removeItem');
        const view = openPreview();
        expect(screen.getByRole('note')).toHaveTextContent('Pratinjau — jawaban tidak dikirim');
        expect(screen.getByRole('heading', { name: 'Survei ICT', level: 2 })).toBeInTheDocument();
        expect(screen.getByLabelText('Nama')).toHaveValue('Admin Preview');
        fireEvent.click(screen.getByRole('button', { name: 'Mulai mengisi' }));
        expect(screen.getByRole('heading', { name: 'Admin Preview', level: 2 })).toBeInTheDocument();
        expect(screen.getByText('Respons cepat')).toBeInTheDocument();
        fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Kecepatan untuk Admin Preview' })).getByRole('radio', { name: '5 dari 5' }));
        fireEvent.change(screen.getByRole('textbox', { name: 'Saran untuk Admin Preview (opsional)' }), { target: { value: 'Bagus' } });
        fireEvent.click(screen.getByRole('button', { name: 'Tinjau jawaban' }));
        expect(screen.getAllByText('Pratinjau — jawaban tidak dikirim')).toHaveLength(1);
        expect(screen.getByRole('button', { name: 'Kirim' })).toBeDisabled();
        view.unmount();
        expect(read).not.toHaveBeenCalled();
        expect(write).not.toHaveBeenCalled();
        expect(remove).not.toHaveBeenCalled();
    });

    it('preview with no ratees shows empty note instead of the flow', () => {
        openPreview({ ...PERIOD, ratees: [] });
        expect(screen.getByText('Tambahkan orang yang dinilai untuk melihat pratinjau.')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Mulai mengisi' })).not.toBeInTheDocument();
    });
});
