import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { BentoSidebar } from './BentoSidebar';
import { BentoTopbar } from './BentoTopbar';
import { cn } from '@/lib/utils';
import { useKeyboardShortcuts, KeyboardShortcutsHelp } from '@/hooks/useKeyboardShortcuts';

export const BentoLayout = () => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
    
    // Initialize keyboard shortcuts with custom actions
    useKeyboardShortcuts([
        { key: '?', shift: true, action: () => setShowShortcutsHelp(true), description: 'Show shortcuts help' },
    ]);

    return (
        <div className="flex h-screen bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans overflow-hidden selection:bg-primary/30 transition-colors duration-300">
            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                    aria-hidden="true"
                />
            )}
            
            {/* Sidebar - Hidden on mobile by default */}
            <aside className={cn(
                "fixed lg:relative inset-y-0 left-0 z-50 transition-transform duration-300 lg:translate-x-0",
                isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <BentoSidebar />
                {/* Mobile close button */}
                <button
                    className="absolute top-4 right-4 p-2 lg:hidden text-slate-500 hover:text-slate-800 dark:hover:text-white"
                    onClick={() => setIsMobileMenuOpen(false)}
                    aria-label="Close menu"
                >
                    <X className="w-6 h-6" aria-hidden="true" />
                </button>
            </aside>
            
            <div className="flex-1 flex flex-col min-w-0">
                {/* Mobile menu button */}
                <div className="lg:hidden flex items-center p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <button 
                        className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        onClick={() => setIsMobileMenuOpen(true)}
                        aria-label="Open menu"
                        aria-expanded={isMobileMenuOpen}
                    >
                        <Menu className="w-6 h-6" aria-hidden="true" />
                    </button>
                    <div className="ml-3 flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center">
                            <span className="text-white font-bold text-sm">iD</span>
                        </div>
                        <span className="font-bold text-slate-800 dark:text-white">iDesk</span>
                    </div>
                </div>
                
                <div className="hidden lg:block">
                    <BentoTopbar />
                </div>
                <main className="flex-1 overflow-y-auto p-4 lg:p-8 pt-2 scroll-smooth">
                    <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <Outlet />
                    </div>
                </main>
            </div>
            
            {/* Keyboard Shortcuts Help Modal */}
            <KeyboardShortcutsHelp 
                isOpen={showShortcutsHelp} 
                onClose={() => setShowShortcutsHelp(false)} 
            />
        </div>
    );
};
