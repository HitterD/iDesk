import { createContext } from 'react';

/** Keeps nested floating controls in their owning dialog's stacking and focus scope. */
export const PopoverPortalContext = createContext<HTMLElement | null>(null);
