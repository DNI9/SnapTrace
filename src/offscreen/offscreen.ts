import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel } from 'docx';
import { jsPDF } from 'jspdf';
import { type Session } from '../utils/storage';

// Maximum image dimensions to prevent memory issues
const MAX_IMAGE_WIDTH = 1200;
const MAX_IMAGE_HEIGHT = 900;
const JPEG_QUALITY = 0.7;

// Helper to resize and compress image to prevent memory issues
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

// Helper to convert base64 to Uint8Array using fetch
async function base64ToUint8Array(base64: string): Promise<Uint8Array> {
  const response = await fetch(base64);
  const blob = await response.blob();
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

// Calculate dimensions to fit within max width
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

// Helper function to convert blob to base64 data URL
async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function exportSessionToDocx(
  session: Session,
  options?: { includeUrl?: boolean }
): Promise<{ dataUrl: string; filename: string }> {
  const children = [];
  const MAX_WIDTH = 500;

  children.push(
    new Paragraph({
      text: session.name,
      heading: HeadingLevel.TITLE,
    }),
    new Paragraph({
      text: `Date: ${new Date(session.createdAt).toLocaleString()}`,
      heading: HeadingLevel.HEADING_2,
    }),
    new Paragraph({ text: '' })
  );

  for (const item of session.items) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: item.description || 'Untitled Evidence',
            bold: true,
            size: 28,
          }),
        ],
        spacing: { before: 200, after: 100 },
      })
    );

    // URL + Timestamp - Conditional
    if (options?.includeUrl !== false) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${item.url} | ${new Date(item.timestamp).toLocaleTimeString()}`,
              color: '808080',
              size: 20,
            }),
          ],
          spacing: { after: 200 },
        })
      );
    }

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

    children.push(new Paragraph({ text: '' }));
    await new Promise(r => setTimeout(r, 0));
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  const blob = await Packer.toBlob(doc);
  const dataUrl = await blobToDataUrl(blob);
  const filename = `${session.name.replace(/[^a-z0-9]/gi, '_')}_Evidence.docx`;
  return { dataUrl, filename };
}

async function exportSessionToPdf(
  session: Session,
  options?: { includeUrl?: boolean }
): Promise<{ dataUrl: string; filename: string }> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const maxImgWidth = pageWidth - margin * 2;
  let yPos = margin;

  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text(session.name, margin, yPos);
  yPos += 10;

  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100);
  pdf.text(`Date: ${new Date(session.createdAt).toLocaleString()}`, margin, yPos);
  yPos += 15;

  pdf.setTextColor(0);

  for (const item of session.items) {
    if (yPos > pageHeight - 80) {
      pdf.addPage();
      yPos = margin;
    }

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text(item.description || 'Untitled Evidence', margin, yPos);
    yPos += 6;

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

    try {
      const compressed = await compressImage(item.imageUrl);
      const aspectRatio = compressed.width / compressed.height;
      const imgWidth = Math.min(maxImgWidth, compressed.width * 0.264583);
      const imgHeight = imgWidth / aspectRatio;

      if (yPos + imgHeight > pageHeight - margin) {
        pdf.addPage();
        yPos = margin;
      }

      pdf.addImage(compressed.data, 'JPEG', margin, yPos, imgWidth, imgHeight);
      yPos += imgHeight + 15;
    } catch (e) {
      console.error('Failed to add image to PDF', e);
      pdf.setTextColor(255, 0, 0);
      pdf.text('[Image Error]', margin, yPos);
      pdf.setTextColor(0);
      yPos += 10;
    }

    await new Promise(r => setTimeout(r, 0));
  }

  const pdfBlob = pdf.output('blob');
  const dataUrl = await blobToDataUrl(pdfBlob);
  const filename = `${session.name.replace(/[^a-z0-9]/gi, '_')}_Evidence.pdf`;
  return { dataUrl, filename };
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'OFFSCREEN_EXPORT_DOCX') {
    exportSessionToDocx(message.payload.session, message.payload.options)
      .then(result => sendResponse({ success: true, ...result }))
      .catch(err => {
        console.error('DOCX Export Error:', err);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }
  if (message.type === 'OFFSCREEN_EXPORT_PDF') {
    exportSessionToPdf(message.payload.session, message.payload.options)
      .then(result => sendResponse({ success: true, ...result }))
      .catch(err => {
        console.error('PDF Export Error:', err);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }
});

console.log('SnapTrace Offscreen Export Worker Ready');
