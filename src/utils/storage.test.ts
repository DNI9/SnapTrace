import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { type IDBPDatabase } from 'idb';
import {
  getDB,
  createNewSession,
  getActiveSessionId,
  getAllSessions,
  getSessionSummaries,
  setActiveSession,
  deleteSession,
  addEvidenceToSession,
  renameSession,
  compressImage,
} from './storage';

// Override getDB for testing with isolated databases
let testDB: IDBPDatabase<{
  sessions: {
    key: string;
    value: { id: string; name: string; createdAt: number; items: object[] };
  };
  appState: { key: string; value: string };
}> | null = null;

describe('Storage Utilities', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Close any existing connection
    if (testDB) {
      testDB.close();
      testDB = null;
    }
  });

  afterEach(() => {
    if (testDB) {
      testDB.close();
      testDB = null;
    }
  });

  describe('getDB', () => {
    it('should initialize database with required object stores', async () => {
      const db = await getDB();
      expect(db.objectStoreNames.contains('sessions')).toBe(true);
      expect(db.objectStoreNames.contains('appState')).toBe(true);
      db.close();
    });
  });

  describe('createNewSession', () => {
    it('should create a new session with correct structure', async () => {
      const session = await createNewSession('Test Session');

      expect(session).toMatchObject({
        name: 'Test Session',
        items: [],
      });
      expect(session.id).toBeDefined();
      expect(typeof session.id).toBe('string');
      expect(session.createdAt).toBeDefined();
      expect(typeof session.createdAt).toBe('number');
    });

    it('should update Chrome storage with active session ID', async () => {
      const session = await createNewSession('Storage Session');
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        activeSessionId: session.id,
      });
    });
  });

  describe('getActiveSessionId', () => {
    it('should return the active session ID after creation', async () => {
      const session = await createNewSession('Active Test');
      const activeId = await getActiveSessionId();
      expect(activeId).toBe(session.id);
    });
  });

  describe('getAllSessions', () => {
    it('should return created sessions', async () => {
      await createNewSession('Session 1');
      await createNewSession('Session 2');

      const sessions = await getAllSessions();
      expect(sessions.length).toBeGreaterThanOrEqual(2);
      expect(sessions.map(s => s.name)).toContain('Session 1');
      expect(sessions.map(s => s.name)).toContain('Session 2');
    });
  });

  describe('getSessionSummaries', () => {
    it('should return summaries with item counts', async () => {
      const session = await createNewSession('Summary Test');
      await addEvidenceToSession(session.id, {
        description: 'Test evidence',
        imageUrl: 'data:image/png;base64,test',
        url: 'https://example.com',
      });

      const summaries = await getSessionSummaries();
      const summary = summaries.find(s => s.id === session.id);
      expect(summary).toBeDefined();
      expect(summary!.itemCount).toBe(1);
    });
  });

  describe('setActiveSession', () => {
    it('should update the active session ID', async () => {
      const session1 = await createNewSession('Session 1');
      await createNewSession('Session 2');

      await setActiveSession(session1.id);
      const activeId = await getActiveSessionId();
      expect(activeId).toBe(session1.id);
    });

    it('should update Chrome storage', async () => {
      const session = await createNewSession('Storage Test');
      vi.clearAllMocks();
      await setActiveSession(session.id);
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        activeSessionId: session.id,
      });
    });
  });

  describe('deleteSession', () => {
    it('should remove the session from database', async () => {
      const session = await createNewSession('Delete Me');
      await deleteSession(session.id);

      const sessions = await getAllSessions();
      expect(sessions.find(s => s.id === session.id)).toBeUndefined();
    });

    it('should call Chrome storage remove when deleted session was active', async () => {
      const session = await createNewSession('Active Delete');
      vi.clearAllMocks();

      await deleteSession(session.id);
      expect(chrome.storage.local.remove).toHaveBeenCalledWith('activeSessionId');
    });
  });

  describe('addEvidenceToSession', () => {
    it('should add evidence with generated ID and timestamp', async () => {
      const session = await createNewSession('Evidence Test');
      await addEvidenceToSession(session.id, {
        description: 'Test screenshot',
        imageUrl: 'data:image/png;base64,test',
        url: 'https://example.com',
      });

      const sessions = await getAllSessions();
      const updatedSession = sessions.find(s => s.id === session.id);
      expect(updatedSession?.items).toHaveLength(1);
      expect(updatedSession?.items[0]).toMatchObject({
        description: 'Test screenshot',
        imageUrl: 'data:image/png;base64,test',
        url: 'https://example.com',
      });
      expect(updatedSession?.items[0].id).toBeDefined();
      expect(updatedSession?.items[0].timestamp).toBeDefined();
    });

    it('should throw error for non-existent session', async () => {
      await expect(
        addEvidenceToSession('non-existent-id', {
          description: 'Test',
          imageUrl: 'data:image/png;base64,test',
          url: 'https://example.com',
        })
      ).rejects.toThrow('Session not found');
    });
  });

  describe('renameSession', () => {
    it('should update session name', async () => {
      const session = await createNewSession('Old Name');
      await renameSession(session.id, 'New Name');

      const sessions = await getAllSessions();
      const updatedSession = sessions.find(s => s.id === session.id);
      expect(updatedSession?.name).toBe('New Name');
    });

    it('should throw error for non-existent session', async () => {
      await expect(renameSession('non-existent-id', 'New Name')).rejects.toThrow(
        'Session not found'
      );
    });
  });

  describe('compressImage', () => {
    it('should return original image if under size limit', async () => {
      const smallImage =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const result = await compressImage(smallImage, 1.5);
      expect(result).toBe(smallImage);
    });
  });
});
