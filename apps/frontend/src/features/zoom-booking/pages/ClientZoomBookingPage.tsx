import { Video, Calendar } from 'lucide-react';
import { SimpleBookingForm, ZoomMyBookingsView } from '../components';

export function ClientZoomBookingPage() {
    return (
        <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-6 animate-fade-in-up">
            {/* Page Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <Video aria-hidden="true" className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Booking Zoom</h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Buat jadwal meeting Zoom baru dan kelola seluruh daftar meeting Anda
                        </p>
                    </div>
                </div>
            </div>

            {/* Split Grid View (40% Kiri - 60% Kanan) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Kolom Kiri: Form Booking Card */}
                <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-5 shadow-sm sticky top-6">
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                        <Calendar className="h-4 w-4 text-blue-600" />
                        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Form Booking Zoom</h2>
                    </div>
                    <SimpleBookingForm />
                </div>

                {/* Kolom Kanan: Panel Daftar Zoom Lengkap */}
                <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-card shadow-sm overflow-hidden min-h-[600px] flex flex-col">
                    <ZoomMyBookingsView />
                </div>
            </div>
        </div>
    );
}

