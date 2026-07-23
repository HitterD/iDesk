import { SimpleBookingForm, ZoomMyBookingsView } from '../components';

export function ClientZoomBookingPage() {
    return (
        <main className="mx-auto max-w-7xl space-y-6 p-4 lg:p-6 animate-fade-in-up">
            <header className="space-y-1 px-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
                    Zoom
                </p>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                    Booking Zoom
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Buat jadwal meeting Zoom baru dan kelola seluruh daftar meeting Anda.
                </p>
            </header>

            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12 lg:gap-6">
                <section
                    aria-labelledby="booking-form-heading"
                    className="sticky top-6 rounded-2xl bg-card p-5 shadow-[0_14px_35px_rgba(15,23,42,0.055)] dark:shadow-none lg:col-span-5"
                >
                    <div className="mb-5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                            Detail meeting
                        </p>
                        <h2 id="booking-form-heading" className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
                            Buat meeting
                        </h2>
                    </div>
                    <SimpleBookingForm />
                </section>

                <section
                    aria-label="Daftar meeting saya"
                    className="flex min-h-[600px] flex-col overflow-hidden rounded-2xl bg-card shadow-[0_14px_35px_rgba(15,23,42,0.055)] dark:shadow-none lg:col-span-7"
                >
                    <ZoomMyBookingsView />
                </section>
            </div>
        </main>
    );
}

