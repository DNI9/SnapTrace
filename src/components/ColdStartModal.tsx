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
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!sessionName.trim()) return;

        setIsSubmitting(true);

        // Send message to background to create session
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'CREATE_SESSION',
                payload: { name: sessionName }
            });

            if (response?.success) {
                onClose();
            } else {
                console.error("Failed to create session", response);
            }
        } catch (err) {
            console.error("Error creating session", err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            // Ensure this overlay captures clicks to prevent interaction with page behind
            onClick={(e) => e.stopPropagation()}
        >
            <div
                className="w-full max-w-md bg-white rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200"
                onClick={e => e.stopPropagation()} // Prevent close on modal click
            >
                <div className="p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Start New Session</h2>
                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label htmlFor="sessionRequest" className="block text-sm font-medium text-gray-700 mb-1">
                                Session Name
                            </label>
                            <input
                                ref={inputRef}
                                type="text"
                                id="sessionRequest"
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                                placeholder="e.g., Use Case Checkout v2"
                                value={sessionName}
                                onChange={(e) => setSessionName(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={isSubmitting}
                            />
                        </div>

                        <div className="flex justify-end space-x-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
                <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
                    <span>Press <strong>Enter</strong> to Start</span>
                    <span>Press <strong>Esc</strong> to Cancel</span>
                </div>
            </div>
        </div>
    );
};

export default ColdStartModal;
