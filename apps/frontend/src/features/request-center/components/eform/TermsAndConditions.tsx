import React, { useState, useEffect, useRef } from 'react';
import { Info, ShieldAlert, ArrowDown, CheckCircle2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export type FormType = 'VPN' | 'WEBSITE' | 'NETWORK';

interface TermsAndConditionsProps {
  content?: string;
  formType?: FormType;
  accepted: boolean;
  onAccept: (accepted: boolean) => void;
}

const DEFAULT_TERMS_BY_TYPE: Record<FormType, { title: string; points: string[]; agreement: string }> = {
  VPN: {
    title: 'Syarat & Ketentuan Akses VPN PT.SANTOS JAYA ABADI',
    points: [
      'Divisi ICT tidak bertanggung jawab terhadap pelanggaran keamanan maupun upaya perusakan komputer dan/atau perangkat lain yang anda gunakan selama terhubung dengan menggunakan VPN. Semua masalah lisensi yang mungkin akan menimbulkan biaya karena penggunaan aplikasi ilegal saat terhubung ke VPN merupakan tanggung jawab pemohon sepenuhnya. Akses ke VPN PT.SANTOS JAYA ABADI hanya boleh digunakan untuk hal-hal yang berkaitan dengan pekerjaan. Software VPN beserta kredensialnya tidak boleh dibagikan oleh pemohon kepada pihak lain dalam kondisi apapun. Pemohon tidak diperkenankan menggunakan aplikasi remote service pihak ketiga (Misal: TeamViewer, LogMeIn, GoToMyPC, peer-to-peer networking, dll) saat terhubung ke VPN PT.SANTOS JAYA ABADI.',
      'Semua akses ke jaringan VPN PT.SANTOS JAYA ABADI tercatat dan diawasi.',
      'Komputer yang digunakan untuk terhubung ke VPN wajib terpasang antivirus dan memiliki database up to date.',
      'Pemohon yang diberi akses VPN berkewajiban untuk menjaga kerahasiaan data dan/atau informasi milik perusahaan, apabila terbukti dengan sengaja dan/atau karena kelalaian menyebabkan kerugian dan/atau potensi kerugian bagi perusahaan,maka dengan ini pemohon menyatakan bersedia diberi sangsi sesuai peraturan perusahaan yang berlaku.',
      'Semua insiden terkait keamanan informasi yang terjadi selama menggunakan dan atau memiliki akses VPN wajib dilaporkan kepada pihak ICT. Contoh: kehilangan laptop yang terpasang akses VPN, laptop yang digunakan terkena malware, dsb.',
    ],
    agreement: 'Saya mengerti dan menyetujui Syarat & Ketentuan Akses VPN PT.SANTOS JAYA ABADI',
  },
  WEBSITE: {
    title: 'Syarat & Ketentuan Akses Website PT.SANTOS JAYA ABADI',
    points: [
      'Pembukaan akses website/domain hanya diperkenankan untuk keperluan pekerjaan resmi dan operasional perusahaan. Penggunaan untuk konten terlarang, aktivitas ilegal, atau kepentingan pribadi di luar pekerjaan merupakan tanggung jawab pemohon sepenuhnya.',
      'Semua aktivitas lalu lintas data dan penjelajahan situs melalui jaringan perusahaan tercatat dan diawasi sesuai kebijakan keamanan ICT.',
      'Perangkat yang digunakan untuk mengakses website wajib mematuhi standar keamanan informasi, bebas malware/adware, dan dilarang mengunduh berkas berbahaya ke jaringan kantor.',
      'Pemohon berkewajiban menjaga kerahasiaan informasi internal perusahaan dan dilarang mengunggah (upload) data rahasia/sensitif ke website publik atau pihak ketiga yang tidak diotorisasi.',
      'Semua indikasi kebocoran data atau insiden keamanan siber yang bersumber dari akses website wajib segera dilaporkan kepada Divisi ICT.',
    ],
    agreement: 'Saya mengerti dan menyetujui Syarat & Ketentuan Akses Website PT.SANTOS JAYA ABADI',
  },
  NETWORK: {
    title: 'Syarat & Ketentuan Akses Jaringan PT.SANTOS JAYA ABADI',
    points: [
      'Hak akses ke subnet, IP target, atau resource jaringan internal PT. SANTOS JAYA ABADI hanya digunakan secara sah sesuai lingkup pekerjaan yang diajukan.',
      'Seluruh aktivitas koneksi, port session, dan transfer data dalam jaringan diawasi serta tercatat dalam log audit keamanan sistem ICT.',
      'Pemohon dilarang keras melakukan aktivitas pemindaian (port scanning), penyadapan data (sniffing), atau memodifikasi konfigurasi jaringan tanpa izin tertulis dari Tim ICT.',
      'Pemohon bertanggung jawab penuh menjaga integritas data dan stabilitas perangkat jaringan, serta bersedia menerima sanksi sesuai ketentuan perusahaan apabila terjadi pelanggaran.',
      'Segala anomali jaringan, konflik alamat IP, atau indikasi serangan keamanan wajib dilaporkan sesegera mungkin kepada pihak ICT.',
    ],
    agreement: 'Saya mengerti dan menyetujui Syarat & Ketentuan Akses Jaringan PT.SANTOS JAYA ABADI',
  },
};

export const TermsAndConditions: React.FC<TermsAndConditionsProps> = ({
  formType = 'VPN',
  accepted,
  onAccept,
}) => {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentTerms = DEFAULT_TERMS_BY_TYPE[formType] || DEFAULT_TERMS_BY_TYPE.VPN;

  // Reset scroll state on formType switch
  useEffect(() => {
    setHasScrolledToBottom(false);
    onAccept(false);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [formType, onAccept]);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    // Check if scrolled near the bottom (threshold 20px)
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 20;
    if (isAtBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      if (el.scrollHeight > 0 && el.clientHeight > 0 && el.scrollHeight <= el.clientHeight) {
        setHasScrolledToBottom(true);
      }
    }
  }, [formType]);


  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <ShieldAlert size={20} aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">{currentTerms.title}</h3>
            <p className="text-xs font-medium text-muted-foreground">Harap baca dan scroll hingga akhir sebelum menyetujui</p>
          </div>
        </div>

        {hasScrolledToBottom ? (
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={13} /> Selesai dibaca
          </span>
        ) : (
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 animate-pulse">
            <ArrowDown size={13} /> Scroll ke bawah
          </span>
        )}
      </div>

      <div className="relative">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          tabIndex={0}
          role="region"
          aria-label="Isi syarat dan ketentuan"
          className="custom-scrollbar max-h-[220px] overflow-y-auto rounded-xl border border-border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring space-y-2.5"
        >
          <ol className="list-decimal pl-4 space-y-2.5 text-foreground/90 font-normal">
            {currentTerms.points.map((point, index) => (
              <li key={index} className="pl-1 leading-relaxed">
                {point}
              </li>
            ))}
          </ol>
        </div>

        {!hasScrolledToBottom && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-10 items-end justify-center rounded-b-xl bg-gradient-to-t from-card to-transparent pb-1.5">
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <ArrowDown size={12} className="animate-bounce" /> Scroll untuk membuka persetujuan
            </span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="terms"
          className={cn(
            'flex items-start gap-3 rounded-xl border p-4 transition-all',
            !hasScrolledToBottom && 'cursor-not-allowed opacity-50 bg-muted/40 border-dashed',
            hasScrolledToBottom && !accepted && 'cursor-pointer border-border bg-background hover:border-primary/30',
            hasScrolledToBottom && accepted && 'cursor-pointer border-primary/40 bg-primary/5',
          )}
        >
          <Checkbox
            id="terms"
            aria-label={currentTerms.agreement}
            disabled={!hasScrolledToBottom}
            checked={accepted}
            onCheckedChange={checked => {
              if (hasScrolledToBottom) {
                onAccept(checked as boolean);
              }
            }}
            className="mt-0.5"
          />

          <div className="space-y-0.5">
            <span className="select-none text-xs sm:text-sm font-medium leading-snug text-foreground block">
              {currentTerms.agreement}
            </span>
            {!hasScrolledToBottom && (
              <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 block">
                Scroll kotak syarat & ketentuan di atas hingga akhir untuk mengaktifkan centang ini.
              </span>
            )}
          </div>
        </label>
      </div>

      <p className="flex items-start gap-2 text-[11px] text-muted-foreground">
        <Info size={13} className="mt-0.5 shrink-0 text-amber-500" aria-hidden="true" />
        <span>
          Pelanggaran terhadap ketentuan di atas dapat berakibat pada pencabutan hak akses dan sanksi sesuai peraturan perusahaan PT. Santos Jaya Abadi.
        </span>
      </p>
    </section>
  );
};
