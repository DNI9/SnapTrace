import { describe, it, expect, beforeEach, vi } from 'vitest';
import { archiveSession, createNewSession, getSessionSummaries, getDB } from './storage';

// Mock chrome API
const mockChrome = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
  },
  runtime: {
    getURL: (path: string) => path,
  },
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
global.chrome = mockChrome as any;

describe('Archiving Logic', () => {
  beforeEach(async () => {
    // Clear DB
    const db = await getDB();
    await db.clear('sessions');
    await db.clear('appState');
    vi.clearAllMocks();
  });

  it('should archive a session correctly', async () => {
    const session = await createNewSession('Test Session');
    await archiveSession(session.id);

    const summaries = await getSessionSummaries();
    const archivedSession = summaries.find(s => s.id === session.id);

    expect(archivedSession).toBeDefined();
    expect(archivedSession?.archived).toBe(true);
  });

  it('should enforce max archived sessions limit', async () => {
    // Create 3 sessions
    const s1 = await createNewSession('S1');
    const s2 = await createNewSession('S2');
    const s3 = await createNewSession('S3');

    // Archive them in order with a small delay to ensure timestamp diff
    await archiveSession(s1.id, 2);
    await new Promise(r => setTimeout(r, 10)); // tiny delay
    await archiveSession(s2.id, 2);
    await new Promise(r => setTimeout(r, 10)); // tiny delay

    // Now archive the 3rd one, with limit 2
    // S1 should be deleted (oldest), S2 and S3 should remain
    await archiveSession(s3.id, 2);

    const summaries = await getSessionSummaries();
    expect(summaries.length).toBe(2);
    expect(summaries.map(s => s.name)).toContain('S2');
    expect(summaries.map(s => s.name)).toContain('S3');
    expect(summaries.map(s => s.name)).not.toContain('S1');
  });

  it('should deactivate session if active one is archived', async () => {
    const session = await createNewSession('Active Session');

    // Mock getActiveSessionId indirectly via appState check in archiveSession
    // But archiveSession calls getActiveSessionId which reads from DB/chrome
    // Let's ensure the session is active in DB
    const db = await getDB();
    await db.put('appState', session.id, 'activeSessionId');
    mockChrome.storage.local.get.mockResolvedValue({ activeSessionId: session.id });

    await archiveSession(session.id);

    // Verify it called remove
    expect(mockChrome.storage.local.remove).toHaveBeenCalledWith('activeSessionId');

    // Verify DB state
    const active = await db.get('appState', 'activeSessionId');
    expect(active).toBeUndefined();
  });
});
