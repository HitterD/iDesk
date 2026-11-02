import { useState, type KeyboardEvent, type RefObject } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useMentionQuery, type MentionUser } from './MentionPicker';

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
    const query = useMentionQuery(text, caret, candidates);

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
    };

    /** Arrow keys / Enter / Tab drive the open picker; returns true when the key was used. */
    const handleKey = (event: KeyboardEvent): boolean =>
        query.active && candidates.length > 0 ? query.handleKey(event, candidates, pick) : false;

    /** Ids of picked people whose `@Name` is still in `content` (a deleted name is not a mention). */
    const idsIn = (content: string) => picked.filter((u) => content.includes(`@${u.fullName}`)).map((u) => u.id);

    const reset = () => {
        setText('');
        setCaret(0);
        setPicked([]);
    };

    return { candidates, active: query.active, query: query.query, index: query.index, setIndex: query.setIndex, track, pick, handleKey, idsIn, reset };
}
