import React from 'react';
import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { MajorIncidentTicker } from '../dashboard/MajorIncidentTicker';
import { Topbar } from './Topbar';
import { Toaster } from 'sonner';

export const MainLayout: React.FC = () => {
    return (
        <div className="flex h-screen bg-navy-main overflow-hidden">
            {/* Sidebar */}
            <AppSidebar />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
                <Topbar />
                <MajorIncidentTicker />

                <main className="flex-1 overflow-y-auto p-6 scroll-smooth">
                    <div className="max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                </main>
            </div>
            <Toaster position="top-right" theme="dark" />
        </div>
    );
};
