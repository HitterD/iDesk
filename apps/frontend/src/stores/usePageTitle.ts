import { useEffect } from 'react';
import type { ElementType } from 'react';
import { create } from 'zustand';

/** Title a page shows in the agent topbar in place of the greeting. */
export interface PageTitle {
    title: string;
    description: string;
    icon: ElementType;
    /** `.nav-tile[data-tone]` hue. */
    tone: string;
}

interface PageTitleState {
    current: PageTitle | null;
    set: (title: PageTitle | null) => void;
}

export const usePageTitleStore = create<PageTitleState>((set) => ({
    current: null,
    set: (current) => set({ current }),
}));

/** Puts this page's title in the topbar while it is mounted; the greeting returns when it unmounts. */
export function usePageTitle({ title, description, icon, tone }: PageTitle): void {
    const setTitle = usePageTitleStore((state) => state.set);
    useEffect(() => {
        setTitle({ title, description, icon, tone });
        return () => setTitle(null);
    }, [setTitle, title, description, icon, tone]);
}
