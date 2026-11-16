import { useCsiLiveStatus } from '../../hooks/useCsiLiveUpdates';
import { cn } from '@/lib/utils';

export function LiveStatusPill({ className }: { className?: string }) {
    const live = useCsiLiveStatus();
    return (
        <span
            aria-label={live ? 'Pembaruan langsung aktif' : 'Pembaruan otomatis setiap 15 detik'}
            title={live
                ? 'Data dashboard & progres survei diperbarui otomatis secara real-time tanpa perlu refresh.'
                : 'Koneksi real-time sedang menghubungkan ulang; data diperbarui otomatis setiap 15 detik.'}
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium select-none',
                live
                    ? 'border-[hsl(var(--ticket-green)/0.35)] bg-[hsl(var(--ticket-green)/0.1)] text-[hsl(var(--ticket-green-ink))]'
                    : 'border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.5)] text-[hsl(var(--muted-foreground))]',
                className,
            )}
        >
            <span
                className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    live ? 'bg-[hsl(var(--ticket-green))] animate-pulse motion-reduce:animate-none' : 'bg-[hsl(var(--muted-foreground)/0.6)]',
                )}
                aria-hidden="true"
            />
            {live ? 'Live' : 'Auto'}
        </span>
    );
}
