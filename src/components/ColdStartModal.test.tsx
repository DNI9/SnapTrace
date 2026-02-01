import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ColdStartModal from './ColdStartModal';

describe('ColdStartModal', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render modal with title and input', () => {
    render(<ColdStartModal onClose={mockOnClose} />);

    expect(screen.getByText('Start New Session')).toBeInTheDocument();
    expect(screen.getByLabelText('Session Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g., Checkout Flow v2')).toBeInTheDocument();
  });

  it('should auto-focus the input on mount', () => {
    render(<ColdStartModal onClose={mockOnClose} />);

    const input = screen.getByLabelText('Session Name');
    expect(document.activeElement).toBe(input);
  });

  it('should render Start Session and Cancel buttons', () => {
    render(<ColdStartModal onClose={mockOnClose} />);

    expect(screen.getByRole('button', { name: /start session/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('should close modal on Cancel button click', async () => {
    const user = userEvent.setup();
    render(<ColdStartModal onClose={mockOnClose} />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should close modal on Escape key press', async () => {
    render(<ColdStartModal onClose={mockOnClose} />);

    const input = screen.getByLabelText('Session Name');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should not submit with empty session name', async () => {
    const user = userEvent.setup();
    render(<ColdStartModal onClose={mockOnClose} />);

    await user.click(screen.getByRole('button', { name: /start session/i }));

    // Should not call chrome.runtime.sendMessage with empty name
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it('should submit form with session name', async () => {
    const user = userEvent.setup();
    render(<ColdStartModal onClose={mockOnClose} />);

    const input = screen.getByLabelText('Session Name');
    await user.type(input, 'My Test Session');
    await user.click(screen.getByRole('button', { name: /start session/i }));

    await waitFor(() => {
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'CREATE_SESSION',
        payload: { name: 'My Test Session' },
      });
    });
  });

  it('should close modal on successful submission', async () => {
    const user = userEvent.setup();
    render(<ColdStartModal onClose={mockOnClose} />);

    const input = screen.getByLabelText('Session Name');
    await user.type(input, 'Success Session');
    await user.click(screen.getByRole('button', { name: /start session/i }));

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('should show keyboard shortcut hints', () => {
    render(<ColdStartModal onClose={mockOnClose} />);

    expect(screen.getByText('Enter')).toBeInTheDocument();
    expect(screen.getByText('to Start')).toBeInTheDocument();
    expect(screen.getByText('Esc')).toBeInTheDocument();
    expect(screen.getByText('to Cancel')).toBeInTheDocument();
  });

  it('should disable buttons while submitting', async () => {
    const user = userEvent.setup();
    // Delay the response to test loading state
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
    );

    render(<ColdStartModal onClose={mockOnClose} />);

    const input = screen.getByLabelText('Session Name');
    await user.type(input, 'Loading Test');
    await user.click(screen.getByRole('button', { name: /start session/i }));

    // Buttons should be disabled during submission
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled();
    });
  });
});
