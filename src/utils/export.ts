import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel } from 'docx';
import { jsPDF } from 'jspdf';
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

// Helper to get image dimensions from base64
function getImageDimensions(base64: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = base64;
  });
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

export async function exportSessionToDocx(session: Session) {
  const children = [];
  const MAX_WIDTH = 600; // Max width for images in docx

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

    // Image with aspect ratio
    try {
      const imageBuffer = base64ToUint8Array(item.imageUrl);
      const dims = await getImageDimensions(item.imageUrl);
      const { width, height } = fitToWidth(dims.width, dims.height, MAX_WIDTH);

      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: imageBuffer,
              transformation: { width, height },
              type: 'png',
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
  saveAs(blob, `${session.name.replace(/[^a-z0-9]/gi, '_')}_Evidence.docx`);
}

export async function exportSessionToPdf(session: Session) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
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

  for (const item of session.items) {
    // Check if we need a new page (leave 60mm for image)
    if (yPos > pdf.internal.pageSize.getHeight() - 80) {
      pdf.addPage();
      yPos = margin;
    }

    // Description heading
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text(item.description || 'Untitled Evidence', margin, yPos);
    yPos += 6;

    // URL + Timestamp
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(128);
    const urlText = `${item.url} | ${new Date(item.timestamp).toLocaleTimeString()}`;
    const urlLines = pdf.splitTextToSize(urlText, maxImgWidth);
    pdf.text(urlLines, margin, yPos);
    yPos += urlLines.length * 4 + 5;
    pdf.setTextColor(0);

    // Image
    try {
      const dims = await getImageDimensions(item.imageUrl);
      const aspectRatio = dims.width / dims.height;
      const imgWidth = Math.min(maxImgWidth, dims.width * 0.264583); // px to mm
      const imgHeight = imgWidth / aspectRatio;

      // Check if image fits on current page
      if (yPos + imgHeight > pdf.internal.pageSize.getHeight() - margin) {
        pdf.addPage();
        yPos = margin;
      }

      pdf.addImage(item.imageUrl, 'PNG', margin, yPos, imgWidth, imgHeight);
      yPos += imgHeight + 15;
    } catch (e) {
      console.error('Failed to add image to PDF', e);
      pdf.setTextColor(255, 0, 0);
      pdf.text('[Image Error]', margin, yPos);
      pdf.setTextColor(0);
      yPos += 10;
    }
  }

  pdf.save(`${session.name.replace(/[^a-z0-9]/gi, '_')}_Evidence.pdf`);
}
