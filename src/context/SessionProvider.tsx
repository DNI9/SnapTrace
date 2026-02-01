import React, { useEffect, useState } from 'react';
import {
  type SessionSummary,
  getSessionSummaries,
  getActiveSessionId,
  createNewSession,
  setActiveSession,
  archiveSession as archiveSessionUtil,
  permanentlyDeleteSession,
  renameSession as renameSessionUtil,
} from '../utils/storage';
import { SessionContext } from './SessionContext';

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const refreshSessions = async () => {
    const all = await getSessionSummaries();
    setSessions(all.sort((a, b) => b.createdAt - a.createdAt));
    const active = await getActiveSessionId();
    setActiveSessionId(active);
  };

  // Initial data load
  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      const all = await getSessionSummaries();
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

  const archiveSession = async (id: string, maxArchivedSessions: number = 10) => {
    await archiveSessionUtil(id, maxArchivedSessions);
    await refreshSessions();
  };

  const removeSession = async (id: string) => {
    await permanentlyDeleteSession(id);
    await refreshSessions();
  };

  const renameSession = async (id: string, newName: string) => {
    await renameSessionUtil(id, newName);
    await refreshSessions();
  };

  return (
    <SessionContext.Provider
      value={{
        sessions,
        activeSessionId,
        createSession,
        activateSession,
        archiveSession,
        removeSession,
        renameSession,
        refreshSessions,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};
