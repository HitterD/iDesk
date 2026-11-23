import { useRef, useState } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { addNasFolder, emailLocalPart, type EformForm, type NasRights, type NasServer } from './eformRules';

const NAS_SERVERS: NasServer[] = ['JKT', 'KRW', 'SMG', 'SPJ'];
const SHOTS_MAX = 5;
const SHOT_BYTES_MAX = 5 * 1024 * 1024;
const EMAIL_DOMAIN = '@kapalapi.co.id';

interface Props { form: EformForm; patch: (change: Partial<EformForm>) => void }

const Seg = <T extends string>({ value, options, onChange, label }: { value: T; options: Array<[T, string]>; onChange: (v: T) => void; label: string }) => (
    <div role="radiogroup" aria-label={label} className="req-dialog__seg">
        {options.map(([v, text]) => <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? 'is-on' : ''} onClick={() => onChange(v)}>{text}</button>)}
    </div>
);

/** The fields that belong to one kind of access. */
export function EformTypeFields({ form, patch }: Props) {
    switch (form.kind) {
        case 'VPN':
            return (
                <div className="req-dialog__choices" role="radiogroup" aria-label="Kebutuhan VPN">
                    {[['REMOTE', 'Remote PC kantor', 'Mengendalikan komputer kantor dari rumah.'], ['NETWORK', 'Akses jaringan kantor', 'Memakai sistem dan folder kantor dari laptop sendiri.']].map(([value, label, hint]) => (
                        <button key={value} type="button" role="radio" aria-checked={form.need === value} className={form.need === value ? 'is-on' : ''} onClick={() => patch({ need: value })}>
                            <b>{label}</b><span>{hint}</span>
                        </button>
                    ))}
                </div>
            );
        case 'WEBSITE':
            return <label className="req-dialog__field"><span>Website yang diminta *</span><textarea aria-label="Website yang diminta" placeholder="Satu per baris atau pisahkan koma" value={form.websites} onChange={(e) => patch({ websites: e.target.value })} /></label>;
        case 'NETWORK':
            return <label className="req-dialog__field"><span>Tujuan jaringan *</span><textarea aria-label="Tujuan jaringan" placeholder="Misal: akses printer jaringan gudang" value={form.net} onChange={(e) => patch({ net: e.target.value })} /></label>;
        case 'FLASHDISK':
            return (
                <>
                    <label className="req-dialog__field"><span>Hostname PC *</span><input aria-label="Hostname PC" value={form.host} onChange={(e) => patch({ host: e.target.value })} /></label>
                    <Seg label="Akses USB" value={form.usb} options={[['RO', 'Baca saja'], ['RW', 'Baca & tulis']]} onChange={(usb) => patch({ usb })} />
                    <label className="req-dialog__field"><span>Keterangan flashdisk</span><input aria-label="Keterangan flashdisk" placeholder="Merek, kapasitas, nomor seri (opsional)" value={form.fdInfo} onChange={(e) => patch({ fdInfo: e.target.value })} /></label>
                </>
            );
        case 'EMAIL':
            return (
                <>
                    <label className="req-dialog__field"><span>Usulan alamat email *</span>
                        <span className="req-emailin"><input aria-label="Usulan alamat email" placeholder="nama.belakang" value={form.email} onChange={(e) => patch({ email: emailLocalPart(e.target.value) })} /><i>{EMAIL_DOMAIN}</i></span>
                    </label>
                    <small>{form.email ? <>Akan menjadi <b>{form.email}{EMAIL_DOMAIN}</b></> : 'Huruf kecil, angka, titik, strip. Contoh: budi.santoso'}</small>
                    <Seg label="Jenis akun" value={form.emailType} options={[['PERSONAL', 'Pribadi'], ['SHARING', 'Bersama']]} onChange={(emailType) => patch({ emailType })} />
                </>
            );
        default:
            return <NasFields form={form} patch={patch} />;
    }
}

function NasFields({ form, patch }: Props) {
    const [server, setServer] = useState<NasServer>(form.servers[0] ?? 'SPJ');
    const [path, setPath] = useState('');
    const [rights, setRights] = useState<NasRights>('RO');
    const [folderError, setFolderError] = useState('');
    const [uploading, setUploading] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);

    const toggleServer = (id: NasServer) => {
        const servers = form.servers.includes(id) ? form.servers.filter((s) => s !== id) : [...form.servers, id];
        patch({ servers, folders: form.folders.filter((f) => servers.includes(f.srv)) });
        setServer(id);
    };
    const add = () => {
        const result = addNasFolder(form.folders, { srv: server, path, rw: rights });
        if ('error' in result) { setFolderError(result.error); return; }
        setFolderError('');
        setPath('');
        patch({ folders: result.folders });
    };
    const upload = async (files: FileList | null) => {
        const chosen = Array.from(files ?? []);
        if (chosen.length === 0) return;
        if (form.shots + chosen.length > SHOTS_MAX) { toast.error(`Maksimal ${SHOTS_MAX} screenshot.`); return; }
        const bad = chosen.find((f) => !f.type.startsWith('image/') || f.size > SHOT_BYTES_MAX);
        if (bad) { toast.error(`Berkas "${bad.name}" harus gambar dan maksimal 5MB.`); return; }
        setUploading(true);
        try {
            const body = new FormData();
            chosen.forEach((file) => body.append('files', file));
            const res = await api.post('/uploads', body, { headers: { 'Content-Type': 'multipart/form-data' } });
            if (res.data?.success && Array.isArray(res.data.urls)) patch({ shots: form.shots + res.data.urls.length });
            else toast.error('Gagal mengunggah screenshot.');
        } catch { toast.error('Terjadi kesalahan saat mengunggah screenshot.'); }
        finally { setUploading(false); if (fileInput.current) fileInput.current.value = ''; }
    };

    return (
        <>
            <Seg label="Akun Synology" value={form.acct} options={[['NEW', 'Belum punya akun'], ['EXISTING', 'Sudah punya akun']]} onChange={(acct) => patch({ acct })} />
            {form.acct === 'EXISTING' && <label className="req-dialog__field"><span>Nama akun Synology Anda *</span><input aria-label="Nama akun Synology" placeholder="Misal: leony.r" value={form.acctName} onChange={(e) => patch({ acctName: e.target.value })} /></label>}
            <div role="group" aria-label="Lokasi server" className="req-kindgrid">
                {NAS_SERVERS.map((id) => <button key={id} type="button" className={form.servers.includes(id) ? 'is-on' : ''} aria-pressed={form.servers.includes(id)} onClick={() => toggleServer(id)}>{id}</button>)}
            </div>
            <div className="req-nasadd">
                <select aria-label="Server folder" value={server} onChange={(e) => setServer(e.target.value as NasServer)}>{(form.servers.length ? form.servers : NAS_SERVERS).map((s) => <option key={s}>{s}</option>)}</select>
                <input aria-label="Path folder" placeholder="\\nas01\QC\Laporan atau /QC/Laporan" value={path} onChange={(e) => setPath(e.target.value)} />
                <select aria-label="Hak akses folder" value={rights} onChange={(e) => setRights(e.target.value as NasRights)}><option value="RO">Baca saja</option><option value="RW">Baca & tulis</option></select>
                <button type="button" className="req-btn" onClick={add}>Tambah folder</button>
            </div>
            {folderError && <p role="alert" className="req-dialog__error">{folderError}</p>}
            {form.folders.length > 0 && (
                <ul className="req-folders">
                    {form.folders.map((f, index) => (
                        <li key={`${f.srv}-${f.path}`}><span className="req-chip">{f.srv}</span><code>{f.path}</code><span>{f.rw === 'RW' ? 'Baca & tulis' : 'Baca saja'}</span>
                            <button type="button" aria-label={`Hapus folder ${f.path}`} onClick={() => patch({ folders: form.folders.filter((_, i) => i !== index) })}>×</button></li>
                    ))}
                </ul>
            )}
            <label className="req-dialog__field"><span>Screenshot folder (opsional, maks {SHOTS_MAX})</span>
                <input ref={fileInput} type="file" accept="image/*" multiple aria-label="Screenshot folder" disabled={uploading} onChange={(e) => void upload(e.target.files)} />
                {form.shots > 0 && <small>{form.shots} screenshot terlampir</small>}
            </label>
        </>
    );
}
