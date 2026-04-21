import React from 'react';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';

export const NotificationCenterPage: React.FC = () => {
    return (
        <div className="p-6 md:p-8 lg:p-12 w-full">
            <NotificationCenter />
        </div>
    );
};

export default NotificationCenterPage;
