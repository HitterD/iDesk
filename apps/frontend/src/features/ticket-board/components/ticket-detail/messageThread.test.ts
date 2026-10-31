import {
    buildQuotedContent,
    parseQuote,
    findQuotedMessageId,
    toDisplayName,
    isSameDay,
    dateSeparatorLabel,
    QUOTE_SNIPPET_MAX,
    quoteKind,
    continuesGroup,
    ATTACHMENT_QUOTE,
    readTick,
} from './messageThread';

describe('messageThread - quoteKind', () => {
    it('recognises photo and attachment-only quotes', () => {
        expect(quoteKind('[📷 Photo]')).toBe('photo');
        expect(quoteKind(ATTACHMENT_QUOTE)).toBe('file');
        expect(quoteKind('')).toBe('file');
        expect(quoteKind('halo')).toBe('text');
    });
});

describe('messageThread - continuesGroup', () => {
    const base = { senderId: 'u1', isInternal: false, createdAt: '2026-10-06T05:00:00Z' };

    it('groups messages from the same sender within the window', () => {
        expect(continuesGroup(base, { ...base, createdAt: '2026-10-06T05:04:00Z' })).toBe(true);
    });

    it('breaks on sender, visibility, gap or missing previous', () => {
        expect(continuesGroup(base, { ...base, senderId: 'u2' })).toBe(false);
        expect(continuesGroup(base, { ...base, isInternal: true })).toBe(false);
        expect(continuesGroup(base, { ...base, createdAt: '2026-10-06T05:06:00Z' })).toBe(false);
        expect(continuesGroup(null, base)).toBe(false);
        expect(continuesGroup({ ...base, senderId: null }, { ...base, senderId: null })).toBe(false);
    });
});

describe('messageThread - parseQuote', () => {
    it('parses the format written by the composer', () => {
        const content = buildQuotedContent('Shannon', 'Pak Bagas, ini barusan', 'okeee');
        expect(parseQuote(content)).toEqual({ sender: 'Shannon', quote: 'Pak Bagas, ini barusan', body: 'okeee' });
    });

    it('tolerates CRLF, a variation selector and a missing space after the arrow', () => {
        const content = '↩️SHANNON STEPHANIE LIMAWAN: Pak Bagas, unit HP => keper…\r\n\r\nokeee shannon';
        expect(parseQuote(content)).toEqual({
            sender: 'SHANNON STEPHANIE LIMAWAN',
            quote: 'Pak Bagas, unit HP => keper…',
            body: 'okeee shannon',
        });
    });

    it('tolerates a single newline between quote and body', () => {
        expect(parseQuote('↩ A: halo\nbalasan')).toEqual({ sender: 'A', quote: 'halo', body: 'balasan' });
    });

    it('keeps multi-line bodies intact', () => {
        expect(parseQuote('↩ A: q\n\nbaris 1\nbaris 2')?.body).toBe('baris 1\nbaris 2');
    });

    it('returns null for plain messages', () => {
        expect(parseQuote('halo semua')).toBeNull();
        expect(parseQuote('')).toBeNull();
    });
});

describe('messageThread - buildQuotedContent', () => {
    it('truncates long quotes and flattens newlines so the format stays parseable', () => {
        const long = 'a'.repeat(QUOTE_SNIPPET_MAX + 10);
        const built = buildQuotedContent('B', `baris1\n${long}`, 'isi');
        const parsed = parseQuote(built);
        expect(parsed?.quote.endsWith('…')).toBe(true);
        expect(parsed?.quote).not.toContain('\n');
        expect(parsed?.body).toBe('isi');
    });

    it('quotes the body of a message that was itself a reply', () => {
        const nested = buildQuotedContent('A', 'pertanyaan', 'jawaban');
        expect(parseQuote(buildQuotedContent('B', nested, 'ok'))?.quote).toBe('jawaban');
    });
});

describe('messageThread - findQuotedMessageId', () => {
    const messages = [
        { id: '1', content: 'Pak Bagas, ini barusan baterainya dicoba lepas', createdAt: '2026-10-06T05:00:00Z', sender: { fullName: 'SHANNON' } },
        { id: '2', content: 'lain', createdAt: '2026-10-06T05:01:00Z', sender: { fullName: 'RM' } },
        { id: '3', content: '↩ SHANNON: Pak Bagas, ini…\n\nokeee', createdAt: '2026-10-06T06:00:00Z', sender: { fullName: 'RM' } },
    ];

    it('finds the latest earlier message by sender and prefix', () => {
        expect(findQuotedMessageId(messages, '3', { sender: 'SHANNON', quote: 'Pak Bagas, ini…', body: 'okeee' })).toBe('1');
    });

    it('matches the sender case-insensitively', () => {
        expect(findQuotedMessageId(messages, '3', { sender: 'Shannon', quote: 'Pak Bagas', body: '' })).toBe('1');
    });

    it('returns null when nothing matches', () => {
        expect(findQuotedMessageId(messages, '3', { sender: 'SHANNON', quote: 'tidak ada', body: '' })).toBeNull();
    });

    it('matches the body of a quoted message that was itself a reply', () => {
        expect(findQuotedMessageId([...messages, { id: '4', content: 'x', createdAt: '2026-10-06T07:00:00Z', sender: { fullName: 'S' } }], '4', { sender: 'RM', quote: 'okeee', body: '' })).toBe('3');
    });
});

describe('messageThread - toDisplayName', () => {
    it('title-cases all-caps names and keeps short particles readable', () => {
        expect(toDisplayName('MOH. ARIS')).toBe('Moh. Aris');
        expect(toDisplayName('RM BAGASTYO ANGGORO')).toBe('Rm Bagastyo Anggoro');
    });

    it('leaves mixed-case names untouched', () => {
        expect(toDisplayName('Amelia van Dijk')).toBe('Amelia van Dijk');
    });

    it('handles empty values', () => {
        expect(toDisplayName(undefined)).toBe('');
    });
});

describe('messageThread - dates', () => {
    const now = new Date('2026-10-06T10:00:00+07:00');

    it('compares days in WIB', () => {
        expect(isSameDay('2026-10-05T17:30:00Z', '2026-10-06T01:00:00Z')).toBe(true); // both 6 Okt WIB
        expect(isSameDay('2026-10-05T16:30:00Z', '2026-10-05T17:30:00Z')).toBe(false);
    });

    it('labels today, yesterday and older days', () => {
        expect(dateSeparatorLabel('2026-10-06T01:00:00Z', now)).toBe('Hari ini');
        expect(dateSeparatorLabel('2026-10-05T01:00:00Z', now)).toBe('Kemarin');
        expect(dateSeparatorLabel('2026-10-01T01:00:00Z', now)).toBe('1 Okt 2026');
    });
});

describe('readTick', () => {
    it('is sent while the other side has never read', () => {
        expect(readTick('2026-10-31T08:00:00Z', null)).toBe('sent');
        expect(readTick('2026-10-31T08:00:00Z', undefined)).toBe('sent');
    });
    it('is read once the other side read at or after the message', () => {
        expect(readTick('2026-10-31T08:00:00Z', '2026-10-31T08:00:00Z')).toBe('read');
        expect(readTick('2026-10-31T08:00:00Z', '2026-10-31T09:00:00Z')).toBe('read');
    });
    it('is sent when the last read predates the message', () => {
        expect(readTick('2026-10-31T08:00:00Z', '2026-10-31T07:59:59Z')).toBe('sent');
    });
});
