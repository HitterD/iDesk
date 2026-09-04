import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { ZoomEndTimeSelect, type EndTimeOption } from '../ZoomEndTimeSelect';

vi.mock('sonner', () => ({
    toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

describe('ZoomEndTimeSelect', () => {
    const mockOptions: EndTimeOption[] = [
        { value: '13:30', time: '13:30', durationMinutes: 30, isUnavailable: false },
        { value: '14:00', time: '14:00', durationMinutes: 60, isUnavailable: true, reason: 'Penuh (10 akun)' },
        { value: '14:30', time: '14:30', durationMinutes: 90, isUnavailable: true, reason: 'Penuh (10 akun)' },
    ];

    beforeEach(() => {
        vi.mocked(toast.error).mockReset();
    });

    it('renders disabled state with appropriate message when disabled=true', () => {
        render(
            <ZoomEndTimeSelect
                value=""
                onChange={() => {}}
                options={mockOptions}
                disabled={true}
            />
        );

        const btn = screen.getByRole('combobox', { name: 'Jam Selesai' });
        expect(btn).toBeDisabled();
        expect(screen.getByText('Pilih jam mulai dahulu')).toBeInTheDocument();
    });

    it('opens dropdown on click and displays available and unavailable items', async () => {
        const user = userEvent.setup();
        render(
            <ZoomEndTimeSelect
                value="13:30"
                onChange={() => {}}
                options={mockOptions}
                disabled={false}
            />
        );

        const btn = screen.getByRole('combobox', { name: 'Jam Selesai' });
        expect(btn).not.toBeDisabled();
        await user.click(btn);

        expect(screen.getByTestId('zoom-end-time-select-options')).toBeInTheDocument();
        expect(screen.getByText('Tersedia')).toBeInTheDocument();
        expect(screen.getAllByText('Penuh (10 akun)').length).toBe(2);
    });

    it('allows selecting an available end time', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(
            <ZoomEndTimeSelect
                value=""
                onChange={onChange}
                options={mockOptions}
                disabled={false}
            />
        );

        await user.click(screen.getByRole('combobox', { name: 'Jam Selesai' }));
        await user.click(screen.getByTestId('zoom-end-time-select-option-13:30'));

        expect(onChange).toHaveBeenCalledWith('13:30');
        expect(screen.queryByTestId('zoom-end-time-select-options')).not.toBeInTheDocument();
    });

    it('blocks selecting an unavailable end time and shows toast error', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(
            <ZoomEndTimeSelect
                value=""
                onChange={onChange}
                options={mockOptions}
                disabled={false}
            />
        );

        await user.click(screen.getByRole('combobox', { name: 'Jam Selesai' }));
        const unavailableOption = screen.getByTestId('zoom-end-time-select-option-14:00');
        await user.click(unavailableOption);

        expect(onChange).not.toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Penuh (10 akun)'));
    });

    it('anchors right-0 by default', async () => {
        const user = userEvent.setup();
        render(
            <ZoomEndTimeSelect
                value=""
                onChange={() => {}}
                options={mockOptions}
                disabled={false}
            />
        );

        await user.click(screen.getByRole('combobox', { name: 'Jam Selesai' }));
        const optionsList = screen.getByTestId('zoom-end-time-select-options');
        expect(optionsList.className).toContain('right-0');
    });

    it('closes on Escape key press', async () => {
        const user = userEvent.setup();
        render(
            <ZoomEndTimeSelect
                value=""
                onChange={() => {}}
                options={mockOptions}
                disabled={false}
            />
        );

        await user.click(screen.getByRole('combobox', { name: 'Jam Selesai' }));
        expect(screen.getByTestId('zoom-end-time-select-options')).toBeInTheDocument();

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByTestId('zoom-end-time-select-options')).not.toBeInTheDocument();
    });
});
