import { createContext } from 'react';
import { type SessionSummary } from '../utils/storage';

export interface SessionContextType {
  sessions: SessionSummary[];
  activeSessionId: string | null;
  createSession: (name: string) => Promise<void>;
  activateSession: (id: string) => Promise<void>;
  archiveSession: (id: string, maxArchivedSessions?: number) => Promise<void>;
  removeSession: (id: string) => Promise<void>;
  renameSession: (id: string, newName: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
}

export const SessionContext = createContext<SessionContextType | undefined>(undefined);
