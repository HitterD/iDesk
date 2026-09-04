import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  CannedResponsePicker,
  SlashCommandAutocomplete,
  applyPlaceholders,
  CannedResponsesManager,
} from '../CannedResponses';

const mockReplies = [
  {
    id: '1',
    title: 'Greeting',
    content: 'Halo {user_name}, terima kasih telah menghubungi iDesk Support. Saya {agent_name} akan membantu menyelesaikan masalah Anda.',
    category: 'General',
    shortcut: '/hi',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Request More Info',
    content: 'Untuk membantu menyelesaikan masalah pada tiket #{ticket_id}, mohon kirimkan screenshot error.',
    category: 'General',
    shortcut: '/info',
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    title: 'Ticket Escalated',
    content: 'Tiket #{ticket_id} Anda telah di-eskalasi ke tim teknis.',
    category: 'Status Update',
    shortcut: '/esc',
    createdAt: new Date().toISOString(),
  },
  {
    id: '4',
    title: 'Waiting for Vendor',
    content: 'Kami sedang menunggu respons dari vendor terkait untuk issue ini.',
    category: 'Status Update',
    shortcut: '/vendor',
    createdAt: new Date().toISOString(),
  },
];

vi.mock('@/features/ticket-board/hooks/useSavedReplies', () => ({
  useSavedReplies: () => ({
    data: mockReplies,
    isLoading: false,
  }),
  useCreateSavedReply: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useUpdateSavedReply: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useDeleteSavedReply: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useResetSavedReplies: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

const renderWithQueryClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
};

describe('Dynamic Placeholder Parser', () => {
  it('correctly replaces {user_name}, {agent_name}, and {ticket_id}', () => {
    const raw = 'Halo {user_name}, saya {agent_name}. Tiket #{ticket_id} sedang diproses.';
    const parsed = applyPlaceholders(raw, {
      user_name: 'Budi Santoso',
      agent_name: 'Agent John',
      ticket_id: '12345',
    });

    expect(parsed).toBe('Halo Budi Santoso, saya Agent John. Tiket #12345 sedang diproses.');
  });
});

describe('SlashCommandAutocomplete', () => {
  it('renders matching shortcuts when opened', () => {
    const onSelect = vi.fn();
    renderWithQueryClient(
      <SlashCommandAutocomplete
        query="/hi"
        isOpen={true}
        onClose={vi.fn()}
        onSelect={onSelect}
        variables={{ user_name: 'Budi', agent_name: 'Alex', ticket_id: 'T-100' }}
      />
    );

    expect(screen.getByText('/hi')).toBeInTheDocument();
    expect(screen.getByText('Greeting')).toBeInTheDocument();
  });

  it('calls onSelect when shortcut item is clicked', () => {
    const onSelect = vi.fn();
    renderWithQueryClient(
      <SlashCommandAutocomplete
        query="/hi"
        isOpen={true}
        onClose={vi.fn()}
        onSelect={onSelect}
        variables={{ user_name: 'Budi', agent_name: 'Alex', ticket_id: 'T-100' }}
      />
    );

    const greetingItem = screen.getByText('Greeting');
    fireEvent.click(greetingItem.closest('button')!);

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
      id: '1',
      title: 'Greeting',
    }));
  });
});

describe('CannedResponsePicker', () => {
  it('renders trigger button and opens popover on click', async () => {
    const onSelect = vi.fn();
    renderWithQueryClient(
      <CannedResponsePicker
        onSelect={onSelect}
        variables={{ user_name: 'Budi', agent_name: 'Alex', ticket_id: 'T-100' }}
      />
    );

    const triggerBtn = screen.getByRole('button', { name: /buka template quick reply/i });
    expect(triggerBtn).toBeInTheDocument();

    fireEvent.click(triggerBtn);

    const searchInput = await screen.findByPlaceholderText(/cari template/i);
    expect(searchInput).toBeInTheDocument();

    expect(screen.getByText('Greeting')).toBeInTheDocument();
    expect(screen.getByText('/hi')).toBeInTheDocument();
    expect(screen.getByText('Request More Info')).toBeInTheDocument();
  });

  it('selects template and parses dynamic variables', async () => {
    const onSelect = vi.fn();
    renderWithQueryClient(
      <CannedResponsePicker
        onSelect={onSelect}
        variables={{ user_name: 'Budi', agent_name: 'Alex', ticket_id: 'T-100' }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /buka template quick reply/i }));

    const greetingItem = await screen.findByText('Greeting');
    fireEvent.click(greetingItem.closest('button')!);

    expect(onSelect).toHaveBeenCalledWith(expect.stringContaining('Halo Budi, terima kasih telah menghubungi iDesk Support. Saya Alex'));
  });
});

describe('CannedResponsesManager', () => {
  it('renders list of templates with actions', () => {
    renderWithQueryClient(<CannedResponsesManager />);

    expect(screen.getByText('Kustom Quick Reply Profil')).toBeInTheDocument();
    expect(screen.getByText('Greeting')).toBeInTheDocument();
    expect(screen.getAllByText('/hi').length).toBeGreaterThan(0);
    expect(screen.getByText('Ticket Escalated')).toBeInTheDocument();
    expect(screen.getAllByText('/esc').length).toBeGreaterThan(0);
  });
});
