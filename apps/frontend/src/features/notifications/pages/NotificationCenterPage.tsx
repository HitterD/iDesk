import React from 'react';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';

export const NotificationCenterPage: React.FC = () => {
    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
                    Notification Center
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                    View and manage all your notifications
                </p>
            </div>

            <NotificationCenter className="shadow-lg" />
        </div>
    );
};

export default NotificationCenterPage;
