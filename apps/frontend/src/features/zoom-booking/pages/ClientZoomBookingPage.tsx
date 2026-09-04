import { useState, useMemo } from 'react';
import { format, parseISO, isFuture, isToday, isPast } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { CalendarPlus, Video, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SimpleBookingForm, ZoomMyBookingsView } from '../components';
import { useMyBookings } from '../hooks';

export function ClientZoomBookingPage() {
    const [mobileTab, setMobileTab] = useState<'form' | 'bookings'>('form');
    const [isFormVisible, setIsFormVisible] = useState(true);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const { data: bookings } = useMyBookings();

    const upcomingCount = useMemo(() => {
        if (!bookings) return 0;
        let count = 0;
        for (const b of bookings) {
            const rawDate = b.bookingDate;
            if (!rawDate) continue;
            const dateStr = typeof rawDate === 'string' ? rawDate.split('T')[0] : format(new Date(rawDate), 'yyyy-MM-dd');
            const date = parseISO(dateStr);
            if (isFuture(date) || isToday(date)) count++;
        }
        return count;
    }, [bookings]);

    const handleDateSelectFromCalendar = (dateStr: string) => {
        const date = parseISO(dateStr);
        if (isPast(date) && !isToday(date)) {
            toast.warning('Tanggal ini sudah lewat. Silakan pilih hari ini atau tanggal mendatang.');
            return;
        }

        setSelectedDate(dateStr);
        // Ensure form is visible if it was hidden
        setIsFormVisible(true);
        toast.success(`Tanggal ${format(date, 'EEEE, d MMMM yyyy', { locale: idLocale })} dipilih. Silakan lengkapi judul meeting.`, {
            duration: 3500,
        });

        // If on small screen, switch to form so user can immediately schedule
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            setMobileTab('form');
        }

        // Focus the title input and scroll smoothly
        setTimeout(() => {
            const formSection = document.getElementById('booking-form-section');
            if (formSection) {
                formSection.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
                setTimeout(() => {
                    formSection.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
                }, 1500);
            }
            const titleInput = document.getElementById('simple-booking-title') as HTMLInputElement | null;
            if (titleInput) {
                titleInput.focus();
                titleInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 150);
    };

    return (
        <div className="w-full space-y-4 lg:space-y-6 animate-fade-in-up">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1">
                <header className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
                        Zoom
                    </p>
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                        Booking Zoom
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Buat jadwal meeting Zoom baru dan kelola seluruh daftar meeting Anda.
                    </p>
                </header>

                {/* Desktop Toggle: Focus Matrix / Expand View */}
                <div className="hidden lg:flex items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsFormVisible(!isFormVisible)}
                        className={cn(
                            "cursor-pointer gap-2 rounded-xl text-xs font-semibold transition-all shadow-2xs border-border/80",
                            !isFormVisible && "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                        )}
                        title={isFormVisible ? "Sembunyikan form agar tampilan matriks/kalender lebih luas" : "Buka form untuk membuat meeting"}
                    >
                        {isFormVisible ? (
                            <>
                                <PanelLeftClose className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                                <span>Sembunyikan Form (Mode Luas)</span>
                            </>
                        ) : (
                            <>
                                <PanelLeftOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                <span>Buka Form Booking</span>
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* Mobile Tab Switcher (Visible on < lg screens) */}
            <div className="flex rounded-2xl bg-slate-100 p-1 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 lg:hidden shadow-xs">
                <button
                    type="button"
                    onClick={() => setMobileTab('form')}
                    className={cn(
                        "flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-semibold transition-all duration-200 cursor-pointer",
                        mobileTab === 'form'
                            ? "bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-400 font-bold"
                            : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                    )}
                >
                    <CalendarPlus className="h-4 w-4" />
                    <span>Buat Meeting</span>
                </button>

                <button
                    type="button"
                    onClick={() => setMobileTab('bookings')}
                    className={cn(
                        "flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-semibold transition-all duration-200 cursor-pointer",
                        mobileTab === 'bookings'
                            ? "bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-400 font-bold"
                            : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                    )}
                >
                    <Video className="h-4 w-4" />
                    <span>Kalender & Meeting</span>
                    {upcomingCount > 0 && (
                        <span
                            className={cn(
                                "inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] tabular-nums font-bold",
                                mobileTab === 'bookings'
                                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                                    : "bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            )}
                        >
                            {upcomingCount}
                        </span>
                    )}
                </button>
            </div>

            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12 lg:gap-6">
                {/* Form Section: Shown on desktop when isFormVisible, or mobile when mobileTab === 'form' */}
                <section
                    id="booking-form-section"
                    aria-labelledby="booking-form-heading"
                    className={cn(
                        "rounded-2xl bg-card p-5 shadow-[0_14px_35px_rgba(15,23,42,0.055)] dark:shadow-none border border-border/50 lg:sticky lg:top-6 lg:col-span-4 xl:col-span-3.5 2xl:col-span-3",
                        mobileTab === 'form' ? 'block' : 'hidden',
                        isFormVisible ? 'lg:block' : 'lg:hidden'
                    )}
                >
                    <div className="mb-5 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                                Detail meeting
                            </p>
                            <h2 id="booking-form-heading" className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
                                Buat meeting
                            </h2>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsFormVisible(false)}
                            className="hidden lg:flex h-7 w-7 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer rounded-lg"
                            title="Sembunyikan Form"
                        >
                            <PanelLeftClose className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                    <SimpleBookingForm
                        selectedDate={selectedDate}
                        onDateChange={setSelectedDate}
                        onSuccessViewBookings={() => setMobileTab('bookings')}
                    />
                </section>

                {/* My Bookings Section: Shown on desktop or when mobileTab === 'bookings' */}
                <section
                    aria-label="Daftar meeting saya"
                    className={cn(
                        "min-h-[540px] lg:min-h-[660px] flex-col overflow-hidden rounded-2xl bg-card shadow-[0_14px_35px_rgba(15,23,42,0.055)] dark:shadow-none border border-border/50",
                        isFormVisible
                            ? "lg:col-span-8 xl:col-span-8.5 2xl:col-span-9"
                            : "lg:col-span-12",
                        mobileTab === 'bookings' ? 'flex' : 'hidden lg:flex'
                    )}
                >
                    <ZoomMyBookingsView
                        selectedDate={selectedDate}
                        onDateSelect={handleDateSelectFromCalendar}
                    />
                </section>
            </div>
        </div>
    );
}

