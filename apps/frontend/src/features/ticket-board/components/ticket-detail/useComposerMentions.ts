import { useState, type KeyboardEvent, type RefObject } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useMentionQuery, type MentionUser } from './MentionPicker';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const countOf = (text: string, needle: string) => text.split(needle).length - 1;

/** People the viewer may @mention on this ticket (the server decides; cached for the session). */
export function useMentionCandidates(ticketId: string | undefined) {
    return useQuery<MentionUser[]>({
        queryKey: ['ticket', ticketId, 'mention-candidates'],
        queryFn: async () => (await api.get(`/tickets/${ticketId}/mention-candidates`)).data,
        enabled: Boolean(ticketId),
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * @mentions in the chat composer, which keeps its text in the textarea (uncontrolled). Tracks the
 * text and caret from input events, offers the picker, and on send returns only the ids whose
 * `@Name` is still in the text.
 */
export function useComposerMentions(inputRef: RefObject<HTMLTextAreaElement | null>, ticketId: string | undefined) {
    const { data: candidates = [] } = useMentionCandidates(ticketId);
    const [text, setText] = useState('');
    const [caret, setCaret] = useState(0);
    const [picked, setPicked] = useState<MentionUser[]>([]);
    /** Position of the "@" the user dismissed with Escape; the picker stays closed for it. */
    const [dismissedAt, setDismissedAt] = useState<number | null>(null);
    const query = useMentionQuery(text, caret, candidates);
    const atIndex = query.active ? caret - query.query.length - 1 : null;
    const active = query.active && atIndex !== dismissedAt;

    const track = () => {
        const input = inputRef.current;
        if (!input) return;
        setText(input.value);
        setCaret(input.selectionStart ?? input.value.length);
    };

    const pick = (user: MentionUser) => {
        const input = inputRef.current;
        if (!input) return;
        const next = query.replace(user.fullName);
        input.value = next.value;
        input.setSelectionRange(next.caret, next.caret);
        input.focus();
        setText(next.value);
        setCaret(next.caret);
        setPicked((current) => (current.some((u) => u.id === user.id) ? current : [...current, user]));
        setDismissedAt(null);
    };

    /** Arrow keys / Enter / Tab drive the open picker, Escape closes it; returns true when the key was used. */
    const handleKey = (event: KeyboardEvent): boolean => {
        if (!active || candidates.length === 0 || event.nativeEvent.isComposing) return false;
        if (event.key === 'Escape') {
            event.preventDefault();
            setDismissedAt(atIndex);
            return true;
        }
        return query.handleKey(event, candidates, pick);
    };

    /**
     * Ids of picked people whose `@Name` is still in `content` as a whole name (a deleted name is not a
     * mention, and "@Andi" inside "@Andi Tan" does not count as Andi).
     */
    const idsIn = (content: string) => picked
        .filter((u) => new RegExp(`(^|\\s)@${escapeRegExp(u.fullName)}(?![\\p{L}\\p{N}])`, 'u').test(content)
            && !picked.some((longer) => longer.fullName.length > u.fullName.length
                && longer.fullName.startsWith(`${u.fullName} `)
                && countOf(content, `@${longer.fullName}`) >= countOf(content, `@${u.fullName}`)))
        .map((u) => u.id);

    const reset = () => {
        setText('');
        setCaret(0);
        setPicked([]);
        setDismissedAt(null);
    };

    return { candidates, active, query: query.query, index: query.index, setIndex: query.setIndex, track, pick, handleKey, idsIn, reset };
}
