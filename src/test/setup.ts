import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { vi, beforeEach } from 'vitest';

// Mock Chrome API
const mockChrome = {
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  },
  runtime: {
    sendMessage: vi.fn().mockResolvedValue({ success: true }),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    getContexts: vi.fn().mockResolvedValue([]),
    getURL: vi.fn((path: string) => `chrome-extension://mock-extension-id/${path}`),
  },
  tabs: {
    query: vi.fn().mockResolvedValue([{ id: 1, windowId: 1 }]),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    captureVisibleTab: vi.fn().mockResolvedValue('data:image/png;base64,mock'),
  },
  action: {
    openPopup: vi.fn(),
  },
  commands: {
    onCommand: {
      addListener: vi.fn(),
    },
  },
  downloads: {
    download: vi.fn().mockResolvedValue(undefined),
  },
  offscreen: {
    createDocument: vi.fn().mockResolvedValue(undefined),
    Reason: {
      DOM_PARSER: 'DOM_PARSER',
    },
  },
};

// Assign to global
(globalThis as unknown as { chrome: typeof mockChrome }).chrome = mockChrome;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});
