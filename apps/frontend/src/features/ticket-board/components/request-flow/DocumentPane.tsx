import { Download, FileCheck } from 'lucide-react';
import type { FlowRevision } from './flowTypes';

const when = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

interface DocumentPaneProps {
    revisions: FlowRevision[];
    /** Downloads the PDF of a version (only the latest can be rendered). */
    onDownload: (version: number) => void;
}

/** The single document of the ticket: every signature or change added a version; the latest is the one to download. */
export function DocumentPane({ revisions, onDownload }: DocumentPaneProps) {
    const ordered = [...revisions].sort((a, b) => b.version - a.version);
    const latest = ordered[0]?.version;
    return (
        <section className="req-card" aria-label="Dokumen">
            <h3><FileCheck aria-hidden="true" />Dokumen {latest !== undefined && <span className="r">v{latest}</span>}</h3>
            {latest !== undefined && (
                <button type="button" className="req-btn" onClick={() => onDownload(latest)}><Download aria-hidden="true" />Unduh dokumen v{latest}</button>
            )}
            <ol className="req-revs">
                {ordered.map((revision) => (
                    <li key={revision.version}>
                        <span className="req-revs__v">v{revision.version}</span>
                        <div>
                            <b data-testid="revision-label">{revision.label}</b>
                            <small>{revision.actorName ? `${revision.actorName} · ` : ''}{when.format(new Date(revision.createdAt))}</small>
                        </div>
                        {revision.version === latest && <span className="req-now">Terbaru</span>}
                    </li>
                ))}
            </ol>
        </section>
    );
}
