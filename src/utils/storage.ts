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

export interface SessionSummary {
  id: string;
  name: string;
  createdAt: number;
  itemCount: number;
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

export async function getSessionSummaries(): Promise<SessionSummary[]> {
  const db = await getDB();
  const tx = db.transaction('sessions', 'readonly');
  const store = tx.objectStore('sessions');
  const summaries: SessionSummary[] = [];

  let cursor = await store.openCursor();
  while (cursor) {
    const session = cursor.value;
    summaries.push({
      id: session.id,
      name: session.name,
      createdAt: session.createdAt,
      itemCount: session.items.length,
    });
    cursor = await cursor.continue();
  }
  return summaries;
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

export async function renameSession(id: string, newName: string): Promise<void> {
  const db = await getDB();
  const session = await db.get('sessions', id);
  if (!session) throw new Error('Session not found');

  session.name = newName;
  await db.put('sessions', session);
}

// Utility to compress image if larger than limit (e.g. 1.5MB)
export async function compressImage(base64: string, maxSizeMB: number = 1.5): Promise<string> {
  // Rough estimation: base64 string length * 0.75 = bytes
  const sizeInBytes = base64.length * 0.75;
  const maxSizeInBytes = maxSizeMB * 1024 * 1024;

  if (sizeInBytes <= maxSizeInBytes) return base64;

  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // Scale down by 0.8
      const scale = 0.8;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64); // Fallback
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      // Reduce quality to 0.7
      const compressed = canvas.toDataURL('image/jpeg', 0.7);
      resolve(compressed);
    };
    img.onerror = () => resolve(base64); // Fallback
    img.src = base64;
  });
}
