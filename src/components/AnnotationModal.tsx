import React, { useEffect, useRef, useState } from 'react';

interface AnnotationModalProps {
    image: string;
    onSave: (description: string, finalImage: string) => void;
    onCancel: () => void;
}

type Tool = 'none' | 'rectangle' | 'text';

interface Annotation {
    type: 'rectangle' | 'text';
    x: number;
    y: number;
    width?: number;
    height?: number;
    content?: string;
}

const AnnotationModal: React.FC<AnnotationModalProps> = ({ image, onSave, onCancel }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [description, setDescription] = useState('');
    const [currentTool, setCurrentTool] = useState<Tool>('none');
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null);
    const [displayScale, setDisplayScale] = useState(1);

    // Load and display the image
    useEffect(() => {
        const img = new Image();
        img.onload = () => {
            console.log('AnnotationModal: Image loaded, natural size:', img.naturalWidth, 'x', img.naturalHeight);
            setImgElement(img);
            setImageLoaded(true);
        };
        img.onerror = (e) => {
            console.error('AnnotationModal: Failed to load image', e);
        };
        img.src = image;
    }, [image]);

    // Draw the image and annotations on canvas
    useEffect(() => {
        if (!imageLoaded || !imgElement || !canvasRef.current || !containerRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Get container dimensions
        const containerWidth = containerRef.current.clientWidth - 32; // padding
        const containerHeight = containerRef.current.clientHeight - 32;

        console.log('AnnotationModal: Container size:', containerWidth, 'x', containerHeight);

        // Calculate scale to fit
        const imgW = imgElement.naturalWidth;
        const imgH = imgElement.naturalHeight;
        const scale = Math.min(containerWidth / imgW, containerHeight / imgH, 1);
        setDisplayScale(scale);

        console.log('AnnotationModal: Display scale:', scale);

        // Set canvas size
        const canvasWidth = Math.round(imgW * scale);
        const canvasHeight = Math.round(imgH * scale);

        console.log('AnnotationModal: Canvas size:', canvasWidth, 'x', canvasHeight);

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        // Draw image
        ctx.drawImage(imgElement, 0, 0, canvasWidth, canvasHeight);

        // Draw annotations
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 3;
        ctx.font = '20px sans-serif';
        ctx.fillStyle = 'red';

        annotations.forEach(ann => {
            if (ann.type === 'rectangle' && ann.width && ann.height) {
                ctx.strokeRect(ann.x * scale, ann.y * scale, ann.width * scale, ann.height * scale);
            } else if (ann.type === 'text' && ann.content) {
                ctx.fillText(ann.content, ann.x * scale, ann.y * scale);
            }
        });

    }, [imageLoaded, imgElement, annotations]);

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (currentTool === 'none' || !canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / displayScale;
        const y = (e.clientY - rect.top) / displayScale;

        if (currentTool === 'rectangle') {
            setIsDrawing(true);
            setDrawStart({ x, y });
        } else if (currentTool === 'text') {
            const text = prompt('Enter text:');
            if (text) {
                setAnnotations(prev => [...prev, { type: 'text', x, y, content: text }]);
            }
            setCurrentTool('none');
        }
    };

    const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing || !drawStart || !canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const endX = (e.clientX - rect.left) / displayScale;
        const endY = (e.clientY - rect.top) / displayScale;

        const x = Math.min(drawStart.x, endX);
        const y = Math.min(drawStart.y, endY);
        const width = Math.abs(endX - drawStart.x);
        const height = Math.abs(endY - drawStart.y);

        if (width > 5 && height > 5) {
            setAnnotations(prev => [...prev, { type: 'rectangle', x, y, width, height }]);
        }

        setIsDrawing(false);
        setDrawStart(null);
        setCurrentTool('none');
    };

    const handleSave = () => {
        if (!canvasRef.current || !imgElement) return;

        // Create a full-resolution canvas for saving
        const fullCanvas = document.createElement('canvas');
        fullCanvas.width = imgElement.naturalWidth;
        fullCanvas.height = imgElement.naturalHeight;
        const ctx = fullCanvas.getContext('2d');
        if (!ctx) return;

        // Draw original image at full size
        ctx.drawImage(imgElement, 0, 0);

        // Draw annotations at full size
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 3;
        ctx.font = '20px sans-serif';
        ctx.fillStyle = 'red';

        annotations.forEach(ann => {
            if (ann.type === 'rectangle' && ann.width && ann.height) {
                ctx.strokeRect(ann.x, ann.y, ann.width, ann.height);
            } else if (ann.type === 'text' && ann.content) {
                ctx.fillText(ann.content, ann.x, ann.y);
            }
        });

        const dataUrl = fullCanvas.toDataURL('image/png');
        onSave(description, dataUrl);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            handleSave();
        } else if (e.key === 'Escape') {
            onCancel();
        }
    };

    // Auto-focus input
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    return (
        <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-white rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[95vh] w-full max-w-[95vw]">

                {/* Toolbar */}
                <div className="bg-gray-100 px-4 py-2 border-b flex space-x-2 items-center">
                    <button
                        className={`px-3 py-1.5 text-white text-xs rounded ${currentTool === 'rectangle' ? 'bg-red-700' : 'bg-red-500 hover:bg-red-600'}`}
                        onClick={() => setCurrentTool(currentTool === 'rectangle' ? 'none' : 'rectangle')}
                    >
                        Rectangle
                    </button>
                    <button
                        className={`px-3 py-1.5 text-white text-xs rounded ${currentTool === 'text' ? 'bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'}`}
                        onClick={() => setCurrentTool(currentTool === 'text' ? 'none' : 'text')}
                    >
                        Text
                    </button>
                    {annotations.length > 0 && (
                        <button
                            className="px-3 py-1.5 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                            onClick={() => setAnnotations([])}
                        >
                            Clear All
                        </button>
                    )}
                    <span className="text-xs text-gray-500 ml-auto">
                        {imgElement ? `${imgElement.naturalWidth}×${imgElement.naturalHeight}px` : 'Loading...'}
                    </span>
                </div>

                {/* Canvas Container */}
                <div
                    ref={containerRef}
                    className="flex-1 overflow-auto bg-gray-200 flex justify-center items-center p-4 min-h-[300px]"
                >
                    {imageLoaded ? (
                        <canvas
                            ref={canvasRef}
                            className={`shadow-lg ${currentTool !== 'none' ? 'cursor-crosshair' : 'cursor-default'}`}
                            onMouseDown={handleMouseDown}
                            onMouseUp={handleMouseUp}
                        />
                    ) : (
                        <div className="text-gray-500">Loading image...</div>
                    )}
                </div>

                {/* Footer / Input */}
                <div className="p-4 bg-white border-t">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <input
                        ref={inputRef}
                        type="text"
                        className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Describe what you found... (Ctrl+Enter to save)"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <div className="flex justify-end mt-3 space-x-3">
                        <button onClick={onCancel} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Discard</button>
                        <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save Evidence</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnnotationModal;
