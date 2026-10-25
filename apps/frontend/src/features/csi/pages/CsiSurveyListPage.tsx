import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronRight, ClipboardList, Star } from 'lucide-react';
import { ErrorState } from '@/components/ui/ErrorState';
import { TicketPill } from '@/components/ui/ticket-pill';
import { cn } from '@/lib/utils';
import { useCsiActive } from '../hooks/useCsi';
import { useCsiBasePath } from '../lib/useCsiBasePath';
import { CSI_CARD, FadeIn } from '../components/CsiSurveyParts';

const SKELETON_ROWS = 2;
export const CSI_SURVEY_PAGE_TITLE = 'Survei Kepuasan';

export function CsiSurveyListPage() {
    const basePath = useCsiBasePath();
    const { data: surveys, isLoading, isError, refetch } = useCsiActive();

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <FadeIn className="space-y-1.5 pt-1">
                <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-foreground">{CSI_SURVEY_PAGE_TITLE}</h1>
                <p className="text-[15px] text-muted-foreground">Bantu kami meningkatkan layanan dengan menilai tim yang melayani Anda.</p>
            </FadeIn>

            {isLoading && (
                <div className="space-y-3 animate-pulse motion-reduce:animate-none" aria-busy="true" aria-label="Memuat survei">
                    {Array.from({ length: SKELETON_ROWS }, (_, index) => <div key={index} className={cn(CSI_CARD, 'h-20')} />)}
                </div>
            )}

            {isError && <ErrorState title="Gagal memuat survei" message="Terjadi kendala saat memuat survei. Silakan coba lagi." onRetry={() => refetch()} />}

            {surveys && surveys.length === 0 && (
                <FadeIn className={cn(CSI_CARD, 'px-6 py-14 text-center')}>
                    <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
                        <ClipboardList className="h-7 w-7" aria-hidden="true" />
                    </span>
                    <p className="text-[15px] font-semibold text-foreground">Tidak ada survei yang sedang berjalan</p>
                    <p className="mt-1 text-[13px] text-muted-foreground">Survei baru akan muncul di sini saat periode penilaian dibuka.</p>
                </FadeIn>
            )}

            {surveys && surveys.length > 0 && (
                <ul className="space-y-3" aria-label="Daftar survei">
                    {surveys.map((survey, index) => (
                        <li key={survey.id}>
                            <FadeIn index={index}>
                                <Link to={`${basePath}/${encodeURIComponent(survey.id)}`} data-stretched
                                    className={cn(CSI_CARD, 'group flex items-center gap-4 px-5 py-4 transition-shadow duration-200 hover:shadow-[0_10px_30px_-12px_rgb(0_0_0/.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}>
                                    <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-amber-500">
                                        <Star className="h-5 w-5 fill-current" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[15px] font-semibold text-foreground">{survey.title}</span>
                                        <span className="mt-1.5 flex flex-wrap items-center gap-2">
                                            <TicketPill tone={survey.scope === 'HC' ? 'teal' : 'blue'}>{survey.scope}</TicketPill>
                                            {survey.submitted ? (
                                                <TicketPill tone="green"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />Sudah diisi</TicketPill>
                                            ) : (
                                                <TicketPill tone="amber">Belum diisi</TicketPill>
                                            )}
                                        </span>
                                    </span>
                                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
                                </Link>
                            </FadeIn>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default CsiSurveyListPage;
