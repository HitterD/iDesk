import React, { useState } from 'react';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/stores/useAuth';

interface UserAvatarProps {
    user?: {
        id?: string;
        fullName?: string;
        avatarUrl?: string;
    } | null;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    showFallbackIcon?: boolean;
    useCurrentUser?: boolean;
}

const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-20 h-20 text-xl',
};

const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-10 h-10',
};

const getImageUrl = (url?: string | null): string | null => {
    if (!url) return null;
    if (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')) return url;
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5050';
    return `${apiUrl}${url}`;
};

const getInitials = (name?: string): string => {
    if (!name) return '?';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0]?.[0]?.toUpperCase() || '?';
};

const gradientColors = [
    'from-blue-500 to-indigo-600',
    'from-purple-500 to-pink-600',
    'from-green-500 to-teal-600',
    'from-orange-500 to-red-600',
    'from-cyan-500 to-blue-600',
    'from-pink-500 to-rose-600',
    'from-amber-500 to-orange-600',
    'from-emerald-500 to-green-600',
];

const getGradientColor = (name?: string): string => {
    if (!name) return gradientColors[0];
    const index = name.charCodeAt(0) % gradientColors.length;
    return gradientColors[index];
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
    user: propUser,
    size = 'md',
    className,
    showFallbackIcon = false,
    useCurrentUser = false,
}) => {
    const { user: authUser } = useAuth();
    const [imgError, setImgError] = useState(false);

    const user = useCurrentUser ? authUser : propUser;
    const avatarUrl = getImageUrl(user?.avatarUrl);
    const initials = getInitials(user?.fullName);
    const gradient = getGradientColor(user?.fullName);

    const handleImageError = () => {
        setImgError(true);
    };

    const showImage = avatarUrl && !imgError;

    return (
        <div
            className={cn(
                'rounded-full flex items-center justify-center font-bold text-white shrink-0 overflow-hidden',
                !showImage && `bg-gradient-to-br ${gradient}`,
                sizeClasses[size],
                className
            )}
        >
            {showImage ? (
                <img
                    src={avatarUrl}
                    alt={user?.fullName || 'User avatar'}
                    className="w-full h-full object-cover"
                    onError={handleImageError}
                />
            ) : showFallbackIcon ? (
                <User className={cn('text-white/80', iconSizes[size])} />
            ) : (
                <span>{initials}</span>
            )}
        </div>
    );
};

export default UserAvatar;
