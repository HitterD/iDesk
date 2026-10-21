import React from 'react';
import { History, MessageCircle, SlidersHorizontal } from 'lucide-react';
import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export type DetailTab = 'chat' | 'details' | 'activity';

/** Below lg the inspector has no column of its own, so it becomes a third segment. */
const DESKTOP_QUERY = '(min-width: 1024px)';

const CHAT: SegmentedOption<DetailTab> = { value: 'chat', label: 'Percakapan', icon: MessageCircle };
const DETAILS: SegmentedOption<DetailTab> = { value: 'details', label: 'Properti', icon: SlidersHorizontal };
const ACTIVITY: SegmentedOption<DetailTab> = { value: 'activity', label: 'Aktivitas', icon: History };

/** Mockup `.convo-head .seg`: Percakapan / Aktivitas (+ Properti on narrow screens). */
export const DetailTabs: React.FC<{ value: DetailTab; onChange: (tab: DetailTab) => void }> = ({ value, onChange }) => {
    const isDesktop = useMediaQuery(DESKTOP_QUERY);
    const options = isDesktop ? [CHAT, ACTIVITY] : [CHAT, DETAILS, ACTIVITY];
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
