import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMyTasks } from '../useMyTasks';

describe('useMyTasks', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('starts with empty tasks', () => {
        const { result } = renderHook(() => useMyTasks());
        expect(result.current.tasks).toEqual([]);
    });

    it('addTask appends a task', () => {
        const { result } = renderHook(() => useMyTasks());
        act(() => result.current.addTask('Konfirmasi link'));
        expect(result.current.tasks).toHaveLength(1);
        expect(result.current.tasks[0].text).toBe('Konfirmasi link');
        expect(result.current.tasks[0].done).toBe(false);
        expect(result.current.tasks[0].id).toBeDefined();
    });

    it('toggleTask flips done state', () => {
        const { result } = renderHook(() => useMyTasks());
        act(() => result.current.addTask('Test'));
        const id = result.current.tasks[0].id;
        act(() => result.current.toggleTask(id));
        expect(result.current.tasks[0].done).toBe(true);
        act(() => result.current.toggleTask(id));
        expect(result.current.tasks[0].done).toBe(false);
    });

    it('removeTask deletes task', () => {
        const { result } = renderHook(() => useMyTasks());
        act(() => result.current.addTask('Doomed'));
        const id = result.current.tasks[0].id;
        act(() => result.current.removeTask(id));
        expect(result.current.tasks).toHaveLength(0);
    });

    it('persists to localStorage', () => {
        const { result } = renderHook(() => useMyTasks());
        act(() => result.current.addTask('Persisted'));
        const stored = JSON.parse(localStorage.getItem('zoom-calendar-tasks') ?? '[]');
        expect(stored[0].text).toBe('Persisted');
    });
});
