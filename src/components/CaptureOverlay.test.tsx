import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CaptureOverlay from './CaptureOverlay';

describe('CaptureOverlay', () => {
  const mockImage =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const mockOnCrop = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset body overflow
    document.documentElement.style.overflow = '';
  });

  it('should render with screenshot image', () => {
    render(<CaptureOverlay image={mockImage} onCrop={mockOnCrop} onCancel={mockOnCancel} />);

    const img = screen.getByAltText('Screenshot');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', mockImage);
  });

  it('should display instruction text', () => {
    render(<CaptureOverlay image={mockImage} onCrop={mockOnCrop} onCancel={mockOnCancel} />);

    expect(screen.getByText(/drag to crop/i)).toBeInTheDocument();
    expect(screen.getByText(/enter/i)).toBeInTheDocument();
    expect(screen.getByText(/esc/i)).toBeInTheDocument();
  });

  it('should call onCrop with full image on Enter key', () => {
    render(<CaptureOverlay image={mockImage} onCrop={mockOnCrop} onCancel={mockOnCancel} />);

    fireEvent.keyDown(window, { key: 'Enter' });

    expect(mockOnCrop).toHaveBeenCalledWith(mockImage);
    expect(mockOnCrop).toHaveBeenCalledTimes(1);
  });

  it('should call onCancel on Escape key', () => {
    render(<CaptureOverlay image={mockImage} onCrop={mockOnCrop} onCancel={mockOnCancel} />);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('should freeze body scroll on mount', () => {
    render(<CaptureOverlay image={mockImage} onCrop={mockOnCrop} onCancel={mockOnCancel} />);

    expect(document.documentElement.style.overflow).toBe('hidden');
  });

  it('should restore body scroll on unmount', () => {
    const { unmount } = render(
      <CaptureOverlay image={mockImage} onCrop={mockOnCrop} onCancel={mockOnCancel} />
    );

    unmount();

    expect(document.documentElement.style.overflow).toBe('');
  });

  it('should have crosshair cursor', () => {
    const { container } = render(
      <CaptureOverlay image={mockImage} onCrop={mockOnCrop} onCancel={mockOnCancel} />
    );

    const overlay = container.firstChild as HTMLElement;
    expect(overlay.className).toContain('cursor-crosshair');
  });

  it('should show selection box on mouse drag', () => {
    const { container } = render(
      <CaptureOverlay image={mockImage} onCrop={mockOnCrop} onCancel={mockOnCancel} />
    );

    const overlay = container.firstChild as HTMLElement;

    fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(overlay, { clientX: 200, clientY: 200 });

    // Selection box should be visible
    const selectionBox = container.querySelector('.border-blue-500');
    expect(selectionBox).toBeInTheDocument();
  });
});
