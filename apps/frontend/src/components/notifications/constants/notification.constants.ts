import { 
    Bell, Check, Ticket, UserPlus, MessageSquare, AlertTriangle, 
    Clock, CheckCircle2, FileText, Calendar, 
    Shield, Key, Video, CreditCard, Wrench, 
    XCircle, History, Package, MessageCircle
} from 'lucide-react';
import { NotificationType, NotificationCategory } from '../types/notification.types';

export const NOTIFICATION_ICONS: Record<NotificationType, any> = {
    // Ticket
    [NotificationType.TICKET_CREATED]: Ticket,
    [NotificationType.TICKET_ASSIGNED]: UserPlus,
    [NotificationType.TICKET_UPDATED]: Ticket,
    [NotificationType.TICKET_RESOLVED]: Check,
    [NotificationType.TICKET_CANCELLED]: XCircle,
    [NotificationType.TICKET_REPLY]: MessageSquare,
    [NotificationType.CHAT_MESSAGE_RECEIVED]: MessageCircle,
    [NotificationType.MENTION]: MessageSquare,
    [NotificationType.SLA_WARNING]: Clock,
    [NotificationType.SLA_BREACHED]: AlertTriangle,
    [NotificationType.SYSTEM]: Bell,

    // Renewal
    [NotificationType.RENEWAL_D60_WARNING]: Calendar,
    [NotificationType.RENEWAL_D30_WARNING]: Calendar,
    [NotificationType.RENEWAL_D7_WARNING]: Clock,
    [NotificationType.RENEWAL_D1_WARNING]: AlertTriangle,
    [NotificationType.RENEWAL_EXPIRED]: XCircle,

    // Hardware & ICT Budget
    [NotificationType.ICT_BUDGET_CREATED]: CreditCard,
    [NotificationType.ICT_BUDGET_APPROVED]: CheckCircle2,
    [NotificationType.ICT_BUDGET_REJECTED]: XCircle,
    [NotificationType.ICT_BUDGET_ARRIVED]: Package,
    [NotificationType.HARDWARE_INSTALL_REQUESTED]: Wrench,
    [NotificationType.HARDWARE_INSTALL_APPROVED]: CheckCircle2,
    [NotificationType.HARDWARE_INSTALL_RESCHEDULED]: History,
    [NotificationType.HARDWARE_INSTALL_COMPLETED]: CheckCircle2,
    [NotificationType.HARDWARE_INSTALL_D1]: Clock,
    [NotificationType.HARDWARE_INSTALL_D0]: AlertTriangle,

    // Zoom
    [NotificationType.ZOOM_BOOKING_CONFIRMED]: Video,
    [NotificationType.ZOOM_BOOKING_CANCELLED]: XCircle,
    [NotificationType.ZOOM_BOOKING_REMINDER]: Clock,

    // VPN
    [NotificationType.VPN_EXPIRY_D60]: Shield,
    [NotificationType.VPN_EXPIRY_D30]: Shield,
    [NotificationType.VPN_EXPIRY_D7]: Clock,
    [NotificationType.VPN_EXPIRY_D1]: AlertTriangle,

    // E-Form
    [NotificationType.EFORM_SUBMITTED]: FileText,
    [NotificationType.EFORM_MANAGER1_APPROVED]: UserPlus,
    [NotificationType.EFORM_MANAGER2_APPROVED]: UserPlus,
    [NotificationType.EFORM_ICT_CONFIRMED]: CheckCircle2,
    [NotificationType.EFORM_REJECTED]: XCircle,
    [NotificationType.EFORM_CREDENTIALS_READY]: Key,
};

export const CATEGORY_CONFIG: Record<NotificationCategory, { label: string; icon: any; color: string; bgColor: string; darkColor: string; darkBgColor: string }> = {
    [NotificationCategory.CATEGORY_TICKET]: {
        label: 'Tickets',
        icon: Ticket,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        darkColor: 'text-blue-400',
        darkBgColor: 'bg-blue-500/10',
    },
    [NotificationCategory.CATEGORY_RENEWAL]: {
        label: 'Renewals',
        icon: FileText,
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        darkColor: 'text-orange-400',
        darkBgColor: 'bg-orange-500/10',
    },
    [NotificationCategory.CATEGORY_HARDWARE]: {
        label: 'Hardware',
        icon: Wrench,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
        darkColor: 'text-purple-400',
        darkBgColor: 'bg-purple-500/10',
    },
    [NotificationCategory.CATEGORY_ZOOM]: {
        label: 'Zoom',
        icon: Video,
        color: 'text-rose-600',
        bgColor: 'bg-rose-50',
        darkColor: 'text-rose-400',
        darkBgColor: 'bg-rose-500/10',
    },
    [NotificationCategory.CATEGORY_EFORM]: {
        label: 'E-Form',
        icon: FileText,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
        darkColor: 'text-emerald-400',
        darkBgColor: 'bg-emerald-500/10',
    },
};
