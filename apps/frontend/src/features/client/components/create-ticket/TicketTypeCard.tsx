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

/**
 * Compact catalogue card. The card owns the click so any press inside it selects the type,
 * even when pointerdown and pointerup land on different children; the action button stays
 * the keyboard/screen-reader entry and its click bubbles to the card (one call).
 */
export function TicketTypeCard({ title, description, mascotImg, mascotAlt, ctaLabel, onSelect }: TicketTypeCardProps) {
    return (
        <article className="ct-card" onClick={onSelect}>
            <h3>{title}</h3>
            <img src={mascotImg} alt={mascotAlt} loading="lazy" draggable={false} />
            <p>{description}</p>
            <button type="button" className="ct-link" aria-label={`Pilih ${title}`}>
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
