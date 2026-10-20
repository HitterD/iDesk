import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';

export interface TicketTypeCardProps {
    title: string;
    description: string;
    mascotImg: string;
    mascotAlt: string;
    ctaLabel: string;
    onSelect: () => void;
}

/** Compact catalogue card: the whole surface is the hit area via the stretched action link. */
export function TicketTypeCard({ title, description, mascotImg, mascotAlt, ctaLabel, onSelect }: TicketTypeCardProps) {
    return (
        <article className="ct-card">
            <h3>{title}</h3>
            <img src={mascotImg} alt={mascotAlt} loading="lazy" draggable={false} />
            <p>{description}</p>
            <button type="button" className="ct-link" aria-label={`Pilih ${title}`} onClick={onSelect}>
                {ctaLabel}
                <ArrowRight aria-hidden="true" />
            </button>
        </article>
    );
}

export interface TicketCatalogSectionProps {
    id: string;
    title: string;
    description: string;
    children: ReactNode;
}

export function TicketCatalogSection({ id, title, description, children }: TicketCatalogSectionProps) {
    return (
        <section aria-labelledby={id} className="ct-section">
            <h2 id={id}>{title}</h2>
            <p>{description}</p>
            <div className="ct-catalog">{children}</div>
        </section>
    );
}
