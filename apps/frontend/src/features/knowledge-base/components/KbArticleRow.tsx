import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cssVars } from '@/features/dashboard/components/DashboardParts';
import { readingMinutes, relativeDate } from '@/components/ui/ArticleListRow';
import { topicMeta } from './kbTopics';

interface KbArticleRowProps {
    article: { id: string; title: string; content?: string; category?: string; viewCount?: number; updatedAt?: string; createdAt?: string };
    to: string;
    /** Featured guide label ("Mulai di sini" / "Sudah dibaca"). */
    start?: string;
    onOpen?: () => void;
}

const EXCERPT_CHARS = 90;

/** First sentence of the body, stripped of markdown, as the mockup excerpt line. */
const excerpt = (content?: string) => {
    if (!content) return '';
    const text = content.replace(/```[\s\S]*?```/g, ' ').replace(/[#>*_`[\]()!-]/g, ' ').replace(/\s+/g, ' ').trim();
    return text.length > EXCERPT_CHARS ? `${text.slice(0, EXCERPT_CHARS).trimEnd()}…` : text;
};

/** Mockup `.art`: topic ring · title · "<category> · excerpt" · "N views · diperbarui X" · chevron. */
export function KbArticleRow({ article, to, start, onOpen }: KbArticleRowProps) {
    const meta = topicMeta(article.category);
    const Icon = meta.icon;
    const updated = relativeDate(article.updatedAt || article.createdAt);
    const views = article.viewCount ? `${article.viewCount.toLocaleString('id-ID')} views` : `${readingMinutes(article.content)} mnt baca`;
    const ex = excerpt(article.content);
    return (
        <Link to={to} className="kb-art" onClick={onOpen}>
            <span className="kb-ring" style={cssVars({ '--c': meta.color })} aria-hidden="true"><Icon /></span>
            <div>
                <b>{article.title}</b>
                <small>{start ? <em className="kb-art-start">{start}</em> : <em>{article.category || 'General'}</em>}{ex ? ` · ${ex}` : ''}</small>
                <small>{views}{updated ? ` · diperbarui ${updated}` : ''}</small>
            </div>
            <ChevronRight aria-hidden="true" />
        </Link>
    );
}
