import React from 'react';
import { ArrowRight, Clock, Info, Share2, UserRoundCog } from 'lucide-react';
import { cn } from '@/lib/utils';
import { REPORT_TEAM_LABELS } from '@/features/reports/reportTeams';
import { formatDateTimeID } from '@/lib/utils/dateFormat';
import { formatMessageTime, toDisplayName } from './messageThread';

/**
 * Backend notes of a forward (ticket-forward.service.ts), one per line:
 *   Ticket forwarded from <TEAM> to <TEAM> by <NAME>. Reason: <preset>: <note>   ("by" since Nov 2026)
 *   SLA reset. Target: <ISO> (<minutes> minutes for <PRIORITY>) | SLA reset (no SlaConfig ...) |
 *   SLA reset and held for waiting-vendor | SLA cleared (ticket not in progress)
 *   Auto-assigned to <NAME> (<id>) | Auto-assign skipped (...)
 * Older messages only carry "Ticket forwarded to <TEAM> by <NAME>".
 */
const FORWARD_RE = /Ticket forwarded from ([A-Z_]+) to ([A-Z_]+)(?: by (.+?))?\.\s*Reason:\s*(.*)/i;
const LEGACY_FORWARD_RE = /Ticket forwarded to ([A-Z_]+)(?:\s+by\s+([^,.\n]+))?/i;
/** Reason presets of TicketForwardDialog; the dialog sends "<preset>: <note>" or just "<preset>". */
const REASON_PRESET_LABELS = [
    'Terkait aplikasi Web / Portal / Frontend',
    'Terkait aplikasi Mobile (iOS / Android)',
    'Terkait aplikasi Oracle / K2',
    'Masalah infrastruktur / perangkat / IT Support',
    'Butuh kode / akses developer',
    'Salah routing awal',
];
const BRACKET_PRESET_RE = /^\[([^\]]+)\]\s*(.*)$/;

/** Splits "<preset>: <note>" (dialog) or "[<preset>] <note>" into its two parts. */
function splitReason(raw: string): { preset?: string; note?: string } {
    const bracket = raw.match(BRACKET_PRESET_RE);
    if (bracket) return { preset: bracket[1].trim(), note: bracket[2].trim() || undefined };
    const preset = REASON_PRESET_LABELS.find((label) => raw === label || raw.startsWith(`${label}:`));
    if (preset) return { preset, note: raw.slice(preset.length).replace(/^:\s*/, '').trim() || undefined };
    return { note: raw || undefined };
}
const SLA_TARGET_RE = /SLA reset\. Target:\s*(\S+)\s*\((\d+) minutes/i;
const ASSIGNED_RE = /Auto-assigned to (.+?)\s*\(/i;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

const teamName = (code?: string) => (code && REPORT_TEAM_LABELS[code as keyof typeof REPORT_TEAM_LABELS]) || code || 'IT Support';

/** "480" -> "8 jam", "90" -> "1 jam 30 menit", "2880" -> "2 hari". */
function budgetLabel(minutes: number): string {
    if (minutes < MINUTES_PER_HOUR) return `${minutes} menit`;
    const hours = Math.floor(minutes / MINUTES_PER_HOUR);
    const rest = minutes % MINUTES_PER_HOUR;
    if (hours % HOURS_PER_DAY === 0 && rest === 0) return `${hours / HOURS_PER_DAY} hari`;
    return rest ? `${hours} jam ${rest} menit` : `${hours} jam`;
}

export interface ForwardEvent {
    from?: string;
    to: string;
    preset?: string;
    reason?: string;
    actor?: string;
    /** New SLA line for staff, already in plain Indonesian. */
    sla?: string;
    assignee?: string;
    /** True when the target team got no PIC automatically. */
    waitingForPic: boolean;
}

/** Reads a forward system message; null when the message is not a forward. */
export function parseForwardEvent(content: string): ForwardEvent | null {
    const clean = content.replace(/^System:\s*/i, '').trim();
    const lines = clean.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const head = lines[0] ?? '';
    const rest = lines.slice(1).join('\n');

    const full = head.match(FORWARD_RE);
    const legacy = full ? null : head.match(LEGACY_FORWARD_RE);
    if (!full && !legacy) return null;

    const { preset, note } = splitReason(full?.[4]?.trim() ?? '');
    const slaTarget = rest.match(SLA_TARGET_RE);
    let sla: string | undefined;
    if (slaTarget) {
        sla = `Target baru ${formatDateTimeID(slaTarget[1])} (${budgetLabel(Number(slaTarget[2]))})`;
    } else if (/SLA reset and held for waiting-vendor/i.test(rest)) {
        sla = 'SLA diatur ulang, dijeda selama menunggu vendor';
    } else if (/SLA cleared/i.test(rest)) {
        sla = 'SLA dimulai saat tiket dikerjakan tim baru';
    } else if (/SLA reset/i.test(rest)) {
        sla = 'SLA diatur ulang (prioritas ini tidak punya target)';
    }
    const assignee = rest.match(ASSIGNED_RE)?.[1]?.trim();

    return {
        from: full?.[1]?.toUpperCase(),
        to: (full?.[2] ?? legacy![1]).toUpperCase(),
        preset,
        reason: note,
        actor: (full?.[3] ?? legacy?.[2])?.trim(),
        sla,
        assignee,
        waitingForPic: !assignee && /Auto-assign skipped/i.test(rest),
    };
}

interface ForwardEventCardProps {
    event: ForwardEvent;
    createdAt: string;
    audience?: 'staff' | 'requester';
    className?: string;
}

/** A team handover as a readable card: from → to, why, the new SLA and who picks it up. */
export const ForwardEventCard: React.FC<ForwardEventCardProps> = ({ event, createdAt, audience = 'staff', className }) => {
    const to = teamName(event.to);
    if (audience === 'requester') {
        return (
            <div className={cn('chat-sys', className)}>
                <span className="chat-sys-ic"><Share2 aria-hidden="true" /></span>
                <span>Tiket Anda diteruskan ke tim {to}</span>
                <small>Tim yang tepat akan melanjutkan penanganan · {formatMessageTime(createdAt)}</small>
            </div>
        );
    }
    return (
        <div className={cn('chat-event chat-event-forward', className)}>
            <div className="chat-event-h">
                <span className="chat-event-ic"><Share2 aria-hidden="true" /></span>
                <div className="min-w-0">
                    <b>Diteruskan ke tim {to}</b>
                    <small>
                        {event.actor && <>oleh <strong className="font-medium">{toDisplayName(event.actor)}</strong> · </>}
                        {formatMessageTime(createdAt)}
                    </small>
                </div>
            </div>
            {event.from && (
                <div className="chat-event-route" aria-label={`Dari ${teamName(event.from)} ke ${to}`}>
                    <span className="chat-event-team is-from">{teamName(event.from)}</span>
                    <ArrowRight aria-hidden="true" />
                    <span className="chat-event-team is-to">{to}</span>
                </div>
            )}
            {(event.preset || event.reason) && (
                <div className="chat-event-kv is-one">
                    <div>
                        <small>{event.preset ?? 'Alasan'}</small>
                        {event.reason && <b>{event.reason}</b>}
                    </div>
                </div>
            )}
            {event.assignee && (
                <p className="chat-event-note m-0"><UserRoundCog aria-hidden="true" />PIC baru: <strong className="font-semibold">{toDisplayName(event.assignee)}</strong></p>
            )}
            {event.waitingForPic && (
                <p className="chat-event-note m-0"><Info aria-hidden="true" />Menunggu PIC dari tim {to}</p>
            )}
            {event.sla && (
                <p className="chat-event-note m-0"><Clock aria-hidden="true" />{event.sla}</p>
            )}
        </div>
    );
};
