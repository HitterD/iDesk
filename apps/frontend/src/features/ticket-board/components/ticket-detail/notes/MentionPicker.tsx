import { useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/UserAvatar';
import type { NoteUser } from './types';

/** Text after an "@" at a word start, up to the caret (names may contain spaces). */
const MENTION_PATTERN = /(^|\s)@([^@\n]{0,40})$/;

export function filterMembers(users: NoteUser[], query: string): NoteUser[] {
    const q = query.trim().toLowerCase();
    return users.filter(user => user.fullName.toLowerCase().includes(q));
}

/** `caret` is tracked by the caller from change/select events, not read from the element mid-render. */
export function useMentionQuery(value: string, caret: number, users: NoteUser[]) {
    const [index, setIndex] = useState(0);
    const match = MENTION_PATTERN.exec(value.slice(0, caret));
    const query = match?.[2] ?? '';
    // A picked name is followed by a space: the mention is complete, stop suggesting.
    const completed = /\s$/.test(query) && users.some(user => user.fullName.toLowerCase() === query.trim().toLowerCase());
    const replace = (name: string) => {
        const start = caret - query.length - 1;
        const insert = `@${name} `;
        return { value: value.slice(0, start) + insert + value.slice(caret), caret: start + insert.length };
    };
    const handleKey = (e: KeyboardEvent, users: NoteUser[], pick: (user: NoteUser) => void): boolean => {
        const list = filterMembers(users, query);
        if (!list.length) return false;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setIndex(current => (current + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length);
            return true;
        }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(list[Math.min(index, list.length - 1)]); setIndex(0); return true; }
        return false;
    };
    return { active: Boolean(match) && !completed, query, index, setIndex, replace, handleKey };
}

interface Props { query: string; users: NoteUser[]; highlight: number; onHighlight: (index: number) => void; onPick: (user: NoteUser) => void }

export function MentionPicker({ query, users, highlight, onHighlight, onPick }: Props) {
    const list = filterMembers(users, query);
    if (!list.length) return null;
    return <ul role="listbox" aria-label="Sebut anggota"
        className="absolute bottom-full left-3 right-3 z-20 mb-1 max-h-48 overflow-y-auto rounded-xl border bg-popover p-1 shadow-lg">
        {list.map((user, i) => <li key={user.id} role="option" aria-selected={i === highlight}
            className={cn('flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm', i === highlight && 'bg-muted')}
            onMouseEnter={() => onHighlight(i)} onMouseDown={e => { e.preventDefault(); onPick(user); }} onClick={() => onPick(user)}>
            <UserAvatar user={user} size="xs" className="h-6 w-6 rounded-full text-[10px]" />{user.fullName}</li>)}
    </ul>;
}
