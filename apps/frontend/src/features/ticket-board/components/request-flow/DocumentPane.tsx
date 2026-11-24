import { ChevronRight, Download, FileCheck, FileText, Printer, Upload } from 'lucide-react';
import type { FlowRevision } from './flowTypes';

const when = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

const KIND_LABEL: Record<FlowRevision['kind'], string> = { GEN: 'Dibuat', DIG: 'TTD digital', IMP: 'Impor kertas', FIN: 'Final' };

const latestOf = (revisions: FlowRevision[]): FlowRevision | undefined =>
    revisions.reduce<FlowRevision | undefined>((top, r) => (!top || r.version > top.version ? r : top), undefined);

interface DocumentPaneProps {
    revisions: FlowRevision[];
    /** Object URL of the latest version's PDF, once loaded; null while loading or when it failed. */
    previewUrl: string | null;
    previewError?: boolean;
    onDownload: (version: number) => void;
    onPrint?: () => void;
    onImport?: () => void;
}

/** The "Dokumen" tab (mockup renderDocPane): the PDF itself on the left, the actions and the version history on the right. */
export function DocumentPane({ revisions, previewUrl, previewError = false, onDownload, onPrint, onImport }: DocumentPaneProps) {
    const ordered = [...revisions].sort((a, b) => b.version - a.version);
    const latest = ordered[0]?.version;
    return (
        <div className="req-docpane">
            <section className="req-card req-docpane__paper" aria-label="Pratinjau dokumen">
                {latest === undefined ? <p className="req-muted">Belum ada dokumen.</p>
                    : previewError ? <p role="alert" className="req-dialog__error">Pratinjau gagal dimuat. Unduh dokumennya untuk melihat isinya.</p>
                        : previewUrl ? <iframe src={`${previewUrl}#navpanes=0&view=FitH`} title={`Pratinjau dokumen v${latest}`} className="req-docpane__frame" />
                            : <p aria-busy="true" className="req-muted">Memuat pratinjau…</p>}
            </section>
            <div className="req-docpane__side">
                <section className="req-card" aria-label="Dokumen">
                    <h3><FileCheck aria-hidden="true" />Satu dokumen, satu sumber</h3>
                    <p className="req-muted">Setiap tanda tangan, digital maupun kertas, masuk ke dokumen yang sama. Impor hanya diterima jika QR cocok dengan versi terakhir.</p>
                    {latest !== undefined && (
                        <div className="req-btnrow">
                            <button type="button" className="req-btn req-btn--sm" onClick={() => onDownload(latest)}><Download aria-hidden="true" />Unduh v{latest}</button>
                            {onPrint && <button type="button" className="req-btn req-btn--sm" onClick={onPrint} disabled={!previewUrl}><Printer aria-hidden="true" />Cetak</button>}
                            {onImport && <button type="button" className="req-btn req-btn--sm req-btn--navy" onClick={onImport}><Upload aria-hidden="true" />Impor bertanda tangan</button>}
                        </div>
                    )}
                </section>
                <section className="req-card" aria-label="Riwayat versi">
                    <h3>Riwayat versi</h3>
                    <ol className="req-revs">
                        {ordered.map((revision) => (
                            <li key={revision.version} className={revision.version === latest ? 'is-cur' : ''}>
                                <span className="req-revs__v">v{revision.version}</span>
                                <div>
                                    <b data-testid="revision-label">{revision.label}</b>
                                    <small>{revision.actorName ? `${revision.actorName} · ` : ''}{when.format(new Date(revision.createdAt))}</small>
                                </div>
                                <span className="req-revs__kind">{KIND_LABEL[revision.kind] ?? revision.kind}</span>
                            </li>
                        ))}
                    </ol>
                </section>
            </div>
        </div>
    );
}

interface DocumentMiniProps {
    revisions: FlowRevision[];
    onOpen: () => void;
}

/** The inspector's document card (mockup `docmini`): one row with the version and its last change, opening the Dokumen tab. */
export function DocumentMini({ revisions, onOpen }: DocumentMiniProps) {
    const latest = latestOf(revisions);
    if (!latest) return null;
    return (
        <section className="req-card" aria-label="Dokumen ringkas">
            <h3><FileCheck aria-hidden="true" />Dokumen</h3>
            <button type="button" className="req-docmini" onClick={onOpen} aria-label={`Dokumen v${latest.version}: ${latest.label}`}>
                <span className="req-docmini__fi"><FileText aria-hidden="true" /><em>v{latest.version}</em></span>
                <span className="req-docmini__txt"><b>Dokumen v{latest.version}</b><span>{latest.label}</span></span>
                <ChevronRight aria-hidden="true" />
            </button>
        </section>
    );
}
