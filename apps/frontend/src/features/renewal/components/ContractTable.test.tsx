import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ContractTable } from './ContractTable';
import { ContractStatus, type RenewalContract } from '../types/renewal.types';

const mutations = vi.hoisted(() => ({ ack: vi.fn(), unack: vi.fn() }));
vi.mock('../hooks/useRenewalApi', () => ({
    useAcknowledgeContract: () => ({ mutateAsync: mutations.ack }),
    useUnacknowledgeContract: () => ({ mutateAsync: mutations.unack }),
}));

it.each([true, false])('exposes edit and acknowledgement actions on mobile, acknowledged=%s', (isAcknowledged) => {
    const contract = { id: 'c1', poNumber: 'PO-1', status: ContractStatus.ACTIVE, isAcknowledged, endDate: null } as RenewalContract;
    const onEdit = vi.fn();
    render(<ContractTable contracts={[contract]} isLoading={false} onEdit={onEdit} onDelete={vi.fn()} onView={vi.fn()} />);
    const edit = screen.getByRole('button', { name: 'Edit PO-1' });
    expect(edit.closest('.res-hide-m')).toBeNull();
    fireEvent.click(edit);
    expect(onEdit).toHaveBeenCalledWith(contract);
    const acknowledge = screen.getByRole('button', { name: isAcknowledged ? 'Batalkan acknowledge PO-1' : 'Acknowledge PO-1' });
    expect(acknowledge.closest('.res-hide-m')).toBeNull();
    fireEvent.click(acknowledge);
    expect(isAcknowledged ? mutations.unack : mutations.ack).toHaveBeenCalledWith('c1');
});
