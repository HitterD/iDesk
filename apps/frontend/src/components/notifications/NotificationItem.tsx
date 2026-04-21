import React from 'react';
import { Check, Trash2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Notification } from './types/notification.types';
import { NOTIFICATION_ICONS } from './constants/notification.constants';
import { formatTimeAgo, stripEmoji } from './utils/notification.utils';

interface NotificationItemProps {
    notification: Notification;
    isSelectionMode: boolean;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onDelete: (id: string, e: React.MouseEvent) => void;
    onMarkRead: (id: string, e: React.MouseEvent) => void;
    onViewDetails: (notification: Notification) => void;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
    notification,
    isSelectionMode,
    isSelected,
    onSelect,
    onDelete,
    onMarkRead,
    onViewDetails
}) => {
    const Icon = NOTIFICATION_ICONS[notification.type] || NOTIFICATION_ICONS.SYSTEM;
    const isCritical = notification.requiresAcknowledge;

    const handleItemClick = () => {
        if (isSelectionMode) {
            onSelect(notification.id);
        } else {
            onViewDetails(notification);
        }
    };

    return (
        <div 
            onClick={handleItemClick}
            className={cn(
                "group relative flex items-start gap-4 p-4 rounded-xl transition-[opacity,transform,colors] duration-200 ease-out cursor-pointer border border-transparent",
                notification.isRead ? "opacity-75" : "bg-white dark:bg-slate-800/50 shadow-sm border-slate-100 dark:border-slate-700/50",
                isSelected && "bg-primary/5 border-primary/20",
                "hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            )}
        >
            {/* Selection Checkbox */}
            {isSelectionMode && (
                <div className="mt-1 shrink-0">
                    <div className={cn(
                        "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                        isSelected ? "bg-primary border-primary text-white" : "border-slate-300 dark:border-slate-600"
                    )}>
                        {isSelected && <Check className="w-3 h-3" />}
                    </div>
                </div>
            )}

            {/* Icon Container */}
            <div className={cn(
                "p-2.5 rounded-xl shrink-0 transition-transform group-hover:scale-110 relative",
                isCritical ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
            )}>
                <Icon className="w-5 h-5" />
                {!notification.isRead && !isCritical && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full border-2 border-white dark:border-slate-900" />
                )}
                {isCritical && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className={cn(
                        "text-sm font-bold truncate",
                        notification.isRead ? "text-slate-600 dark:text-slate-400" : "text-slate-900 dark:text-white"
                    )}>
                        {stripEmoji(notification.title)}
                    </h4>
                    <span className="text-[10px] font-medium text-slate-500 whitespace-nowrap">
                        {formatTimeAgo(notification.createdAt)}
                    </span>
                </div>
                <p className={cn(
                    "text-xs leading-relaxed line-clamp-2",
                    notification.isRead ? "text-slate-500" : "text-slate-600 dark:text-slate-300"
                )}>
                    {notification.message}
                </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                {!notification.isRead && (
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            onMarkRead(notification.id, e);
                        }}
                        className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="Mark as read"
                    >
                        <Check className="w-4 h-4" />
                    </button>
                )}
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(notification.id, e);
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
                <ChevronRight className="w-4 h-4 text-slate-300 ml-1" />
            </div>
        </div>
    );
};
