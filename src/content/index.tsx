import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import ColdStartModal from '../components/ColdStartModal';
import CaptureOverlay from '../components/CaptureOverlay';
import AnnotationModal from '../components/AnnotationModal';
import styles from '../index.css?inline';

const ContentApp: React.FC = () => {
    const [view, setView] = useState<'NONE' | 'COLD_START' | 'CAPTURE' | 'ANNOTATE'>('NONE');
    const [captureImage, setCaptureImage] = useState<string | null>(null);
    const [croppedImage, setCroppedImage] = useState<string | null>(null);

    useEffect(() => {
        const listener = (message: any) => {
            if (message.type === 'OPEN_COLD_START') {
                setView('COLD_START');
            } else if (message.type === 'SHOW_CAPTURE_UI') {
                setCaptureImage(message.payload.image);
                setView('CAPTURE');
            }
        };
        chrome.runtime.onMessage.addListener(listener);
        return () => chrome.runtime.onMessage.removeListener(listener);
    }, []);

    const handleCrop = (image: string) => {
        setCroppedImage(image);
        setView('ANNOTATE');
    };

    const handleSaveEvidence = async (description: string, finalImage: string) => {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'SAVE_EVIDENCE',
                payload: {
                    description,
                    imageUrl: finalImage,
                    url: window.location.href
                }
            });
            if (response?.success) {
                // Show toast?
                console.log("Evidence Saved!");
                setView('NONE');
            } else {
                console.error("Failed to save", response);
            }
        } catch (err) {
            console.error("Error saving evidence", err);
        }
    };

    if (view === 'NONE') return null;

    return (
        <>
            {view === 'COLD_START' && (
                <ColdStartModal onClose={() => setView('NONE')} />
            )}
            {view === 'CAPTURE' && captureImage && (
                <CaptureOverlay
                    image={captureImage}
                    onCrop={handleCrop}
                    onCancel={() => setView('NONE')}
                />
            )}
            {view === 'ANNOTATE' && croppedImage && (
                <AnnotationModal
                    image={croppedImage}
                    onSave={handleSaveEvidence}
                    onCancel={() => setView('NONE')}
                />
            )}
        </>
    );
};

// Initialize Shadow DOM
const rootId = 'snaptrace-extension-root';
if (!document.getElementById(rootId)) {
    const container = document.createElement('div');
    container.id = rootId;
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '0';
    container.style.height = '0';
    container.style.zIndex = '2147483647'; // Max z-index

    document.body.appendChild(container);

    const shadowRoot = container.attachShadow({ mode: 'open' });

    // Inject Styles
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    shadowRoot.appendChild(styleSheet);

    // Inject Font (Optional - Inter)
    // We can't easily link to google fonts from content script due to CSP usually, 
    // but styles might import it. inline css handles tailwind classes.

    const rootDiv = document.createElement('div');
    rootDiv.id = 'app-root';
    shadowRoot.appendChild(rootDiv);

    const root = createRoot(rootDiv);
    root.render(<ContentApp />);

    console.log("SnapTrace: Content Script Injected");
}
