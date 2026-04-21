import { useState, useCallback } from 'react';
import type { ZoomBooking } from '../types';

export type PanelMode = 'booking' | 'detail' | 'reschedule' | null;

export interface BookingPanelContext {
    preselectedDate?: string;
    preselectedTime?: string;
    zoomAccountId?: string;
    /** For detail view — just the ID is enough; the view fetches full data */
    bookingId?: string;
    /** For reschedule view — needs the full booking object */
    booking?: ZoomBooking;
}

export interface BookingPanelState {
    isOpen: boolean;
    mode: PanelMode;
    context: BookingPanelContext;
    openBooking: (ctx: { date: string; time: string; zoomAccountId: string }) => void;
    openDetail: (bookingId: string) => void;
    openReschedule: (booking: ZoomBooking) => void;
    close: () => void;
    switchMode: (mode: PanelMode) => void;
}

export function useBookingPanel(): BookingPanelState {
    const [isOpen, setIsOpen] = useState(false);
    const [mode, setMode] = useState<PanelMode>(null);
    const [context, setContext] = useState<BookingPanelContext>({});

    const openBooking = useCallback((ctx: { date: string; time: string; zoomAccountId: string }) => {
        setContext({
            preselectedDate: ctx.date,
            preselectedTime: ctx.time,
            zoomAccountId: ctx.zoomAccountId,
        });
        setMode('booking');
        setIsOpen(true);
    }, []);

    const openDetail = useCallback((bookingId: string) => {
        setContext({ bookingId });
        setMode('detail');
        setIsOpen(true);
    }, []);

    const openReschedule = useCallback((booking: ZoomBooking) => {
        setContext({ booking });
        setMode('reschedule');
        setIsOpen(true);
    }, []);

    const close = useCallback(() => {
        setIsOpen(false);
        setTimeout(() => {
            setMode(null);
            setContext({});
        }, 300); // wait for close animation
    }, []);

    const switchMode = useCallback((newMode: PanelMode) => {
        setMode(newMode);
    }, []);

    return {
        isOpen,
        mode,
        context,
        openBooking,
        openDetail,
        openReschedule,
        close,
        switchMode,
    };
}
