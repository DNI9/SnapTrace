import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import Toast from './Toast';

describe('Toast', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render with message', () => {
    render(<Toast message="Test message" onClose={mockOnClose} />);

    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('should render with checkmark icon', () => {
    const { container } = render(<Toast message="Success" onClose={mockOnClose} />);

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should be visible initially', () => {
    const { container } = render(<Toast message="Visible" onClose={mockOnClose} />);

    const toast = container.firstChild as HTMLElement;
    expect(toast.className).toContain('opacity-100');
  });

  it('should have green background styling', () => {
    const { container } = render(<Toast message="Styled" onClose={mockOnClose} />);

    const toast = container.firstChild as HTMLElement;
    expect(toast.className).toContain('bg-green-600');
  });

  it('should call onClose after default duration', async () => {
    render(<Toast message="Auto close" onClose={mockOnClose} />);

    // Fast forward through the duration timer (2000ms default)
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // Fast forward through the fade out animation delay (300ms)
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should respect custom duration', async () => {
    render(<Toast message="Custom duration" duration={1000} onClose={mockOnClose} />);

    // Should not close before duration
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(mockOnClose).not.toHaveBeenCalled();

    // Should close after duration + animation
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should fade out before closing', async () => {
    const { container } = render(<Toast message="Fade out" onClose={mockOnClose} />);

    const toast = container.firstChild as HTMLElement;

    // Initially visible
    expect(toast.className).toContain('opacity-100');

    // After duration, visibility should change
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // The class should now indicate fading
    expect(toast.className).toContain('opacity-0');
  });
});
