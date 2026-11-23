import { useEffect, useRef, useState } from 'react';
import { Ellipsis, Hourglass, User } from 'lucide-react';
import type { RequestFlowView } from './flowTypes';
import { useAuth } from '@/stores/useAuth';
import { nextStep, type StepAction } from './nextStep';
import { stageInfo } from './progress';
import { stepIcon } from './stepIcons';

interface NextStepBarProps {
    view: RequestFlowView;
    /** Runs the dialog or call behind an action name (`review`, `approve`, `confirm`, ...). */
    onAct: (act: string) => void;
}

function ActionButton({ action, primary, onAct }: { action: StepAction; primary?: boolean; onAct: (act: string) => void }) {
    const Icon = stepIcon(action.icon);
    return (
        <button
            type="button"
            data-primary={primary ? 'true' : undefined}
            className={`req-btn ${primary ? 'req-btn--primary' : ''} ${action.cls ? `req-btn--${action.cls}` : ''}`}
            onClick={() => onAct(action.act)}
        >
            {Icon && <Icon aria-hidden="true" />}
            {action.label}
        </button>
    );
}

/** The one bar under the ticket header: what happens next, who is up, and the single button to press. */
export function NextStepBar({ view, onAct }: NextStepBarProps) {
    const { user } = useAuth();
    const step = nextStep(view, user?.id);
    const { stages, curIdx } = stageInfo(view);
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const Icon = stepIcon(step.icon);
    const finished = view.phase === 'done' || view.phase === 'rejected';
    const stageText = finished ? (view.phase === 'done' ? 'Selesai' : 'Ditolak') : `Tahap ${curIdx + 1}/${stages.length} · ${stages[curIdx].name}`;

    useEffect(() => {
        if (!menuOpen) return;
        const close = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [menuOpen]);

    return (
        <div className={`req-next ${step.mine ? 'req-next--mine' : `req-next--${step.tone}`}`} role="region" aria-label="Langkah berikutnya">
            <span className="req-next__icon">{Icon && <Icon aria-hidden="true" />}</span>
            <div className="req-next__text">
                <span className="req-next__stage">
                    {step.mine
                        ? <span className="req-turn req-turn--mine"><User aria-hidden="true" />Giliran Anda</span>
                        : <span className="req-turn"><Hourglass aria-hidden="true" />Bukan giliran Anda</span>}
                    <span>{stageText}</span>
                </span>
                <b>{step.title}</b>
                {step.sub && <span className="req-next__sub">{step.sub}</span>}
            </div>
            <div className="req-next__buttons">
                {step.more.length > 0 && (
                    <div className="req-menu" ref={menuRef}>
                        <button type="button" className="req-btn req-btn--ghost" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
                            <Ellipsis aria-hidden="true" />Lainnya
                        </button>
                        {menuOpen && (
                            <div className="req-menu__list" role="menu">
                                {step.more.map((item) => {
                                    const ItemIcon = stepIcon(item.icon);
                                    return (
                                        <button
                                            key={item.act} type="button" role="menuitem" className={item.danger ? 'is-danger' : ''}
                                            onClick={() => { setMenuOpen(false); onAct(item.act); }}
                                        >
                                            {ItemIcon && <ItemIcon aria-hidden="true" />}{item.label}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
                {step.second && <ActionButton action={step.second} onAct={onAct} />}
                {step.primary && <ActionButton action={step.primary} primary onAct={onAct} />}
            </div>
        </div>
    );
}
