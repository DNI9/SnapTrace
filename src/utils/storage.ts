import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { v4 as uuidv4 } from 'uuid';

export interface EvidenceItem {
  id: string;
  timestamp: number;
  imageUrl: string;
  description: string;
  url: string;
}

export interface Session {
  id: string;
  name: string;
  createdAt: number;
  items: EvidenceItem[];
}

interface SnapTraceDB extends DBSchema {
  sessions: {
    key: string;
    value: Session;
  };
  appState: {
    key: string;
    value: string; // activeSessionId
  };
}

const DB_NAME = 'snaptrace-db';
const DB_VERSION = 1;

export async function getDB(): Promise<IDBPDatabase<SnapTraceDB>> {
  return openDB<SnapTraceDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('appState')) {
        db.createObjectStore('appState');
      }
    },
  });
}

export async function createNewSession(name: string): Promise<Session> {
  const db = await getDB();
  const newSession: Session = {
    id: uuidv4(),
    name,
    createdAt: Date.now(),
    items: [],
  };
  await db.put('sessions', newSession);
  await db.put('appState', newSession.id, 'activeSessionId');
  await chrome.storage.local.set({ activeSessionId: newSession.id });
  return newSession;
}

export async function getActiveSessionId(): Promise<string | null> {
  const db = await getDB();
  return (await db.get('appState', 'activeSessionId')) || null;
}

export async function getAllSessions(): Promise<Session[]> {
  const db = await getDB();
  return await db.getAll('sessions');
}

export async function setActiveSession(id: string): Promise<void> {
  const db = await getDB();
  await db.put('appState', id, 'activeSessionId');
  await chrome.storage.local.set({ activeSessionId: id });
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('sessions', id);
  const activeId = await getActiveSessionId();
  if (activeId === id) {
    await db.delete('appState', 'activeSessionId');
    await chrome.storage.local.remove('activeSessionId');
  }
}

export async function addEvidenceToSession(
  sessionId: string,
  evidence: Omit<EvidenceItem, 'id' | 'timestamp'>
): Promise<void> {
  const db = await getDB();
  const session = await db.get('sessions', sessionId);
  if (!session) throw new Error('Session not found');

  const newItem: EvidenceItem = {
    ...evidence,
    id: uuidv4(),
    timestamp: Date.now(),
  };

  session.items.push(newItem);
  await db.put('sessions', session);
}
