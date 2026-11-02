import React, { useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/UserAvatar';

/** Someone who can be @mentioned (chat candidates and private-note members). */
export interface MentionUser { id: string; fullName: string; avatarUrl?: string | null }

/** Text after an "@" at a word start, up to the caret (names may contain spaces). */
const MENTION_PATTERN = /(^|\s)@([^@\n]{0,40})$/;

export function filterMembers<U extends MentionUser>(users: U[], query: string): U[] {
    const q = query.trim().toLowerCase();
    return users.filter(user => user.fullName.toLowerCase().includes(q));
}

/** `caret` is tracked by the caller from change/select events, not read from the element mid-render. */
export function useMentionQuery<U extends MentionUser>(value: string, caret: number, users: U[]) {
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
    const handleKey = (e: KeyboardEvent, users: U[], pick: (user: U) => void): boolean => {
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

interface Props<U extends MentionUser> {
    query: string; users: U[]; highlight: number; onHighlight: (index: number) => void; onPick: (user: U) => void;
    /** Accessible name of the list (notes: members; chat: people on the ticket). */
    label?: string;
}

export function MentionPicker<U extends MentionUser>({ query, users, highlight, onHighlight, onPick, label = 'Sebut anggota' }: Props<U>) {
    const list = filterMembers(users, query);
    if (!list.length) return null;
    return <ul role="listbox" aria-label={label}
        className="absolute bottom-full left-3 right-3 z-20 mb-1 max-h-48 overflow-y-auto rounded-xl border bg-popover p-1 shadow-lg">
        {list.map((user, i) => <li key={user.id} role="option" aria-selected={i === highlight}
            className={cn('flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm', i === highlight && 'bg-muted')}
            onMouseEnter={() => onHighlight(i)} onMouseDown={e => { e.preventDefault(); onPick(user); }} onClick={() => onPick(user)}>
            <UserAvatar user={user} size="xs" className="h-6 w-6 rounded-full text-[10px]" />{user.fullName}</li>)}
    </ul>;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Text with each `@Name` of a mentioned person wrapped for display. Only names the message really
 * mentions (by id) are marked, so typing "@something" by hand never looks like a mention.
 */
export function highlightMentions(text: string, people: MentionUser[], render: (name: string, key: number) => React.ReactNode) {
    const names = people.map((user) => `@${user.fullName}`);
    if (!names.length) return text;
    const pattern = new RegExp(`(${names.map(escapeRegExp).join('|')})`, 'g');
    return text.split(pattern).map((part, i) => (names.includes(part) ? render(part, i) : part));
}
