import React from 'react';
import { Outlet } from 'react-router-dom';
import { BentoSidebar } from './BentoSidebar';
import { BentoTopbar } from './BentoTopbar';

export const BentoLayout = () => {
    return (
        <div className="flex h-screen bg-[#FAF9F6] dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans overflow-hidden selection:bg-primary/30 transition-colors duration-300">
            <BentoSidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <BentoTopbar />
                <main className="flex-1 overflow-y-auto p-8 pt-2 scroll-smooth">
                    <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};
