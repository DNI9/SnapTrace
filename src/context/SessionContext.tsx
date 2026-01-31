
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
    type Session,

    getAllSessions,
    getActiveSessionId,
    createNewSession,
    setActiveSession,
    deleteSession as deleteSessionUtil
} from '../utils/storage';

interface SessionContextType {
    sessions: Session[];
    activeSessionId: string | null;
    createSession: (name: string) => Promise<void>;
    activateSession: (id: string) => Promise<void>;
    deleteSession: (id: string) => Promise<void>;
    refreshSessions: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

    const refreshSessions = async () => {
        const all = await getAllSessions();
        setSessions(all.sort((a, b) => b.createdAt - a.createdAt));
        const active = await getActiveSessionId();
        setActiveSessionId(active);
    };

    useEffect(() => {
        refreshSessions();

        // Listen for storage changes (from other contexts like Background)
        const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
            if (changes.activeSessionId) {
                setActiveSessionId((changes.activeSessionId.newValue as string) || null);
            }
            // If sessions change... we might need a custom event or polling
            // For now, relying on local actions or explicit refresh
        };
        chrome.storage.local.onChanged.addListener(listener);
        return () => chrome.storage.local.onChanged.removeListener(listener);
    }, []);

    const createSession = async (name: string) => {
        await createNewSession(name);
        await refreshSessions();
    };

    const activateSession = async (id: string) => {
        await setActiveSession(id);
        setActiveSessionId(id);
    };

    const deleteSession = async (id: string) => {
        await deleteSessionUtil(id);
        await refreshSessions();
    }

    return (
        <SessionContext.Provider
            value={{
                sessions,
                activeSessionId,
                createSession,
                activateSession,
                deleteSession,
                refreshSessions
            }}
        >
            {children}
        </SessionContext.Provider>
    );
};

export const useSession = () => {
    const context = useContext(SessionContext);
    if (!context) {
        throw new Error('useSession must be used within a SessionProvider');
    }
    return context;
};
