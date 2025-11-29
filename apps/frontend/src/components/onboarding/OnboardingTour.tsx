import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TourStep {
    target: string; // CSS selector for the target element
    title: string;
    content: string;
    placement?: 'top' | 'bottom' | 'left' | 'right';
    spotlightPadding?: number;
}

interface OnboardingTourProps {
    steps: TourStep[];
    isOpen: boolean;
    onComplete: () => void;
    onSkip?: () => void;
    storageKey?: string; // Key to store completion status
}

const TOUR_STEPS: TourStep[] = [
    {
        target: '[data-tour="dashboard"]',
        title: 'Welcome to iDesk! 👋',
        content: 'This is your dashboard where you can see an overview of all tickets and system statistics.',
        placement: 'bottom',
    },
    {
        target: '[data-tour="sidebar"]',
        title: 'Navigation Sidebar',
        content: 'Use the sidebar to navigate between different sections: Dashboard, Tickets, Kanban Board, Reports, and more.',
        placement: 'right',
    },
    {
        target: '[data-tour="create-ticket"]',
        title: 'Create New Tickets',
        content: 'Click here to create a new support ticket. Fill in the details and our team will assist you promptly.',
        placement: 'bottom',
    },
    {
        target: '[data-tour="notifications"]',
        title: 'Stay Updated',
        content: 'Check your notifications here. You\'ll be notified about ticket updates, assignments, and SLA alerts.',
        placement: 'bottom',
    },
    {
        target: '[data-tour="search"]',
        title: 'Quick Search',
        content: 'Use the search bar to quickly find tickets, articles, or users. Press "/" to focus the search bar.',
        placement: 'bottom',
    },
    {
        target: '[data-tour="keyboard-shortcuts"]',
        title: 'Keyboard Shortcuts',
        content: 'Press "?" to see all available keyboard shortcuts for faster navigation.',
        placement: 'left',
    },
];

/**
 * OnboardingTour component for guiding new users
 */
export const OnboardingTour: React.FC<OnboardingTourProps> = ({
    steps = TOUR_STEPS,
    isOpen,
    onComplete,
    onSkip,
    storageKey = 'idesk-onboarding-completed',
}) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    const currentStepData = steps[currentStep];
    const isLastStep = currentStep === steps.length - 1;
    const isFirstStep = currentStep === 0;

    // Update target position
    const updateTargetPosition = useCallback(() => {
        if (!currentStepData) return;
        
        const target = document.querySelector(currentStepData.target);
        if (target) {
            const rect = target.getBoundingClientRect();
            setTargetRect(rect);
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    }, [currentStepData]);

    useEffect(() => {
        if (!isOpen) return;
        
        updateTargetPosition();
        
        // Update on scroll/resize
        window.addEventListener('scroll', updateTargetPosition, true);
        window.addEventListener('resize', updateTargetPosition);
        
        return () => {
            window.removeEventListener('scroll', updateTargetPosition, true);
            window.removeEventListener('resize', updateTargetPosition);
        };
    }, [isOpen, currentStep, updateTargetPosition]);

    const handleNext = () => {
        if (isLastStep) {
            localStorage.setItem(storageKey, 'true');
            onComplete();
        } else {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        if (!isFirstStep) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const handleSkip = () => {
        localStorage.setItem(storageKey, 'true');
        onSkip?.();
        onComplete();
    };

    if (!isOpen || !isVisible || !targetRect) return null;

    // Calculate tooltip position
    const padding = currentStepData.spotlightPadding || 8;
    const tooltipWidth = 320;
    const tooltipHeight = 180;
    
    let tooltipStyle: React.CSSProperties = {};
    const placement = currentStepData.placement || 'bottom';
    
    switch (placement) {
        case 'bottom':
            tooltipStyle = {
                top: targetRect.bottom + padding + 12,
                left: Math.max(16, Math.min(
                    targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
                    window.innerWidth - tooltipWidth - 16
                )),
            };
            break;
        case 'top':
            tooltipStyle = {
                top: targetRect.top - tooltipHeight - padding - 12,
                left: Math.max(16, Math.min(
                    targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
                    window.innerWidth - tooltipWidth - 16
                )),
            };
            break;
        case 'left':
            tooltipStyle = {
                top: targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
                left: targetRect.left - tooltipWidth - padding - 12,
            };
            break;
        case 'right':
            tooltipStyle = {
                top: targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
                left: targetRect.right + padding + 12,
            };
            break;
    }

    return createPortal(
        <div className="fixed inset-0 z-[9999]">
            {/* Overlay with spotlight cutout */}
            <svg className="absolute inset-0 w-full h-full">
                <defs>
                    <mask id="spotlight-mask">
                        <rect x="0" y="0" width="100%" height="100%" fill="white" />
                        <rect
                            x={targetRect.left - padding}
                            y={targetRect.top - padding}
                            width={targetRect.width + padding * 2}
                            height={targetRect.height + padding * 2}
                            rx="8"
                            fill="black"
                        />
                    </mask>
                </defs>
                <rect
                    x="0"
                    y="0"
                    width="100%"
                    height="100%"
                    fill="rgba(0,0,0,0.75)"
                    mask="url(#spotlight-mask)"
                />
            </svg>

            {/* Spotlight border */}
            <div
                className="absolute border-2 border-primary rounded-lg pointer-events-none animate-pulse"
                style={{
                    top: targetRect.top - padding,
                    left: targetRect.left - padding,
                    width: targetRect.width + padding * 2,
                    height: targetRect.height + padding * 2,
                }}
            />

            {/* Tooltip */}
            <div
                className="absolute bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                style={{
                    ...tooltipStyle,
                    width: tooltipWidth,
                }}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-primary/20 to-blue-500/20 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            Step {currentStep + 1} of {steps.length}
                        </span>
                    </div>
                    <button
                        onClick={handleSkip}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="px-4 py-3">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
                        {currentStepData.title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        {currentStepData.content}
                    </p>
                </div>

                {/* Footer */}
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
                    <button
                        onClick={handleSkip}
                        className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    >
                        Skip tour
                    </button>
                    <div className="flex gap-2">
                        {!isFirstStep && (
                            <button
                                onClick={handlePrev}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                Back
                            </button>
                        )}
                        <button
                            onClick={handleNext}
                            className="flex items-center gap-1 px-4 py-1.5 text-sm font-bold bg-primary text-slate-900 rounded-lg hover:bg-primary/90 transition-colors"
                        >
                            {isLastStep ? (
                                <>
                                    <Check className="w-4 h-4" />
                                    Done
                                </>
                            ) : (
                                <>
                                    Next
                                    <ChevronRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Progress dots */}
                <div className="flex justify-center gap-1 pb-3">
                    {steps.map((_, index) => (
                        <div
                            key={index}
                            className={cn(
                                'w-1.5 h-1.5 rounded-full transition-colors',
                                index === currentStep
                                    ? 'bg-primary'
                                    : index < currentStep
                                    ? 'bg-primary/50'
                                    : 'bg-slate-300 dark:bg-slate-600'
                            )}
                        />
                    ))}
                </div>
            </div>
        </div>,
        document.body
    );
};

/**
 * Hook to manage onboarding tour state
 */
export const useOnboardingTour = (storageKey = 'idesk-onboarding-completed') => {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        // Check if user has completed the tour
        const completed = localStorage.getItem(storageKey);
        if (!completed) {
            // Small delay to let the page render first
            const timer = setTimeout(() => setIsOpen(true), 1000);
            return () => clearTimeout(timer);
        }
    }, [storageKey]);

    const startTour = () => setIsOpen(true);
    const closeTour = () => setIsOpen(false);
    const resetTour = () => {
        localStorage.removeItem(storageKey);
        setIsOpen(true);
    };

    return { isOpen, startTour, closeTour, resetTour };
};

export default OnboardingTour;
