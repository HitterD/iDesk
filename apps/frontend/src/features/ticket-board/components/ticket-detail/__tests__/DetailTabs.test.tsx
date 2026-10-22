import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DetailTabs, countChatMessages } from '../DetailTabs';

vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => true }));

describe('DetailTabs', () => {
    it('counts only non-system messages, like the pre-redesign tab badge', () => {
        expect(countChatMessages([{ isSystemMessage: false }, { isSystemMessage: true }, {}])).toBe(2);
        expect(countChatMessages(undefined)).toBe(0);
    });

    it('shows the message count on "Percakapan" while keeping its accessible name', () => {
        render(<DetailTabs value="chat" onChange={vi.fn()} messageCount={7} />);
        const chat = screen.getByRole('button', { name: 'Percakapan' });
        expect(within(chat).getByTestId('chat-tab-count')).toHaveTextContent('7');
        expect(chat).toHaveAttribute('title', '7 pesan');
    });

    it('renders no badge when no count is given', () => {
        render(<DetailTabs value="chat" onChange={vi.fn()} />);
        expect(screen.queryByTestId('chat-tab-count')).not.toBeInTheDocument();
    });
});
