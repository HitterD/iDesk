import { createContext, useContext, type ReactNode } from 'react';

/** True for read-only viewers (managers, report owners): navigation and reports stay live, anything that changes data is off. */
const CsiReadOnlyContext = createContext(false);

export const CsiReadOnlyProvider = ({ readOnly, children }: { readOnly: boolean; children: ReactNode }) => (
    <CsiReadOnlyContext.Provider value={readOnly}>{children}</CsiReadOnlyContext.Provider>
);

export const useCsiReadOnly = () => useContext(CsiReadOnlyContext);

/** Disables every control of an editing panel for read-only viewers (the server refuses writes anyway). */
export function EditOnly({ children }: { children: ReactNode }) {
    const readOnly = useCsiReadOnly();
    if (!readOnly) return <>{children}</>;
    return <fieldset disabled className="m-0 min-w-0 border-0 p-0">{children}</fieldset>;
}
