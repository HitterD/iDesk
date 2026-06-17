import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'zoom-calendar-tasks';

export interface MyTask {
    id: string;
    text: string;
    done: boolean;
}

function loadTasks(): MyTask[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function genId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useMyTasks() {
    const [tasks, setTasks] = useState<MyTask[]>(loadTasks);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    }, [tasks]);

    const addTask = useCallback((text: string) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        setTasks((prev) => [...prev, { id: genId(), text: trimmed, done: false }]);
    }, []);

    const toggleTask = useCallback((id: string) => {
        setTasks((prev) =>
            prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
        );
    }, []);

    const removeTask = useCallback((id: string) => {
        setTasks((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return { tasks, addTask, toggleTask, removeTask };
}
