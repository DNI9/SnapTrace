import React, { useState, useEffect, useRef } from 'react';

interface ColdStartModalProps {
  onClose: () => void;
}

const ColdStartModal: React.FC<ColdStartModalProps> = ({ onClose }) => {
  const [sessionName, setSessionName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto focus input
    if (inputRef.current) {
      inputRef.current.focus();
    }

    // Lock body scroll
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionName.trim()) return;

    setIsSubmitting(true);

    // Send message to background to create session
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CREATE_SESSION',
        payload: { name: sessionName },
      });

      if (response?.success) {
        onClose();
      } else {
        console.error('Failed to create session', response);
      }
    } catch (err) {
      console.error('Error creating session', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
      // Ensure this overlay captures clicks to prevent interaction with page behind
      onClick={e => e.stopPropagation()}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()} // Prevent close on modal click
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Start New Session</h2>
              <p className="text-sm text-slate-500">Capture and organize your evidence</p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label
                htmlFor="sessionRequest"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Session Name
              </label>
              <input
                ref={inputRef}
                type="text"
                id="sessionRequest"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all placeholder:text-slate-400 text-slate-900"
                placeholder="e.g., Checkout Flow v2"
                value={sessionName}
                onChange={e => setSessionName(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSubmitting}
              />
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-200 transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 shadow-sm shadow-violet-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 flex items-center transition-all active:scale-95"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Creating...
                  </>
                ) : (
                  'Start Session' // Enter
                )}
              </button>
            </div>
          </form>
        </div>
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400 font-medium">
          <div className="flex items-center gap-1.5">
            <kbd className="font-sans bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-500 shadow-sm">
              Enter
            </kbd>
            <span>to Start</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="font-sans bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-500 shadow-sm">
              Esc
            </kbd>
            <span>to Cancel</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColdStartModal;
