import React, { useEffect, useState } from 'react';
import {
  type Session,
  getAllSessions,
  getActiveSessionId,
  createNewSession,
  setActiveSession,
  deleteSession as deleteSessionUtil,
} from '../utils/storage';
import { SessionContext } from './SessionContext';

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const refreshSessions = async () => {
    const all = await getAllSessions();
    setSessions(all.sort((a, b) => b.createdAt - a.createdAt));
    const active = await getActiveSessionId();
    setActiveSessionId(active);
  };

  // Initial data load
  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      const all = await getAllSessions();
      const active = await getActiveSessionId();
      if (isMounted) {
        setSessions(all.sort((a, b) => b.createdAt - a.createdAt));
        setActiveSessionId(active);
      }
    };

    loadInitialData();

    // Listen for storage changes (from other contexts like Background)
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.activeSessionId) {
        setActiveSessionId((changes.activeSessionId.newValue as string) || null);
      }
    };
    chrome.storage.local.onChanged.addListener(listener);

    return () => {
      isMounted = false;
      chrome.storage.local.onChanged.removeListener(listener);
    };
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
  };

  return (
    <SessionContext.Provider
      value={{
        sessions,
        activeSessionId,
        createSession,
        activateSession,
        deleteSession,
        refreshSessions,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};
