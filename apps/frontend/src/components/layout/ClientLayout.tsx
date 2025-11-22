import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Ticket, PlusCircle, LogOut } from 'lucide-react';

export const ClientLayout: React.FC = () => {
    const location = useLocation();

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
            {/* Navbar */}
            <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex">
                            <div className="flex-shrink-0 flex items-center">
                                <span className="text-xl font-bold text-slate-900 tracking-tight">
                                    HelpDesk<span className="text-blue-600">Portal</span>
                                </span>
                            </div>
                            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                                <Link
                                    to="/client/my-tickets"
                                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${location.pathname === '/client/my-tickets'
                                            ? 'border-blue-500 text-gray-900'
                                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                        }`}
                                >
                                    <Ticket className="w-4 h-4 mr-2" />
                                    My Tickets
                                </Link>
                                <Link
                                    to="/client/create"
                                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${location.pathname === '/client/create'
                                            ? 'border-blue-500 text-gray-900'
                                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                        }`}
                                >
                                    <PlusCircle className="w-4 h-4 mr-2" />
                                    New Ticket
                                </Link>
                            </div>
                        </div>
                        <div className="flex items-center">
                            <button className="p-2 rounded-full text-gray-400 hover:text-gray-500">
                                <span className="sr-only">View notifications</span>
                                {/* Notification Bell Icon could go here */}
                            </button>
                            <div className="ml-3 relative">
                                <div className="flex items-center space-x-3">
                                    <span className="text-sm font-medium text-gray-700">John Client</span>
                                    <button className="text-gray-500 hover:text-red-600">
                                        <LogOut className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Outlet />
            </main>
        </div>
    );
};
