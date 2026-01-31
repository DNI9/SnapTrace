import { createContext } from 'react';
import { type Session } from '../utils/storage';

export interface SessionContextType {
  sessions: Session[];
  activeSessionId: string | null;
  createSession: (name: string) => Promise<void>;
  activateSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  renameSession: (id: string, newName: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
}

export const SessionContext = createContext<SessionContextType | undefined>(undefined);
