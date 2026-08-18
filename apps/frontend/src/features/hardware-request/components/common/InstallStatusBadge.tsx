import { getStatusMeta, type InstallStatus } from '../../utils/status.util';

export function InstallStatusBadge({ status, size = 'sm' }: { status: InstallStatus | string; size?: 'sm' | 'md' | 'lg' }) {
    const m = getStatusMeta(status);
    const sz = size === 'lg' ? 'text-sm px-3 py-1.5' : size === 'md' ? 'text-xs px-2.5 py-1' : 'text-xs px-2 py-0.5';
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full ring-1 ${m.tone} ${sz} font-medium tracking-tight`}>
            <span className="size-1.5 rounded-full" style={{ backgroundColor: m.hex }} />
            {m.label}
        </span>
    );
}
