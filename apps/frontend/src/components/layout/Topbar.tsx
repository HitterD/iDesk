import React from 'react';
import { Search, User } from 'lucide-react';
import { NotificationPopover } from '../notifications/NotificationPopover';
import { useAuth } from '../../stores/useAuth';

export const Topbar: React.FC = () => {
    const { user } = useAuth();

    return (
        <header className="sticky top-0 z-40 w-full h-16 bg-navy-main/80 backdrop-blur-md border-b border-neon-green/20 flex items-center justify-between px-6">
            {/* Left: Logo */}
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-neon-green to-neon-blue rounded-lg flex items-center justify-center">
                    <span className="text-navy-main font-bold text-lg">A</span>
                </div>
                <span className="text-xl font-bold text-white tracking-tight">
                    Antigravity<span className="text-neon-green">.</span>
                </span>
            </div>

            {/* Center: Search Bar */}
            <div className="hidden md:flex items-center max-w-md w-full mx-4">
                <div className="relative w-full">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-slate-500" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2 bg-navy-light border border-white/10 rounded-full text-sm text-white placeholder-slate-500 focus:outline-none focus:border-neon-green focus:ring-1 focus:ring-neon-green transition-all"
                        placeholder="Search tickets, agents, or knowledge base..."
                    />
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-4">
                <NotificationPopover />

                <div className="flex items-center gap-3 pl-4 border-l border-white/10">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium text-white">{user?.fullName || 'User'}</p>
                        <p className="text-xs text-slate-400">{user?.role || 'Agent'}</p>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-neon-blue/20 flex items-center justify-center border border-neon-blue/50 overflow-hidden">
                        {user?.avatarUrl ? (
                            <img src={user.avatarUrl} alt={user.fullName} className="w-full h-full object-cover" />
                        ) : (
                            <User className="h-4 w-4 text-neon-blue" />
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};
