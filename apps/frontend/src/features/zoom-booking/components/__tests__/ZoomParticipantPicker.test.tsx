import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ZoomParticipantPicker } from '../ZoomParticipantPicker';
import * as hooks from '../../hooks';

vi.mock('../../hooks', () => ({
    useActiveUsersForParticipants: vi.fn(),
}));

describe('ZoomParticipantPicker', () => {
    const mockUsers = [
        {
            id: 'u1',
            fullName: 'Bagas Developer',
            email: 'bagas@idesk.com',
            department: { id: 'd1', name: 'Engineering' },
        },
        {
            id: 'u2',
            fullName: 'Anisa Marketing',
            email: 'anisa@idesk.com',
            department: { id: 'd2', name: 'Growth' },
        },
        {
            id: 'u3',
            fullName: 'Doni Finance',
            email: 'doni@idesk.com',
            department: { id: 'd3', name: 'Finance' },
        },
    ];

    beforeEach(() => {
        vi.mocked(hooks.useActiveUsersForParticipants).mockReturnValue({
            data: mockUsers,
            isLoading: false,
        } as any);
    });

    it('renders placeholder when no participants are selected', () => {
        render(<ZoomParticipantPicker value={[]} onChange={vi.fn()} />);

        expect(
            screen.getByPlaceholderText('Cari nama/email rekan iDesk atau ketik email eksternal...')
        ).toBeInTheDocument();
    });

    it('renders internal user chip and external email chip properly', () => {
        render(
            <ZoomParticipantPicker
                value={['bagas@idesk.com', 'client@partner.org']}
                onChange={vi.fn()}
            />
        );

        // Internal user chip
        const internalChip = screen.getByTestId('participant-chip-bagas@idesk.com');
        expect(internalChip).toBeInTheDocument();
        expect(internalChip).toHaveTextContent('Bagas Developer');

        // External email chip
        const externalChip = screen.getByTestId('participant-chip-client@partner.org');
        expect(externalChip).toBeInTheDocument();
        expect(externalChip).toHaveTextContent('client@partner.org');
        expect(externalChip).toHaveTextContent('Eksternal');
    });

    it('filters users in popover based on query and selects user on click', () => {
        const onChange = vi.fn();
        render(<ZoomParticipantPicker value={[]} onChange={onChange} />);

        const input = screen.getByRole('textbox');
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: 'Anisa' } });

        expect(screen.getByTestId('user-option-u2')).toHaveTextContent('Anisa Marketing');
        expect(screen.queryByTestId('user-option-u1')).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId('user-option-u2'));
        expect(onChange).toHaveBeenCalledWith(['anisa@idesk.com']);
    });

    it('deselects an existing user when clicked in dropdown', () => {
        const onChange = vi.fn();
        render(
            <ZoomParticipantPicker
                value={['bagas@idesk.com']}
                onChange={onChange}
            />
        );

        const input = screen.getByRole('textbox');
        fireEvent.focus(input);

        // Option u1 is already selected
        const userOption = screen.getByTestId('user-option-u1');
        expect(userOption).toHaveTextContent('Terpilih');

        fireEvent.click(userOption);
        expect(onChange).toHaveBeenCalledWith([]);
    });

    it('removes participant chip when clicking remove x button', () => {
        const onChange = vi.fn();
        render(
            <ZoomParticipantPicker
                value={['bagas@idesk.com', 'vendor@consulting.com']}
                onChange={onChange}
            />
        );

        const removeBtn = screen.getByRole('button', { name: 'Hapus Bagas Developer' });
        fireEvent.click(removeBtn);

        expect(onChange).toHaveBeenCalledWith(['vendor@consulting.com']);
    });

    it('adds external email when typing valid email and pressing Enter', () => {
        const onChange = vi.fn();
        render(<ZoomParticipantPicker value={[]} onChange={onChange} />);

        const input = screen.getByRole('textbox');
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: 'support@vendor.co.id' } });

        // Shows action button in popover
        const addBtn = screen.getByTestId('add-external-email-btn');
        expect(addBtn).toHaveTextContent('support@vendor.co.id');

        fireEvent.keyDown(input, { key: 'Enter' });
        expect(onChange).toHaveBeenCalledWith(['support@vendor.co.id']);
    });

    it('removes last chip on Backspace when query is empty', () => {
        const onChange = vi.fn();
        render(
            <ZoomParticipantPicker
                value={['bagas@idesk.com', 'anisa@idesk.com']}
                onChange={onChange}
            />
        );

        const input = screen.getByRole('textbox');
        fireEvent.keyDown(input, { key: 'Backspace' });

        expect(onChange).toHaveBeenCalledWith(['bagas@idesk.com']);
    });
});
