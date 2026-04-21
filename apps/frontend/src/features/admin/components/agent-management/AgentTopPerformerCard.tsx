import React from 'react';
import { Crown, Award } from 'lucide-react';

export const TopPerformerCard: React.FC<{ name: string; tickets: number }> = ({ name, tickets }) => (
    <div className="relative rounded-xl p-5 bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] hover:shadow-md transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out hover:-translate-y-0.5 overflow-hidden group">
        {/* Accent line */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[hsl(var(--accent))] transition-[opacity,transform,colors] duration-200 ease-out group-hover:w-1.5" />
        
        <div className="flex items-center justify-between relative z-10 pl-1">
            <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--accent))] mb-1 flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5" />
                    Top Performer
                </p>
                <p className="text-xl font-extrabold text-slate-900 dark:text-white truncate max-w-[140px] tracking-tight">{name}</p>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">{tickets} tickets this month</p>
            </div>
            <div className="p-2.5 rounded-lg bg-[hsl(var(--accent))]/10 dark:bg-[hsl(var(--accent))]/5 transition-colors group-hover:bg-[hsl(var(--accent))]/20">
                <Award className="w-5 h-5 text-[hsl(var(--accent))]" />
            </div>
        </div>
    </div>
);
