import React, { useState, useCallback, createContext, useContext } from 'react';

interface Announcement {
    id: string;
    message: string;
    priority: 'polite' | 'assertive';
}

interface ScreenReaderContextValue {
    announce: (message: string, priority?: 'polite' | 'assertive') => void;
    announcePolite: (message: string) => void;
    announceAssertive: (message: string) => void;
}

const ScreenReaderContext = createContext<ScreenReaderContextValue | null>(null);

// Hook to use screen reader announcements
export function useScreenReaderAnnounce() {
    const context = useContext(ScreenReaderContext);
    if (!context) {
        throw new Error('useScreenReaderAnnounce must be used within ScreenReaderProvider');
    }
    return context;
}

// Provider component
export const ScreenReaderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [politeMessage, setPoliteMessage] = useState('');
    const [assertiveMessage, setAssertiveMessage] = useState('');

    const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
        if (priority === 'assertive') {
            setAssertiveMessage('');
            setTimeout(() => setAssertiveMessage(message), 50);
        } else {
            setPoliteMessage('');
            setTimeout(() => setPoliteMessage(message), 50);
        }

        // Clear after announcement
        setTimeout(() => {
            if (priority === 'assertive') {
                setAssertiveMessage('');
            } else {
                setPoliteMessage('');
            }
        }, 1000);
    }, []);

    const announcePolite = useCallback((message: string) => {
        announce(message, 'polite');
    }, [announce]);

    const announceAssertive = useCallback((message: string) => {
        announce(message, 'assertive');
    }, [announce]);

    return (
        <ScreenReaderContext.Provider value={{ announce, announcePolite, announceAssertive }}>
            {children}
            
            {/* Polite live region */}
            <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="sr-announce"
            >
                {politeMessage}
            </div>

            {/* Assertive live region */}
            <div
                role="alert"
                aria-live="assertive"
                aria-atomic="true"
                className="sr-announce"
            >
                {assertiveMessage}
            </div>
        </ScreenReaderContext.Provider>
    );
};

// Standalone announcement component for simple use cases
interface ScreenReaderOnlyProps {
    message: string;
    priority?: 'polite' | 'assertive';
}

export const ScreenReaderOnly: React.FC<ScreenReaderOnlyProps> = ({
    message,
    priority = 'polite',
}) => {
    return (
        <div
            role={priority === 'assertive' ? 'alert' : 'status'}
            aria-live={priority}
            aria-atomic="true"
            className="sr-announce"
        >
            {message}
        </div>
    );
};

// Helper hook for common announcements
export function useCommonAnnouncements() {
    const { announcePolite, announceAssertive } = useScreenReaderAnnounce();

    return {
        announceLoading: (item: string) => announcePolite(`Loading ${item}...`),
        announceLoaded: (item: string) => announcePolite(`${item} loaded.`),
        announceError: (message: string) => announceAssertive(`Error: ${message}`),
        announceSuccess: (message: string) => announcePolite(message),
        announceNavigation: (page: string) => announcePolite(`Navigated to ${page}`),
        announceFormError: (field: string, error: string) => 
            announceAssertive(`${field}: ${error}`),
        announceItemCount: (count: number, item: string) => 
            announcePolite(`${count} ${item}${count !== 1 ? 's' : ''} found`),
        announceStatusChange: (item: string, newStatus: string) =>
            announcePolite(`${item} status changed to ${newStatus}`),
    };
}

export default ScreenReaderProvider;
