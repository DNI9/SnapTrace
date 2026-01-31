import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import { type Session } from './storage';

// Helper to convert base64 to Uint8Array (Buffer)
function base64ToUint8Array(base64: string) {
    const binaryString = atob(base64.split(',')[1]);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

export async function exportSessionToDocx(session: Session) {
    const children = [];

    // Title
    children.push(
        new Paragraph({
            text: `Session: ${session.name}`,
            heading: HeadingLevel.TITLE,
        }),
        new Paragraph({
            text: `Date: ${new Date(session.createdAt).toLocaleString()}`,
            heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({ text: "" }) // Spacer
    );

    for (const item of session.items) {
        // Item Heading
        children.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: item.description || "Untitled Evidence",
                        bold: true,
                        size: 28, // 14pt (docx uses half-points)
                    }),
                ],
                spacing: { before: 200, after: 100 },
            })
        );

        // Sub-heading (URL + Timestamp)
        children.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: `${item.url} | ${new Date(item.timestamp).toLocaleTimeString()}`,
                        color: "808080",
                        size: 20, // 10pt
                    }),
                ],
                spacing: { after: 200 },
            })
        );

        // Image
        try {
            const imageBuffer = base64ToUint8Array(item.imageUrl);
            children.push(
                new Paragraph({
                    children: [
                        new ImageRun({
                            data: imageBuffer,
                            transformation: {
                                width: 500,
                                height: 300,
                            },
                            type: "png", // forcing type might help TS disambiguate
                        }),
                    ],
                    spacing: { after: 400 },
                })
            );
        } catch (e) {
            console.error("Failed to add image", e);
            children.push(new Paragraph({ text: "[Image Error]" }));
        }

        children.push(new Paragraph({ text: "" })); // Spacer
    }

    const doc = new Document({
        sections: [{
            properties: {},
            children: children,
        }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${session.name.replace(/[^a-z0-9]/gi, '_')}_Evidence.docx`);
}

// Helper to get image dimensions
// Note: This might not work in Background Service Worker if DOM is missing (Image object).
// But Popup UI has DOM. We'll run this in Popup.
/*
function getImageDimensions(url: string): Promise<{width: number, height: number}> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = reject;
        img.src = url;
    });
}
*/
// We'll skip dynamic sizing for MVP speed and robustness in this turn content.
