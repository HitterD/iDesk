// ── Core components ──────────────────────────────────────────────────────────
export { ZoomCalendar } from './ZoomCalendar';
export { ZoomErrorBoundary } from './ZoomErrorBoundary';
export * from './ZoomCalendar';
export * from './CancelBookingModal';
export * from './BlockedDatesPicker';
export * from './ZoomAuditLogsViewer';
export * from './BookingTooltip';
export { ZoomAuditLogsViewer } from './ZoomAuditLogsViewer';

// ── New calendar shell components ────────────────────────────────────────────
export { ZoomCalendarHeader } from './ZoomCalendarHeader';
export { ZoomCalendarShell } from './ZoomCalendarShell';
export { ZoomBookingPanel } from './ZoomBookingPanel';
export { ZoomViewSwitcher } from './ZoomViewSwitcher';

// ── New view components ──────────────────────────────────────────────────────
export { ZoomMonthView } from './ZoomMonthView';
export { ZoomWeekView } from './ZoomWeekView';
export { ZoomDayView } from './ZoomDayView';
export { ZoomMyBookingsView } from './ZoomMyBookingsView';
export { ZoomMonthDayPopover } from './ZoomMonthDayPopover';

// ── New panel form/view components ───────────────────────────────────────────
export { ZoomBookingForm } from './ZoomBookingForm';
export { ZoomBookingDetailView } from './ZoomBookingDetailView';
export { ZoomRescheduleView } from './ZoomRescheduleView';

// ── Skeletons ────────────────────────────────────────────────────────────────
export {
    ZoomCalendarSkeleton,
    ZoomWeekViewSkeleton,
    ZoomDayViewSkeleton,
    ZoomMonthViewSkeleton,
    ZoomCalendarSkeletonView,
    ZoomSettingsSkeleton,
    ZoomBookingsTableSkeleton,
} from './ZoomSkeletons';

// ── @deprecated — retained for backwards compatibility, not removed ───────────
// BookingModal: replaced by ZoomBookingForm inside ZoomBookingPanel
export { BookingModal } from './BookingModal';
// BookingDetailsModal: replaced by ZoomBookingDetailView inside ZoomBookingPanel
export { BookingDetailsModal } from './BookingDetailsModal';
// RescheduleModal: replaced by ZoomRescheduleView inside ZoomBookingPanel
export { RescheduleModal } from './RescheduleModal';
// ZoomCalendarGrid: still used by ZoomWeekView/ZoomDayView internals
export { ZoomCalendarGrid } from './ZoomCalendarGrid';
// BookingTooltip: may be used standalone in other contexts
// (already exported above via export * from './BookingTooltip')
