import React from 'react';
import { History, MessageCircle, SlidersHorizontal } from 'lucide-react';
import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export type DetailTab = 'chat' | 'details' | 'activity';

/** Below lg the inspector has no column of its own, so it becomes a third segment. */
const DESKTOP_QUERY = '(min-width: 1024px)';

const chatOption = (messageCount: number | undefined): SegmentedOption<DetailTab> => ({
    value: 'chat',
    icon: MessageCircle,
    title: messageCount === undefined ? undefined : `${messageCount} pesan`,
    // The count is visual only, so the segment keeps "Percakapan" as its accessible name.
    label: messageCount === undefined ? 'Percakapan' : (
        <>Percakapan<span className="td-tab-count" aria-hidden="true" data-testid="chat-tab-count">{messageCount}</span></>
    ),
});
const DETAILS: SegmentedOption<DetailTab> = { value: 'details', label: 'Properti', icon: SlidersHorizontal };
const ACTIVITY: SegmentedOption<DetailTab> = { value: 'activity', label: 'Aktivitas', icon: History };

/** Non-system messages, as counted on the "Percakapan" tab (same rule as before the redesign). */
export const countChatMessages = (messages: ReadonlyArray<{ isSystemMessage?: boolean }> | undefined): number =>
    messages?.filter(m => !m.isSystemMessage).length ?? 0;

interface DetailTabsProps {
    value: DetailTab;
    onChange: (tab: DetailTab) => void;
    /** Badge on the "Percakapan" segment; omitted → no badge. */
    messageCount?: number;
}

/** Mockup `.convo-head .seg`: Percakapan / Aktivitas (+ Properti on narrow screens). */
export const DetailTabs: React.FC<DetailTabsProps> = ({ value, onChange, messageCount }) => {
    const isDesktop = useMediaQuery(DESKTOP_QUERY);
    const chat = chatOption(messageCount);
    const options = isDesktop ? [chat, ACTIVITY] : [chat, DETAILS, ACTIVITY];
    // Leaving desktop "details" (panel toggle on a narrow window) falls back to the conversation.
    const shown = isDesktop && value === 'details' ? 'chat' : value;
    return (
        <SegmentedControl
            options={options}
            value={shown}
            onValueChange={onChange}
            aria-label="Tampilan tiket"
            className="td-tabs"
        />
    );
};
