import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { SessionProvider } from './SessionProvider';
import { useSession } from './useSession';
import React from 'react';

// Test component to access context values
function TestConsumer({ onMount }: { onMount?: (ctx: ReturnType<typeof useSession>) => void }) {
  const ctx = useSession();
  React.useEffect(() => {
    onMount?.(ctx);
  }, [ctx, onMount]);
  return (
    <div>
      <div data-testid="session-count">{ctx.sessions.length}</div>
      <div data-testid="active-session">{ctx.activeSessionId || 'none'}</div>
    </div>
  );
}

describe('SessionProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should provide context with required methods', async () => {
    let contextValue: ReturnType<typeof useSession> | null = null;

    render(
      <SessionProvider>
        <TestConsumer
          onMount={ctx => {
            contextValue = ctx;
          }}
        />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(contextValue).not.toBeNull();
      expect(contextValue!.createSession).toBeDefined();
      expect(contextValue!.activateSession).toBeDefined();
      expect(contextValue!.deleteSession).toBeDefined();
      expect(contextValue!.renameSession).toBeDefined();
      expect(contextValue!.refreshSessions).toBeDefined();
    });
  });

  it('should create session and update state', async () => {
    let contextValue: ReturnType<typeof useSession> | null = null;

    render(
      <SessionProvider>
        <TestConsumer
          onMount={ctx => {
            contextValue = ctx;
          }}
        />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(contextValue).not.toBeNull();
    });

    // Create a session
    await act(async () => {
      await contextValue!.createSession('Test Session');
    });

    await waitFor(() => {
      expect(contextValue!.sessions.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('should listen for storage changes', async () => {
    render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>
    );

    // Verify that the listener was added
    expect(chrome.storage.local.onChanged.addListener).toHaveBeenCalled();
  });

  it('should render children correctly', () => {
    render(
      <SessionProvider>
        <div data-testid="child">Child content</div>
      </SessionProvider>
    );

    expect(screen.getByTestId('child')).toHaveTextContent('Child content');
  });

  it('should provide sessions array', async () => {
    let contextValue: ReturnType<typeof useSession> | null = null;

    render(
      <SessionProvider>
        <TestConsumer
          onMount={ctx => {
            contextValue = ctx;
          }}
        />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(contextValue).not.toBeNull();
      expect(Array.isArray(contextValue!.sessions)).toBe(true);
    });
  });
});
