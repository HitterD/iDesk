import React from 'react';
import { cssVars } from '@/features/dashboard/components/DashboardParts';
import { topicMeta } from './kbTopics';

interface TopicGridProps {
    /** Categories as stored in the database (GET /kb/categories). */
    categories: string[];
    onSelect: (category: string) => void;
    /** Active topic (pressed). */
    selected?: string;
}

/** Mockup kb.html `.topics`: ring icon + label per category, pressed state when filtering. */
export const TopicGrid: React.FC<TopicGridProps> = ({ categories, onSelect, selected }) => {
    if (categories.length === 0) return null;
    return (
        <nav aria-label="Topik panduan" className="kb-topics">
            {categories.map((category) => {
                const meta = topicMeta(category);
                const Icon = meta.icon;
                return (
                    <button key={category} type="button" className="kb-topic" aria-pressed={selected === category} onClick={() => onSelect(category)}>
                        <span className="kb-ring" style={cssVars({ '--c': meta.color })} aria-hidden="true"><Icon /></span>
                        {category}
                    </button>
                );
            })}
        </nav>
    );
};

export default TopicGrid;
