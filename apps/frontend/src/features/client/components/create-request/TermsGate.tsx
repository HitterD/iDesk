import { useState } from 'react';

const SCROLL_TOLERANCE_PX = 4;

const TERMS = [
    'Akses hanya digunakan untuk keperluan kerja yang disebutkan dalam pengajuan ini.',
    'Pemohon menjaga kerahasiaan akun, kata sandi, dan data perusahaan yang diakses.',
    'Akses tidak boleh dipindahtangankan atau dipakai orang lain.',
    'IT berhak mencabut akses bila ditemukan penyalahgunaan atau masa berlaku berakhir.',
    'Seluruh aktivitas akses dapat dicatat dan diaudit.',
];

interface TermsGateProps {
    kindLabel: string;
    accepted: boolean;
    onAccept: (accepted: boolean) => void;
}

/** The terms of use: the agreement box only turns on once the text was read to the bottom. */
export function TermsGate({ kindLabel, accepted, onAccept }: TermsGateProps) {
    const [read, setRead] = useState(false);
    const check = (box: HTMLElement) => {
        if (read) return;
        if (box.scrollTop + box.clientHeight >= box.scrollHeight - SCROLL_TOLERANCE_PX) setRead(true);
    };
    return (
        <div className="req-terms">
            <div className="req-terms__box" data-testid="terms-box" tabIndex={0} onScroll={(event) => check(event.currentTarget)}>
                <b>Syarat penggunaan akses {kindLabel}</b>
                <ol>{TERMS.map((term) => <li key={term}>{term}</li>)}</ol>
                <p>Pelanggaran dapat dikenai sanksi sesuai peraturan perusahaan.</p>
            </div>
            <label className={`req-terms__check ${read ? '' : 'is-off'}`}>
                <input type="checkbox" checked={accepted} disabled={!read} onChange={(event) => onAccept(event.target.checked)} />
                <span>Saya sudah membaca dan menyetujui syarat di atas {!read && <em>— scroll sampai bawah dulu</em>}</span>
            </label>
        </div>
    );
}
