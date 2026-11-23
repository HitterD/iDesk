import { Check, ListChecks, X } from 'lucide-react';
import type { RequestFlowView } from './flowTypes';
import { stageInfo, type Stage } from './progress';

function StageBody({ stage }: { stage: Stage }) {
    if (stage.skipped) return <small>Dilewati</small>;
    if (stage.state === 'cur' || stage.state === 'no') {
        return (
            <ul className="req-subs">
                {stage.subs.map((sub) => (
                    <li key={sub.k} className={`req-sub req-sub--${sub.state}`}>
                        <i>{sub.state === 'done' ? <Check aria-hidden="true" /> : sub.state === 'no' ? <X aria-hidden="true" /> : null}</i>
                        <div><b>{sub.label}</b><span>{sub.state === 'skip' ? 'Tidak diperlukan' : sub.who}</span></div>
                    </li>
                ))}
            </ul>
        );
    }
    const live = stage.subs.filter((sub) => sub.state !== 'skip');
    if (stage.state === 'done') return <small>{live.map((sub) => sub.who || sub.label).slice(-1)[0] ?? ''}</small>;
    return <small>{live.map((sub) => sub.label).join(' · ')}</small>;
}

/** The step-by-step progress of a request ticket: big numbered stages, sub-steps only inside the one being worked on. */
export function ProgressCard({ view }: { view: RequestFlowView }) {
    const { stages, curIdx } = stageInfo(view);
    const label = view.phase === 'done' ? 'Selesai' : view.phase === 'rejected' ? 'Ditolak' : `Tahap ${curIdx + 1} dari ${stages.length}`;
    return (
        <section className={`req-card req-pcard req-pcard--${view.kind === 'HARDWARE' ? 'hw' : 'ef'}`} aria-label="Progres">
            <h3><ListChecks aria-hidden="true" />Progres <span className="r">{label}</span></h3>
            <ol className="req-stages">
                {stages.map((stage, index) => (
                    <li key={stage.name} className={`req-stg req-stg--${stage.skipped ? 'done' : stage.state}`}>
                        <span className="req-stg__n">
                            {stage.state === 'done' || stage.skipped ? <Check aria-hidden="true" /> : stage.state === 'no' ? <X aria-hidden="true" /> : index + 1}
                        </span>
                        <div className="req-stg__body">
                            <div className="req-stg__head">
                                <b>{stage.name}</b>
                                {stage.state === 'cur' && <span className="req-now">Sekarang</span>}
                            </div>
                            <StageBody stage={stage} />
                        </div>
                    </li>
                ))}
            </ol>
        </section>
    );
}
