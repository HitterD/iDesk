import React from 'react';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';

export const NotificationCenterPage: React.FC = () => {
    return (
        <div className="w-full">
            <NotificationCenter />
        </div>
    );
};

export default NotificationCenterPage;
