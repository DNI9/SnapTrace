import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel } from 'docx';
import { jsPDF } from 'jspdf';
import { type Session } from './storage';

// Maximum image dimensions to prevent memory issues
const MAX_IMAGE_WIDTH = 1200;
const MAX_IMAGE_HEIGHT = 900;
const JPEG_QUALITY = 0.7;

// Helper function to download blob using Chrome downloads API
// This prevents the extension popup from closing during download
async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const url = URL.createObjectURL(blob);
  try {
    await chrome.downloads.download({ url, filename, saveAs: true });
  } finally {
    // Revoke the URL after a short delay to ensure the download starts
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

// Helper to resize and compress image to prevent memory issues
// Returns a smaller JPEG base64 and dimensions
async function compressImage(
  base64: string
): Promise<{ data: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        let { naturalWidth: width, naturalHeight: height } = img;

        // Calculate scale to fit within max dimensions
        const scale = Math.min(1, MAX_IMAGE_WIDTH / width, MAX_IMAGE_HEIGHT / height);

        if (scale < 1) {
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Convert to compressed JPEG
        const compressedData = canvas.toDataURL('image/jpeg', JPEG_QUALITY);

        // Clean up
        canvas.width = 0;
        canvas.height = 0;

        resolve({ data: compressedData, width, height });
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = base64;
  });
}

// Helper to convert base64 to Uint8Array using fetch (more memory efficient)
async function base64ToUint8Array(base64: string): Promise<Uint8Array> {
  const response = await fetch(base64);
  const blob = await response.blob();
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

// Calculate dimensions to fit within max width while maintaining aspect ratio
function fitToWidth(
  imgWidth: number,
  imgHeight: number,
  maxWidth: number
): { width: number; height: number } {
  const aspectRatio = imgWidth / imgHeight;
  const width = Math.min(imgWidth, maxWidth);
  const height = width / aspectRatio;
  return { width, height };
}

interface ExportOptions {
  includeUrl?: boolean;
}

export async function exportSessionToDocx(session: Session, options?: ExportOptions) {
  const children = [];
  const MAX_WIDTH = 500; // Max width for images in docx

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
    new Paragraph({ text: '' }) // Spacer
  );

  // Process items sequentially to avoid memory spikes
  for (const item of session.items) {
    // Item Heading
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: item.description || 'Untitled Evidence',
            bold: true,
            size: 28, // 14pt (docx uses half-points)
          }),
        ],
        spacing: { before: 200, after: 100 },
      })
    );

    // Sub-heading (URL + Timestamp)
    if (options?.includeUrl !== false) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${item.url} | ${new Date(item.timestamp).toLocaleTimeString()}`,
              color: '808080',
              size: 20, // 10pt
            }),
          ],
          spacing: { after: 200 },
        })
      );
    }

    // Image with aspect ratio - compress first to prevent memory issues
    try {
      const compressed = await compressImage(item.imageUrl);
      const imageBuffer = await base64ToUint8Array(compressed.data);
      const { width, height } = fitToWidth(compressed.width, compressed.height, MAX_WIDTH);

      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: imageBuffer,
              transformation: { width, height },
              type: 'jpg',
            }),
          ],
          spacing: { after: 400 },
        })
      );
    } catch (e) {
      console.error('Failed to add image', e);
      children.push(new Paragraph({ text: '[Image Error]' }));
    }

    children.push(new Paragraph({ text: '' })); // Spacer

    // Allow garbage collection between items
    await new Promise(r => setTimeout(r, 0));
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  await downloadBlob(blob, `${session.name.replace(/[^a-z0-9]/gi, '_')}_Evidence.docx`);
}

export async function exportSessionToPdf(session: Session, options?: ExportOptions) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const maxImgWidth = pageWidth - margin * 2;
  let yPos = margin;

  // Title
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`Session: ${session.name}`, margin, yPos);
  yPos += 10;

  // Date
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100);
  pdf.text(`Date: ${new Date(session.createdAt).toLocaleString()}`, margin, yPos);
  yPos += 15;

  pdf.setTextColor(0);

  // Process items sequentially to avoid memory spikes
  for (const item of session.items) {
    // Check if we need a new page (leave 60mm for image)
    if (yPos > pageHeight - 80) {
      pdf.addPage();
      yPos = margin;
    }

    // Description heading
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text(item.description || 'Untitled Evidence', margin, yPos);
    yPos += 6;

    // URL + Timestamp
    if (options?.includeUrl !== false) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(128);
      const urlText = `${item.url} | ${new Date(item.timestamp).toLocaleTimeString()}`;
      const urlLines = pdf.splitTextToSize(urlText, maxImgWidth);
      pdf.text(urlLines, margin, yPos);
      yPos += urlLines.length * 4 + 5;
      pdf.setTextColor(0);
    }

    // Image - compress first to prevent memory issues
    try {
      const compressed = await compressImage(item.imageUrl);
      const aspectRatio = compressed.width / compressed.height;
      const imgWidth = Math.min(maxImgWidth, compressed.width * 0.264583); // px to mm
      const imgHeight = imgWidth / aspectRatio;

      // Check if image fits on current page
      if (yPos + imgHeight > pageHeight - margin) {
        pdf.addPage();
        yPos = margin;
      }

      // Use JPEG format for compressed image
      pdf.addImage(compressed.data, 'JPEG', margin, yPos, imgWidth, imgHeight);
      yPos += imgHeight + 15;
    } catch (e) {
      console.error('Failed to add image to PDF', e);
      pdf.setTextColor(255, 0, 0);
      pdf.text('[Image Error]', margin, yPos);
      pdf.setTextColor(0);
      yPos += 10;
    }

    // Allow garbage collection between items
    await new Promise(r => setTimeout(r, 0));
  }

  const pdfBlob = pdf.output('blob');
  await downloadBlob(pdfBlob, `${session.name.replace(/[^a-z0-9]/gi, '_')}_Evidence.pdf`);
}
