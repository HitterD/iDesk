import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
    message: string;
    icon?: React.ElementType;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ message, icon: Icon = Inbox }) => {
    return (
        <div className="flex flex-col items-center justify-center h-64 p-8 text-center border-2 border-dashed border-white/10 rounded-xl bg-white/5">
            <div className="p-4 bg-navy-main rounded-full mb-4 border border-white/10">
                <Icon className="w-8 h-8 text-slate-500" />
            </div>
            <p className="text-slate-400 font-medium">{message}</p>
        </div>
    );
};
