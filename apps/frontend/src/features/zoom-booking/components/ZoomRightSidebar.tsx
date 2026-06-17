import { useState } from 'react';
import { Zap, FileText, ListChecks, CheckCircle2, Keyboard, User as UserIcon, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ZoomBooking } from '../types';
import type { AccountLoad } from '../utils/autoPickAccount';
import { useMyTasks } from '../hooks/useMyTasks';

export interface ZoomRightSidebarProps {
    accounts: AccountLoad[];
    upcomingBookings: ZoomBooking[];
    onBook1Hour: () => void;
    onBookCustom: () => void;
    onSync: () => void;
    lastSyncAt: Date | null;
    userName: string;
}

export function ZoomRightSidebar({
    accounts,
    upcomingBookings,
    onBook1Hour,
    onBookCustom,
    onSync,
    lastSyncAt,
    userName,
}: ZoomRightSidebarProps) {
    const top5 = [...accounts]
        .sort((a, b) => b.meetingsAtTime - a.meetingsAtTime)
        .slice(0, 5);

    const { tasks, addTask, toggleTask, removeTask } = useMyTasks();
    const [newTaskText, setNewTaskText] = useState('');

    const commitTask = () => {
        if (!newTaskText.trim()) return;
        addTask(newTaskText);
        setNewTaskText('');
    };

    return (
        <aside
            data-testid="zoom-right-sidebar"
            className="w-[280px] shrink-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 flex flex-col min-h-0"
        >
            {/* D1 · Account Load */}
            <section className="p-3 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-2">
                    Account Load
                </h3>
                {top5.length === 0 ? (
                    <p className="text-xs text-slate-500">No accounts</p>
                ) : (
                    <ul className="space-y-1.5">
                        {top5.map((acc) => (
                            <li
                                key={acc.id}
                                className="flex items-center gap-2 text-[11px]"
                            >
                                <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: acc.colorHex }}
                                    aria-hidden="true"
                                />
                                <span className="flex-1 truncate text-slate-700 dark:text-slate-200">
                                    {acc.name}
                                </span>
                                <span className="text-slate-500 font-semibold">
                                    {acc.meetingsAtTime}
                                </span>
                                <span className="w-12 h-1 bg-slate-100 dark:bg-slate-800 rounded overflow-hidden">
                                    <span
                                        className="block h-full"
                                        style={{
                                            width: `${Math.min(100, (acc.meetingsAtTime / 25) * 100)}%`,
                                            backgroundColor: acc.colorHex,
                                        }}
                                    />
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {/* D2 · Upcoming */}
            <section className="p-3 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                        Upcoming
                    </h3>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        {upcomingBookings.length}
                    </span>
                </div>
                {upcomingBookings.length === 0 ? (
                    <p className="text-xs text-slate-500">No upcoming meetings</p>
                ) : (
                    <ul className="space-y-1.5">
                        {upcomingBookings.slice(0, 3).map((b) => (
                            <li
                                key={b.id}
                                className="px-2 py-1.5 rounded text-[11px] bg-blue-50 dark:bg-blue-950/30 border-l-2 border-blue-500"
                            >
                                <div className="font-semibold truncate text-slate-800 dark:text-slate-200">
                                    {b.title}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                    {b.bookingDate} · {b.startTime}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {/* D3 · Quick Book */}
            <section className="p-3 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-2">
                    Quick Book
                </h3>
                <div className="flex flex-col gap-1.5">
                    <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 gap-1.5"
                        onClick={onBook1Hour}
                    >
                        <Zap className="h-3 w-3" aria-hidden="true" /> 1 hour meeting
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8 gap-1.5"
                        onClick={onBookCustom}
                    >
                        <FileText className="h-3 w-3" aria-hidden="true" /> Custom…
                    </Button>
                </div>
            </section>

            {/* D4 · My Tasks */}
            <section className="p-3 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                        My Tasks
                    </h3>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={commitTask}
                        aria-label="Add task"
                        data-testid="add-task-btn"
                    >
                        <Plus className="h-3 w-3" aria-hidden="true" />
                    </Button>
                </div>
                <input
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') commitTask();
                    }}
                    placeholder="Add a task…"
                    aria-label="New task text"
                    className="w-full text-[11px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 mb-2"
                />
                {tasks.length === 0 ? (
                    <p className="text-[10px] text-slate-500 italic">No tasks yet</p>
                ) : (
                    <ul className="space-y-1" data-testid="task-list">
                        {tasks.map((t) => (
                            <li
                                key={t.id}
                                className="flex items-center gap-1.5 text-[11px]"
                                data-testid={`task-row-${t.id}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={t.done}
                                    onChange={() => toggleTask(t.id)}
                                    className="h-3 w-3"
                                    aria-label={`Toggle ${t.text}`}
                                />
                                <span
                                    className={`flex-1 ${t.done ? 'line-through opacity-60' : ''}`}
                                >
                                    {t.text}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => removeTask(t.id)}
                                    className="text-slate-400 hover:text-red-500"
                                    aria-label={`Delete ${t.text}`}
                                >
                                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {/* D5 · System (pinned to bottom) */}
            <section className="p-3 mt-auto">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-2">
                    System
                </h3>
                <button
                    type="button"
                    onClick={onSync}
                    className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 mb-1 hover:underline"
                >
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                    {lastSyncAt ? `Sync OK · ${formatRelative(lastSyncAt)}` : 'Never synced'}
                </button>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-1">
                    <UserIcon className="h-3 w-3" aria-hidden="true" />
                    Logged in as <strong className="text-slate-800 dark:text-slate-200">{userName}</strong>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Keyboard className="h-3 w-3" aria-hidden="true" />
                    Tekan <kbd className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1 rounded text-[10px] font-mono">?</kbd> untuk shortcuts
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
