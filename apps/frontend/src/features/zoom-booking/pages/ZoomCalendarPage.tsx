import { ZoomCalendar, ZoomErrorBoundary } from '../components';

export function ZoomCalendarPage() {
    return (
        <div className="p-6 space-y-6">
            <ZoomErrorBoundary>
                <ZoomCalendar />
            </ZoomErrorBoundary>
        </div>
    );
}
