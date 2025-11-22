import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Kanban,
    List,
    Settings,
    Users,
    LogOut,
    Ticket,
    PlusCircle,
    Plus,
    FileSpreadsheet,
    BookOpen,
    Clock
} from 'lucide-react';
import { useAuth } from '../../stores/useAuth';
import { CreateTicketDialog } from '../../features/ticket-board/components/CreateTicketDialog';

export const AppSidebar: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [isCreateTicketOpen, setIsCreateTicketOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const adminLinks = [
        { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/kanban', icon: Kanban, label: 'Kanban Board' },
        { path: '/tickets/list', icon: List, label: 'All Tickets' },
        { path: '/agents', icon: Users, label: 'Agents' },
        { path: '/reports', icon: FileSpreadsheet, label: 'Reports' },
        { path: '/sla', icon: Clock, label: 'SLA Settings' },
        { path: '/kb', icon: BookOpen, label: 'Knowledge Base' },
        { path: '/settings', icon: Settings, label: 'Settings' },
    ];

    const userLinks = [
        { path: '/client/my-tickets', icon: Ticket, label: 'My Tickets' },
        { path: '/client/create', icon: PlusCircle, label: 'Create Ticket' },
        { path: '/kb', icon: BookOpen, label: 'Knowledge Base' },
    ];

    const links = user?.role === 'USER' ? userLinks : adminLinks;

    return (
        <>
            <aside className="w-64 flex-shrink-0 border-r border-white/10 bg-navy-light hidden md:flex flex-col h-full">
                <div className="p-6">
                    {/* New Ticket Button for Agents/Admins */}
                    {user?.role !== 'USER' && (
                        <button
                            onClick={() => setIsCreateTicketOpen(true)}
                            className="w-full mb-6 bg-gradient-to-r from-neon-green to-emerald-500 text-navy-main font-bold py-3 px-4 rounded-xl shadow-lg shadow-neon-green/20 hover:shadow-neon-green/30 hover:scale-[1.02] transition-all duration-200 flex items-center justify-center gap-2"
                        >
                            <Plus className="w-5 h-5" />
                            <span>New Ticket</span>
                        </button>
                    )}

                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
                        Menu
                    </h2>
                    <nav className="space-y-2">
                        {links.map((link) => (
                            <NavLink
                                key={link.path}
                                to={link.path}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive
                                        ? 'bg-neon-green/10 text-neon-green border border-neon-green/20 shadow-[0_0_15px_rgba(0,255,157,0.1)]'
                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                    }`
                                }
                            >
                                <link.icon className="w-5 h-5" />
                                <span className="font-medium">{link.label}</span>
                            </NavLink>
                        ))}
                    </nav>
                </div>

                <div className="mt-auto p-6 border-t border-white/10">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                    >
                        <LogOut className="w-5 h-5" />
                        <span className="font-medium">Logout</span>
                    </button>
                </div>
            </aside>

            <CreateTicketDialog
                isOpen={isCreateTicketOpen}
                onClose={() => setIsCreateTicketOpen(false)}
            />
        </>
    );
};
