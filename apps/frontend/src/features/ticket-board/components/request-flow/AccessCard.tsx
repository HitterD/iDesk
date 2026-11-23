import { KeyRound, Pencil } from 'lucide-react';
import type { RequestFlowView } from './flowTypes';

const KIND_LABEL: Record<string, string> = {
    VPN: 'VPN', WEBSITE: 'Website', NETWORK: 'Network', FLASHDISK: 'Flashdisk', EMAIL: 'Email', SYNOLOGY_NAS: 'Synology NAS',
};

const day = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' });
const dayOf = (value: string): string => day.format(new Date(`${value}T00:00:00+07:00`));

interface AccessCardProps {
    eform: NonNullable<RequestFlowView['eform']>;
    /** Only IT gets this: the number is printed on the document. */
    onEditNumber?: () => void;
}

/** The access that was asked for: kind, document number, validity. */
export function AccessCard({ eform, onEditNumber }: AccessCardProps) {
    return (
        <section className="req-card" aria-label="Akses">
            <h3><KeyRound aria-hidden="true" />Akses</h3>
            <dl className="req-kv">
                <div><dt>Jenis</dt><dd>{KIND_LABEL[eform.formType] ?? eform.formType}</dd></div>
                <div>
                    <dt>Nomor dokumen</dt>
                    <dd>
                        {eform.documentNumber || '-'}
                        {onEditNumber && <button type="button" className="req-link" aria-label="Ubah nomor dokumen" onClick={onEditNumber}><Pencil aria-hidden="true" />Ubah nomor</button>}
                    </dd>
                </div>
                <div><dt>Mulai</dt><dd>{eform.startDate ? dayOf(eform.startDate) : '-'}</dd></div>
                <div><dt>Berakhir</dt><dd>{eform.endDate ? dayOf(eform.endDate) : 'Permanen'}</dd></div>
                {eform.fields.alasan && <div><dt>Alasan</dt><dd>{eform.fields.alasan}</dd></div>}
            </dl>
        </section>
    );
}
