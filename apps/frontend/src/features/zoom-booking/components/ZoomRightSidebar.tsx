import React, { useState } from 'react';
import { CheckCircle2, Keyboard, User as UserIcon, Plus, Trash2, CheckSquare, Square, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ZoomBooking } from '../types';
import type { AccountLoad } from '../utils/autoPickAccount';

export interface ZoomRightSidebarProps {
    accounts: AccountLoad[];
    upcomingBookings: ZoomBooking[];
    onSync: () => void;
    lastSyncAt: Date | null;
    userName: string;
    selectedAccountId?: string;
    onAccountClick?: (accountId: string) => void;
}

interface LocalTask {
    id: string;
    text: string;
    completed: boolean;
}

export function ZoomRightSidebar({
    accounts,
    upcomingBookings,
    onSync,
    lastSyncAt,
    userName,
    selectedAccountId,
    onAccountClick,
}: ZoomRightSidebarProps) {
    const [tasks, setTasks] = useState<LocalTask[]>(() => {
        try {
            const saved = localStorage.getItem('zoom-sidebar-tasks');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });
    const [newTaskText, setNewTaskText] = useState('');

    const saveTasks = (newTasks: LocalTask[]) => {
        setTasks(newTasks);
        try {
            localStorage.setItem('zoom-sidebar-tasks', JSON.stringify(newTasks));
        } catch {
            // ignore
        }
    };

    const handleAddTask = (e: React.FormEvent) => {
        e.preventDefault();
        const text = newTaskText.trim();
        if (!text) return;
        const task: LocalTask = {
            id: 'task_' + Date.now(),
            text,
            completed: false,
        };
        saveTasks([...tasks, task]);
        setNewTaskText('');
    };

    const toggleTask = (id: string) => {
        saveTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    };

    const deleteTask = (id: string) => {
        saveTasks(tasks.filter(t => t.id !== id));
    };

    const maxMeetings = Math.max(1, ...accounts.map(a => a.meetingsAtTime));
    const totalMeetings = accounts.reduce((sum, a) => sum + a.meetingsAtTime, 0);

    return (
        <aside
            data-testid="zoom-right-sidebar"
            className="hidden lg:flex w-[280px] shrink-0 bg-card border-l border-border flex-col min-h-0 select-none overflow-y-auto custom-scrollbar"
        >
            {/* 1. Account Load Section (Shows real meeting volume for the active calendar period) */}
            <section className="p-4 border-b border-border">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Account Load
                    </h3>
                    <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                        {accounts.length} Akun
                    </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-2 px-0.5">
                    <span>Periode Kalender Aktif</span>
                    <span className="font-mono font-bold text-foreground">{totalMeetings} meeting{totalMeetings > 1 ? 's' : ''}</span>
                </div>

                {accounts.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No accounts</p>
                ) : (
                    <div className="space-y-1.5 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                        {accounts.map((acc) => {
                            const isSelected = selectedAccountId === acc.id;
                            return (
                                <button
                                    key={acc.id}
                                    type="button"
                                    onClick={() => onAccountClick && onAccountClick(acc.id)}
                                    className={cn(
                                        "w-full flex items-center gap-2 text-xs p-1.5 rounded-lg transition-colors text-left group cursor-pointer",
                                        isSelected
                                            ? "bg-primary/10 border border-primary/30 text-primary font-semibold"
                                            : "hover:bg-muted/60 text-foreground"
                                    )}
                                    title={`Klik untuk filter kalender ke ${acc.name} (${acc.meetingsAtTime} meeting)`}
                                >
                                    <span
                                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                                        style={{ backgroundColor: acc.colorHex }}
                                        aria-hidden="true"
                                    />
                                    <span className="flex-1 truncate text-xs font-medium">
                                        {acc.name}
                                    </span>
                                    <span className={cn(
                                        "text-xs font-mono tabular-nums mr-1",
                                        acc.meetingsAtTime > 0 ? "font-bold text-foreground" : "text-muted-foreground/60"
                                    )}>
                                        {acc.meetingsAtTime}
                                    </span>
                                    <span className="w-12 h-1.5 bg-muted rounded-full overflow-hidden shrink-0">
                                        <span
                                            className="block h-full rounded-full transition-all duration-300"
                                            style={{
                                                width: `${Math.min(100, (acc.meetingsAtTime / maxMeetings) * 100)}%`,
                                                backgroundColor: acc.colorHex,
                                            }}
                                        />
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* 2. Upcoming Meetings Section */}
            <section className="p-4 border-b border-border">
                <div className="flex items-center justify-between mb-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Upcoming
                    </h3>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary tabular-nums">
                        {upcomingBookings.length}
                    </span>
                </div>

                {upcomingBookings.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No upcoming meetings</p>
                ) : (
                    <ul className="space-y-2 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
                        {upcomingBookings.slice(0, 5).map((b) => (
                            <li
                                key={b.id}
                                className="p-2.5 rounded-xl border border-border/80 bg-background/60 hover:bg-muted/40 transition-colors text-xs space-y-1 shadow-2xs"
                            >
                                <div className="font-bold truncate text-foreground leading-snug">
                                    {b.title}
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                    <span>{b.bookingDate}</span>
                                    <span className="font-mono font-semibold text-primary">{b.startTime} - {b.endTime}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {/* 3. My Tasks / Meeting Notes Section */}
            <section className="p-4 border-b border-border">
                <div className="flex items-center justify-between mb-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        My Tasks
                    </h3>
                    {tasks.length > 0 && (
                        <span className="text-[10px] font-mono text-muted-foreground">
                            {tasks.filter(t => t.completed).length}/{tasks.length}
                        </span>
                    )}
                </div>

                <form onSubmit={handleAddTask} className="mb-2">
                    <input
                        type="text"
                        aria-label="New task text"
                        value={newTaskText}
                        onChange={(e) => setNewTaskText(e.target.value)}
                        placeholder="Tambah task/catatan..."
                        className="w-full px-2.5 py-1.5 text-xs bg-background border border-border/80 rounded-lg outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground"
                    />
                </form>

                {tasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-1 text-center italic">No tasks yet</p>
                ) : (
                    <ul className="space-y-1 max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
                        {tasks.map((task) => (
                            <li
                                key={task.id}
                                className="flex items-center gap-2 p-1 rounded-md hover:bg-muted/40 group text-xs transition-colors"
                            >
                                <button
                                    type="button"
                                    onClick={() => toggleTask(task.id)}
                                    className="text-muted-foreground hover:text-primary shrink-0 cursor-pointer"
                                >
                                    {task.completed ? (
                                        <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                                    ) : (
                                        <Square className="w-3.5 h-3.5" />
                                    )}
                                </button>
                                <span className={cn("flex-1 truncate", task.completed && "line-through text-muted-foreground")}>
                                    {task.text}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => deleteTask(task.id)}
                                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-0.5 transition-opacity shrink-0 cursor-pointer"
                                    title="Hapus task"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {/* 4. System & Shortcut Section (Pinned to bottom) */}
            <section className="p-4 mt-auto border-t border-border bg-muted/20">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
                    System
                </h3>
                <button
                    type="button"
                    onClick={onSync}
                    className="w-full flex items-center justify-between p-2 rounded-lg bg-background border border-border/70 hover:border-primary/40 text-xs font-medium text-foreground transition-all mb-2.5 shadow-2xs cursor-pointer group"
                >
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Sync Status</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                        {lastSyncAt ? formatRelative(lastSyncAt) : 'Live OK'}
                    </span>
                </button>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                    <span>Logged in as <strong className="text-foreground">{userName}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Keyboard className="w-3.5 h-3.5 shrink-0" />
                    <span>Tekan <kbd className="bg-muted border border-border px-1.5 py-0.5 rounded text-[10px] font-mono">?</kbd> untuk shortcuts</span>
                </div>
            </section>
        </aside>
    );
}

function formatRelative(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
}
