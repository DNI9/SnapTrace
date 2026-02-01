import { renderHook, act } from '@testing-library/react';
import { useFabricCanvas } from './useFabricCanvas';
import { vi, describe, it, expect, beforeEach } from 'vitest';

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

// Mock Fabric
vi.mock('fabric', () => {
  class Canvas {
    dispose = vi.fn();
    on = vi.fn();
    off = vi.fn();
    setDimensions = vi.fn();
    requestRenderAll = vi.fn();
    calcOffset = vi.fn();
    toJSON = vi.fn(() => ({ objects: [] }));
    loadFromJSON = vi.fn();
    forEachObject = vi.fn();
    getObjects = vi.fn(() => []);
    remove = vi.fn();
    discardActiveObject = vi.fn();
    add = vi.fn();
    setActiveObject = vi.fn();
    selection = false;
    defaultCursor = 'default';
    backgroundImage = null;
    constructor(_el: any, _opts: any) {}
  }

  class Image {
    set = vi.fn();
    naturalWidth = 800;
    naturalHeight = 600;
    constructor(_img: any) {}
  }

  class Rect {
    set = vi.fn();
    setCoords = vi.fn();
    width = 0;
    height = 0;
    constructor(_opts: any) {}
  }

  class IText {
    enterEditing = vi.fn();
    selectAll = vi.fn();
    constructor(_text: string, _opts: any) {}
  }

  class Circle {
    constructor(_opts: any) {}
  }
  class Text {
    constructor(_text: string, _opts: any) {}
  }
  class Group {
    constructor(_objs: any[], _opts: any) {}
  }

  return {
    Canvas,
    Image,
    Rect,
    IText,
    Circle,
    Text,
    Group,
  };
});

describe('useFabricCanvas', () => {
  let canvasElRef: any;
  let containerRef: any;

  beforeEach(() => {
    // Mock localStorage
    const localStorageMock = (function () {
      let store: Record<string, string> = {};
      return {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          store[key] = value.toString();
        }),
        clear: vi.fn(() => {
          store = {};
        }),
        removeItem: vi.fn((key: string) => {
          delete store[key];
        }),
      };
    })();
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
    });

    canvasElRef = { current: document.createElement('canvas') };
    containerRef = {
      current: {
        clientWidth: 1000,
        clientHeight: 800,
      },
    };
  });

  it('should initialize with default tool "none"', () => {
    const { result } = renderHook(() =>
      useFabricCanvas(canvasElRef, containerRef, 'data:image/png;base64,...')
    );
    expect(result.current.currentTool).toBe('none');
  });

  it('should update current tool', () => {
    const { result } = renderHook(() =>
      useFabricCanvas(canvasElRef, containerRef, 'data:image/png;base64,...')
    );

    act(() => {
      result.current.setCurrentTool('rectangle');
    });

    expect(result.current.currentTool).toBe('rectangle');
  });

  it('should increment step counter', () => {
    const { result } = renderHook(() =>
      useFabricCanvas(canvasElRef, containerRef, 'data:image/png;base64,...')
    );
    expect(result.current.stepCounter).toBe(1);
  });
});
