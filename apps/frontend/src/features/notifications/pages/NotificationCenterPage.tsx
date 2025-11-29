import { NotificationCenter } from '@/components/notifications/NotificationCenter';

export const NotificationCenterPage: React.FC = () => {
    return (
        <div className="p-4 md:p-6 lg:p-8 w-full">
            <NotificationCenter />
        </div>
    );
};

export default NotificationCenterPage;
