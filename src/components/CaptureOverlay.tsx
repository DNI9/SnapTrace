import React, { useState, useRef, useEffect } from 'react';

interface CaptureOverlayProps {
    image: string;
    onCrop: (croppedImage: string) => void;
    onCancel: () => void;
}

const CaptureOverlay: React.FC<CaptureOverlayProps> = ({ image, onCrop, onCancel }) => {
    const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
    const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        // Freeze scrolling
        document.documentElement.style.overflow = 'hidden';
        return () => {
            document.documentElement.style.overflow = '';
        };
    }, []);

    const handleMouseDown = (e: React.MouseEvent) => {
        setStartPos({ x: e.clientX, y: e.clientY });
        setCurrentPos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (startPos) {
            setCurrentPos({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseUp = () => {
        if (startPos && currentPos) {
            // Calculate crop
            finishCrop(startPos, currentPos);
        }
        setStartPos(null);
        setCurrentPos(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            // Capture full viewport
            onCrop(image);
        } else if (e.key === 'Escape') {
            onCancel();
        }
    };

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [image]);

    const finishCrop = (start: { x: number; y: number }, end: { x: number; y: number }) => {
        if (!imgRef.current) return;

        // Get the displayed image bounds
        const imgRect = imgRef.current.getBoundingClientRect();
        const displayedWidth = imgRect.width;
        const displayedHeight = imgRect.height;

        // Get the natural (original) image dimensions
        const naturalWidth = imgRef.current.naturalWidth;
        const naturalHeight = imgRef.current.naturalHeight;

        // Calculate scale between natural and displayed size
        const scaleX = naturalWidth / displayedWidth;
        const scaleY = naturalHeight / displayedHeight;

        // Calculate selection coordinates relative to the image element
        const relStartX = start.x - imgRect.left;
        const relStartY = start.y - imgRect.top;
        const relEndX = end.x - imgRect.left;
        const relEndY = end.y - imgRect.top;

        // Ensure positive width/height
        const x = Math.min(relStartX, relEndX);
        const y = Math.min(relStartY, relEndY);
        const width = Math.abs(relEndX - relStartX);
        const height = Math.abs(relEndY - relStartY);

        if (width < 5 || height < 5) return; // Too small

        // Map to natural image coordinates
        const sourceX = x * scaleX;
        const sourceY = y * scaleY;
        const sourceWidth = width * scaleX;
        const sourceHeight = height * scaleY;

        // Create canvas at the source resolution
        const canvas = document.createElement('canvas');
        canvas.width = sourceWidth;
        canvas.height = sourceHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(
            imgRef.current,
            sourceX,
            sourceY,
            sourceWidth,
            sourceHeight,
            0,
            0,
            sourceWidth,
            sourceHeight
        );

        onCrop(canvas.toDataURL('image/png'));
    };

    const getSelectionStyle = () => {
        if (!startPos || !currentPos) return {};
        const left = Math.min(startPos.x, currentPos.x);
        const top = Math.min(startPos.y, currentPos.y);
        const width = Math.abs(currentPos.x - startPos.x);
        const height = Math.abs(currentPos.y - startPos.y);
        return {
            left, top, width, height
        };
    };

    return (
        <div
            className="fixed inset-0 z-[2147483646] cursor-crosshair select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
        >
            {/* Background Image - Full width/height to ensure coordinate mapping matches screen */}
            <img
                ref={imgRef}
                src={image}
                alt="Screenshot"
                className="absolute inset-0 w-full h-full pointer-events-none"
            />

            {/* Selection Box */}
            {startPos && currentPos && (
                <div
                    className="absolute border-2 border-blue-500 bg-transparent"
                    style={{
                        ...getSelectionStyle(),
                        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)'
                    }}
                />
            )}

            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm">
                Drag to crop, or press <strong>Enter</strong> to capture full screen. <strong>Esc</strong> to cancel.
            </div>
        </div>
    );
};

export default CaptureOverlay;
