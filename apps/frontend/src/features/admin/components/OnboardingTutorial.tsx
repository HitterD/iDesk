import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Upload, Download, Users, Search, Shield, Keyboard, BarChart3, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

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
        title: 'Welcome to Agent Management',
        description: 'This page lets you manage your entire support team. View agents, track performance, and manage permissions all in one place.',
        icon: Users,
    },
    {
        title: 'Quick Stats Dashboard',
        description: 'Click on any stat card to filter agents. See total agents, active tickets, resolved counts, and your top performer at a glance.',
        icon: BarChart3,
    },
    {
        title: 'Import & Export',
        description: 'Use Import to bulk add users via CSV (with preview before import). Export lets you download user data as CSV or Excel.',
        icon: Upload,
    },
    {
        title: 'Search & Filter',
        description: 'Use the search bar to find agents by name or email. Filter by site or role using the dropdown menus.',
        icon: Search,
    },
    {
        title: 'Bulk Actions',
        description: 'Select multiple agents using checkboxes, then use bulk actions to change roles, assign sites, or compare performance.',
        icon: Shield,
    },
    {
        title: 'Keyboard Shortcuts',
        description: 'Press ? anytime to see keyboard shortcuts. Use Ctrl+A to select all, Delete to remove selected, Escape to close dialogs.',
        icon: Keyboard,
    },
    {
        title: "You're Ready!",
        description: 'Start managing your team. Click on any agent card to see detailed performance stats and activity history.',
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

    const handleComplete = () => {
        localStorage.setItem(LOCAL_STORAGE_KEY, 'true');
        onComplete();
    };

    const handleSkip = () => {
        localStorage.setItem(LOCAL_STORAGE_KEY, 'true');
        onComplete();
    };

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
            <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in zoom-in-95 duration-300">
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
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors text-sm z-10"
                >
                    Skip tour
                </button>

                {/* Content */}
                <div className="p-8 pt-6">
                    {/* Step Indicator */}
                    <div className="flex items-center gap-1 mb-4">
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
                        <Icon className="w-8 h-8 text-primary" />
                    </div>

                    {/* Title */}
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
                        {step.title}
                    </h2>

                    {/* Description */}
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
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
                        Back
                    </button>

                    <button
                        onClick={handleNext}
                        type="button"
                        className="flex items-center gap-1 px-6 py-2 bg-primary text-slate-900 font-bold rounded-xl hover:bg-primary/90 transition-colors"
                    >
                        {isLastStep ? 'Get Started' : 'Next'}
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
