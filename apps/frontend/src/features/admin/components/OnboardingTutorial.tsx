import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, ChevronLeft, Upload, Users, Search, Shield, Keyboard, BarChart3, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/scrollLock';

interface OnboardingTutorialProps {
    onComplete: () => void;
}

interface TutorialStep {
    title: string;
    description: string;
    icon: React.ElementType;
}

const TUTORIAL_STEPS: TutorialStep[] = [
    {
        title: 'Selamat datang di Agent Management',
        description: 'Kelola seluruh tim support dari satu halaman: lihat agen, pantau performa, dan atur hak akses.',
        icon: Users,
    },
    {
        title: 'Ringkasan cepat',
        description: 'Klik kartu statistik untuk memfilter agen. Total agen, tiket aktif, tiket selesai, dan performa terbaik terlihat sekilas.',
        icon: BarChart3,
    },
    {
        title: 'Import & Export',
        description: 'Import menambah banyak user sekaligus dari CSV (dengan pratinjau sebelum disimpan). Export mengunduh data user sebagai CSV atau Excel.',
        icon: Upload,
    },
    {
        title: 'Cari & filter',
        description: 'Cari agen berdasarkan nama atau email. Saring berdasarkan site atau role lewat menu dropdown.',
        icon: Search,
    },
    {
        title: 'Aksi massal',
        description: 'Centang beberapa agen, lalu ubah role, pindahkan site, atau bandingkan performanya sekaligus.',
        icon: Shield,
    },
    {
        title: 'Pintasan keyboard',
        // Must match the handler in BentoAdminAgentsPage — the old copy advertised
        // plain Ctrl+A and a bare Delete, neither of which exists.
        description: 'Tekan ? kapan saja untuk melihat pintasan. Ctrl+Shift+A memilih semua, Ctrl+Delete menghapus yang dipilih, Escape menutup dialog.',
        icon: Keyboard,
    },
    {
        title: 'Siap digunakan',
        description: 'Mulai kelola tim Anda. Klik baris agen untuk melihat detail performa dan riwayat aktivitas.',
        icon: CheckCircle,
    },
];

const LOCAL_STORAGE_KEY = 'agent-management-onboarding-complete';

// Check if onboarding should be shown (call this in parent)
export const shouldShowOnboarding = (): boolean => {
    return !localStorage.getItem(LOCAL_STORAGE_KEY);
};

export const OnboardingTutorial: React.FC<OnboardingTutorialProps> = ({ onComplete }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const dialogRef = useRef<HTMLDivElement>(null);

    // Stable identity: useFocusTrap re-runs its effect whenever onEscape changes.
    const handleSkip = useCallback(() => {
        localStorage.setItem(LOCAL_STORAGE_KEY, 'true');
        onComplete();
    }, [onComplete]);

    useFocusTrap(dialogRef, { enabled: true, onEscape: handleSkip });

    useEffect(() => {
        lockBodyScroll();
        return unlockBodyScroll;
    }, []);

    const handleNext = () => {
        if (currentStep < TUTORIAL_STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleComplete();
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleComplete = handleSkip;

    const step = TUTORIAL_STEPS[currentStep];
    const Icon = step.icon;
    const progress = ((currentStep + 1) / TUTORIAL_STEPS.length) * 100;
    const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop - click to skip */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
                onClick={handleSkip}
            />

            {/* Modal */}
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="onboarding-title"
                className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in zoom-in-95 duration-300"
            >
                {/* Progress Bar */}
                <div className="h-1 bg-slate-200 dark:bg-slate-800">
                    <div
                        className="h-full bg-gradient-to-r from-primary to-secondary transition-[opacity,transform,colors] duration-200 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Skip Button */}
                <button
                    onClick={handleSkip}
                    type="button"
                    className="absolute top-4 right-4 px-3 min-h-[44px] text-muted-foreground hover:text-foreground transition-colors text-sm z-10"
                >
                    Lewati
                </button>

                {/* Content */}
                <div className="p-8 pt-6">
                    {/* Step Indicator */}
                    <div
                        className="flex items-center gap-1 mb-4"
                        role="progressbar"
                        aria-valuenow={currentStep + 1}
                        aria-valuemin={1}
                        aria-valuemax={TUTORIAL_STEPS.length}
                        aria-label={`Step ${currentStep + 1} of ${TUTORIAL_STEPS.length}`}
                    >
                        {TUTORIAL_STEPS.map((_, idx) => (
                            <div
                                key={idx}
                                className={cn(
                                    "h-1.5 rounded-full transition-[opacity,transform,colors] duration-200 ease-out",
                                    idx === currentStep
                                        ? "w-6 bg-primary"
                                        : idx < currentStep
                                            ? "w-1.5 bg-primary/50"
                                            : "w-1.5 bg-slate-200 dark:bg-slate-700"
                                )}
                            />
                        ))}
                    </div>

                    {/* Icon */}
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-4">
                        <Icon className="w-8 h-8 text-primary" aria-hidden="true" />
                    </div>

                    {/* Title */}
                    <h2 id="onboarding-title" className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
                        {step.title}
                    </h2>

                    {/* Description */}
                    <p className="text-muted-foreground leading-relaxed">
                        {step.description}
                    </p>
                </div>

                {/* Footer */}
                <div className="px-8 pb-6 flex items-center justify-between">
                    <button
                        onClick={handlePrev}
                        type="button"
                        disabled={currentStep === 0}
                        className={cn(
                            "flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors",
                            currentStep === 0
                                ? "text-slate-300 dark:text-slate-600 cursor-not-allowed"
                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        )}
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Kembali
                    </button>

                    <button
                        onClick={handleNext}
                        type="button"
                        className="flex items-center gap-1 px-6 py-2 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors"
                    >
                        {isLastStep ? 'Mulai' : 'Lanjut'}
                        {!isLastStep && <ChevronRight className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Export function to reset onboarding (for testing)
export const resetOnboarding = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
};
