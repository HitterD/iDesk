import React from 'react';
import { Clock, User as UserIcon, MessageSquare, Info, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { IctBudgetActivity } from '../api/hardware-request.api';

interface ActivityTimelineProps {
    activities: IctBudgetActivity[];
    className?: string;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ activities, className = '' }) => {
    if (activities.length === 0) {
        return (
            <div className={`p-8 flex flex-col items-center justify-center text-muted-foreground bg-[hsl(var(--muted))]/30 rounded-2xl border border-dashed border-[hsl(var(--border))] ${className}`}>
                <Info className="w-8 h-8 mb-3 opacity-30" />
                <p className="text-sm font-medium italic opacity-60">No tracking history available yet</p>
            </div>
        );
    }

    return (
        <div className={`space-y-6 ${className}`}>
            <h3 className="text-sm font-extrabold text-[hsl(var(--foreground))] flex items-center gap-2 mb-6 uppercase tracking-wider">
                <Clock className="w-5 h-5 text-[hsl(var(--primary))]" />
                Tracking History
            </h3>

            <div className="relative space-y-8 before:absolute before:inset-0 before:ml-[1.125rem] before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-[hsl(var(--primary))]/50 before:via-[hsl(var(--border))] before:to-transparent">
                {activities.map((activity, index) => {
                    const isLatest = index === activities.length - 1;
                    
                    return (
                        <div key={activity.id} className="relative flex items-start gap-5 animate-in slide-in-from-left-4 duration-300 group">
                            {/* Status Icon Indicator */}
                            <div className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-4 border-[hsl(var(--background))] shadow-sm transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out group-hover:scale-110 ${
                                activity.action.includes('APPROVED') ? 'bg-[hsl(var(--success-500))]' : 
                                activity.action.includes('REJECTED') || activity.action.includes('CANCELLED') ? 'bg-[hsl(var(--error-500))]' :
                                activity.action.includes('ARRIVED') ? 'bg-[hsl(var(--info-500))]' :
                                activity.action.includes('REALIZED') ? 'bg-[hsl(var(--success-500))]' :
                                activity.action.includes('PURCHASING') ? 'bg-[hsl(var(--primary))]' :
                                'bg-muted-foreground'
                            }`}>
                                <div className={`h-2.5 w-2.5 rounded-full ${isLatest ? 'bg-white animate-pulse' : 'bg-[hsl(var(--background))]/50'}`} />
                            </div>

                            <div className="flex flex-col bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-5 flex-grow shadow-sm hover:shadow-md hover:border-[hsl(var(--primary))]/30 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out ">
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                    <span className="text-sm font-extrabold text-[hsl(var(--foreground))] uppercase tracking-tight">
                                        {activity.action.replace(/_/g, ' ')}
                                    </span>
                                    <time className="text-[10px] font-bold text-muted-foreground bg-[hsl(var(--muted))] px-2.5 py-1 rounded-full uppercase tracking-widest border border-[hsl(var(--border))]">
                                        {format(new Date(activity.createdAt), 'dd MMM yyyy, HH:mm')}
                                    </time>
                                </div>

                                <div className="flex flex-wrap items-center gap-3 mb-4">
                                    <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-xl border border-[hsl(var(--border))] transition-colors group-hover:bg-muted/80">
                                        <UserIcon className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
                                        <span className="text-xs font-bold text-muted-foreground">{activity.performedBy?.fullName || 'System'}</span>
                                    </div>
                                    
                                    {(activity.fromStatus || activity.toStatus) && (
                                        <div className="flex items-center gap-2.5 bg-muted/50 px-3 py-1.5 rounded-xl border border-[hsl(var(--border))]">
                                            {activity.fromStatus && (
                                                <span className="text-muted-foreground font-mono text-[9px] font-medium uppercase tracking-tighter opacity-70">{activity.fromStatus}</span>
                                            )}
                                            {activity.fromStatus && activity.toStatus && (
                                                <ChevronRight className="w-3 h-3 text-muted-foreground opacity-40" />
                                            )}
                                            {activity.toStatus && (
                                                <span className="text-[hsl(var(--primary))] font-mono text-[10px] font-extrabold uppercase tracking-tight">{activity.toStatus}</span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {activity.notes && (
                                    <div className="mt-1 p-4 bg-muted/30 rounded-xl border border-[hsl(var(--border))] flex gap-3 items-start relative overflow-hidden group/note">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[hsl(var(--primary))]/40 rounded-l-xl transition-[opacity,transform,colors] duration-200 ease-out group-hover/note:bg-[hsl(var(--primary))]" />
                                        <MessageSquare className="w-4 h-4 text-[hsl(var(--primary))]/60 shrink-0 mt-0.5" />
                                        <p className="text-xs text-muted-foreground leading-relaxed font-medium italic">
                                            "{activity.notes}"
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
