import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ZoomTimeSelect, type TimeSlotOption } from '../ZoomTimeSelect';

let writeTextMock: (data: string) => Promise<void>;

beforeEach(() => {
    writeTextMock = vi.fn(async (_data: string) => undefined);
    Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: writeTextMock },
    });
});

afterEach(() => {
    vi.restoreAllMocks();
});

const baseOptions: TimeSlotOption[] = [
    { time: '09:00', isUnavailable: true, bookingTitle: 'Standup', joinUrl: 'https://zoom.us/j/123', accountName: 'Marketing' },
    { time: '10:00' },
    { time: '11:00' },
];

describe('ZoomTimeSelect', () => {
    it('renders the trigger with placeholder when no value', () => {
        render(<ZoomTimeSelect value="" onChange={() => {}} options={baseOptions} />);
        expect(screen.getByText(/Pilih waktu/i)).toBeInTheDocument();
    });

    it('opens the listbox on trigger click and shows unavailable title (no auto-redirect)', async () => {
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
        const user = userEvent.setup();
        render(<ZoomTimeSelect value="" onChange={() => {}} options={baseOptions} />);
        await user.click(screen.getByTestId('zoom-time-select'));
        expect(screen.getByTestId('zoom-time-select-options')).toBeInTheDocument();
        // The unavailable option shows the title — no Zoom button that auto-redirects
        expect(screen.getByText(/Standup/)).toBeInTheDocument();
        expect(openSpy).not.toHaveBeenCalled();
        openSpy.mockRestore();
    });

    it('selecting an available time closes the dropdown and emits onChange', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(<ZoomTimeSelect value="" onChange={onChange} options={baseOptions} />);
        await user.click(screen.getByTestId('zoom-time-select'));
        await user.click(screen.getByTestId('zoom-time-select-option-10:00'));
        expect(onChange).toHaveBeenCalledWith('10:00');
        expect(screen.queryByTestId('zoom-time-select-options')).not.toBeInTheDocument();
    });

    it('selecting an unavailable time does NOT call window.open — it routes through onChange', async () => {
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(<ZoomTimeSelect value="" onChange={onChange} options={baseOptions} />);
        await user.click(screen.getByTestId('zoom-time-select'));
        await user.click(screen.getByTestId('zoom-time-select-option-09:00'));
        expect(onChange).toHaveBeenCalledWith('09:00');
        expect(openSpy).not.toHaveBeenCalled();
        openSpy.mockRestore();
    });

    it('shows the info card when the selected value is unavailable (no auto-redirect)', () => {
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
        render(<ZoomTimeSelect value="09:00" onChange={() => {}} options={baseOptions} />);
        expect(screen.getByTestId('zoom-time-select-info-card')).toBeInTheDocument();
        expect(screen.getByTestId('zoom-time-select-join-url')).toHaveTextContent('https://zoom.us/j/123');
        // Auto-redirect on render is a no
        expect(openSpy).not.toHaveBeenCalled();
        openSpy.mockRestore();
    });

    it('renders Copy and explicit Join buttons inside the info card', () => {
        render(<ZoomTimeSelect value="09:00" onChange={() => {}} options={baseOptions} />);
        expect(screen.getByTestId('zoom-time-select-copy')).toBeInTheDocument();
        expect(screen.getByTestId('zoom-time-select-join')).toBeInTheDocument();
    });

    it('explicit Join button IS the only path that opens the zoom URL (user-controlled)', async () => {
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
        const user = userEvent.setup();
        render(<ZoomTimeSelect value="09:00" onChange={() => {}} options={baseOptions} />);
        await user.click(screen.getByTestId('zoom-time-select-join'));
        expect(openSpy).toHaveBeenCalledWith('https://zoom.us/j/123', '_blank', expect.any(String));
        openSpy.mockRestore();
    });

    it('Copy button confirms a successful copy action', async () => {
        const user = userEvent.setup();
        render(<ZoomTimeSelect value="09:00" onChange={() => {}} options={baseOptions} />);
        await user.click(screen.getByTestId('zoom-time-select-copy'));
        await waitFor(() => {
            expect(screen.getByTestId('zoom-time-select-copy')).toHaveTextContent('Tersalin');
        });
    });

    it('does not show the info card when the selected time is available', () => {
        render(<ZoomTimeSelect value="10:00" onChange={() => {}} options={baseOptions} />);
        expect(screen.queryByTestId('zoom-time-select-info-card')).not.toBeInTheDocument();
    });

    it('renders "Lihat detail" button when onViewBookedTime is provided', () => {
        const onView = vi.fn();
        render(
            <ZoomTimeSelect
                value="09:00"
                onChange={() => {}}
                options={baseOptions}
                onViewBookedTime={onView}
            />,
        );
        expect(screen.getByTestId('zoom-time-select-view')).toBeInTheDocument();
    });

    it('shows a fallback message when the unavailable time has no joinUrl', () => {
        const opts: TimeSlotOption[] = [
            { time: '09:00', isUnavailable: true, bookingTitle: 'Standup' },
        ];
        render(<ZoomTimeSelect value="09:00" onChange={() => {}} options={opts} />);
        expect(screen.getByTestId('zoom-time-select-info-card')).toBeInTheDocument();
        expect(screen.getByText(/Link Zoom akan tersedia/i)).toBeInTheDocument();
    });

    it('closes the dropdown on Escape', async () => {
        const user = userEvent.setup();
        render(<ZoomTimeSelect value="" onChange={() => {}} options={baseOptions} />);
        await user.click(screen.getByTestId('zoom-time-select'));
        expect(screen.getByTestId('zoom-time-select-options')).toBeInTheDocument();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByTestId('zoom-time-select-options')).not.toBeInTheDocument();
    });

    it('anchors left-0 by default and applies custom dropdownClassName', async () => {
        const user = userEvent.setup();
        render(
            <ZoomTimeSelect
                value=""
                onChange={() => {}}
                options={baseOptions}
                dropdownClassName="w-[calc(200%+0.75rem)]"
            />
        );
        await user.click(screen.getByTestId('zoom-time-select'));
        const optionsEl = screen.getByTestId('zoom-time-select-options');
        expect(optionsEl.className).toContain('left-0');
        expect(optionsEl.className).toContain('w-[calc(200%+0.75rem)]');
    });

    it('anchors right-0 when align="right"', async () => {
        const user = userEvent.setup();
        render(
            <ZoomTimeSelect
                value=""
                onChange={() => {}}
                options={baseOptions}
                align="right"
            />
        );
        await user.click(screen.getByTestId('zoom-time-select'));
        const optionsEl = screen.getByTestId('zoom-time-select-options');
        expect(optionsEl.className).toContain('right-0');
        expect(optionsEl.className).not.toContain('left-0');
    });
});

