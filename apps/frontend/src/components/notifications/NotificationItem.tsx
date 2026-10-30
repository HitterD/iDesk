import React from 'react';
import { Check, CheckCheck, Trash2, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Notification, NotificationCategory } from './types/notification.types';
import { CATEGORY_CONFIG, NOTIFICATION_ICONS } from './constants/notification.constants';
import { formatTimeAgo, stripEmoji } from './utils/notification.utils';
import '@/features/dashboard/dashboard.css';
import '@/components/resources/resources.css';
import '@/components/management/management.css';

interface NotificationItemProps {
    notification: Notification;
    isSelectionMode: boolean;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onDelete: (id: string, e: React.MouseEvent) => void;
    onMarkRead: (id: string, e: React.MouseEvent) => void;
    onViewDetails: (notification: Notification) => void;
    onAcknowledge?: (id: string) => void;
    isAcknowledgePending?: boolean;
}

/** Mockup notifications.html category hue + contextual action label. */
const CATEGORY_UI: Readonly<Record<NotificationCategory, { hue: string; action: string }>> = {
    [NotificationCategory.CATEGORY_TICKET]: { hue: 'var(--dash-blue)', action: 'Buka Tiket' },
    [NotificationCategory.CATEGORY_HARDWARE]: { hue: 'var(--dash-orange)', action: 'Tinjau Request' },
    [NotificationCategory.CATEGORY_RENEWAL]: { hue: 'var(--dash-brown)', action: 'Cek Kontrak' },
    [NotificationCategory.CATEGORY_ZOOM]: { hue: 'var(--dash-teal)', action: 'Buka Zoom' },
    [NotificationCategory.CATEGORY_EFORM]: { hue: 'var(--res-mint, #00a88f)', action: 'Tinjau E-Form' },
};
const FALLBACK_UI = { hue: 'var(--dash-gray)', action: 'Buka' };

/**
 * Mockup `.li.notif`: category bubble, title (unread dot), body, "Kategori · waktu", action + hover tools.
 * The text block is one button (open or select); every other control is its sibling, never nested.
 */
export const NotificationItem: React.FC<NotificationItemProps> = ({
    notification,
    isSelectionMode,
    isSelected,
    onSelect,
    onDelete,
    onMarkRead,
    onViewDetails,
    onAcknowledge,
    isAcknowledgePending,
}) => {
    const needsAck = Boolean(notification.requiresAcknowledge && !notification.acknowledgedAt);
    const Icon = needsAck ? TriangleAlert : (NOTIFICATION_ICONS[notification.type] || NOTIFICATION_ICONS.SYSTEM);
    const ui = CATEGORY_UI[notification.category] ?? FALLBACK_UI;
    const categoryLabel = CATEGORY_CONFIG[notification.category]?.label ?? 'Sistem';
    const title = stripEmoji(notification.title);

    return (
        <div className={cn('dash-li mg-notif', !notification.isRead && 'is-unread', isSelected && 'is-selected')}>
            {isSelectionMode && (
                <input type="checkbox" className="mg-check" checked={isSelected} onChange={() => onSelect(notification.id)} aria-label={`Pilih notifikasi: ${title}`} />
            )}
            <span className="dash-ico" style={{ ['--c' as string]: needsAck ? 'var(--dash-red)' : ui.hue }}><Icon aria-hidden="true" /></span>
            <button type="button" className="mg-notif-main grow1" aria-pressed={isSelectionMode ? isSelected : undefined}
                onClick={() => (isSelectionMode ? onSelect(notification.id) : onViewDetails(notification))}>
                <b>{title}</b>
                <small className="!whitespace-normal line-clamp-2">{notification.message}</small>
                <small>{categoryLabel} · {formatTimeAgo(notification.createdAt)}</small>
            </button>
            {needsAck && onAcknowledge && (
                <button type="button" className="idesk-btn is-danger is-solid" onClick={() => onAcknowledge(notification.id)} disabled={isAcknowledgePending} aria-busy={isAcknowledgePending || undefined}>
                    <CheckCheck aria-hidden="true" />Acknowledge
                </button>
            )}
            {!isSelectionMode && (
                <button type="button" className="idesk-btn is-ghost mg-hide-sm" onClick={() => onViewDetails(notification)}>{ui.action}</button>
            )}
            <span className="mg-li-acts">
                {!notification.isRead && (
                    <button type="button" className="res-icon-btn" onClick={(e) => onMarkRead(notification.id, e)} title="Tandai dibaca" aria-label="Tandai dibaca">
                        <Check aria-hidden="true" />
                    </button>
                )}
                <button type="button" className="res-icon-btn is-danger" onClick={(e) => onDelete(notification.id, e)} title="Hapus notifikasi" aria-label="Hapus notifikasi">
                    <Trash2 aria-hidden="true" />
                </button>
            </span>
        </div>
    );
};
