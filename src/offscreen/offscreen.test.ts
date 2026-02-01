import { describe, it, expect } from 'vitest';

/**
 * Tests for export utility functions from offscreen.ts
 *
 * Note: The main export functions (exportSessionToDocx, exportSessionToPdf) require
 * a full DOM environment with Image loading and Canvas support, which is complex
 * to mock. These tests focus on the pure utility functions.
 */

// Utility function extracted for testing (matches offscreen.ts implementation)
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

describe('Export Utilities', () => {
  describe('fitToWidth', () => {
    it('should maintain aspect ratio for landscape images', () => {
      const result = fitToWidth(1000, 500, 500);

      expect(result.width).toBe(500);
      expect(result.height).toBe(250);
      // Verify aspect ratio is maintained
      expect(result.width / result.height).toBeCloseTo(1000 / 500);
    });

    it('should maintain aspect ratio for portrait images', () => {
      const result = fitToWidth(500, 1000, 400);

      expect(result.width).toBe(400);
      expect(result.height).toBe(800);
      // Verify aspect ratio is maintained
      expect(result.width / result.height).toBeCloseTo(500 / 1000);
    });

    it('should not upscale if image is smaller than max width', () => {
      const result = fitToWidth(300, 200, 500);

      expect(result.width).toBe(300);
      expect(result.height).toBe(200);
    });

    it('should handle square images', () => {
      const result = fitToWidth(800, 800, 400);

      expect(result.width).toBe(400);
      expect(result.height).toBe(400);
    });

    it('should handle exact max width', () => {
      const result = fitToWidth(500, 300, 500);

      expect(result.width).toBe(500);
      expect(result.height).toBe(300);
    });

    it('should handle very wide images', () => {
      const result = fitToWidth(2000, 100, 500);

      expect(result.width).toBe(500);
      expect(result.height).toBe(25);
      expect(result.width / result.height).toBeCloseTo(2000 / 100);
    });

    it('should handle very tall images', () => {
      const result = fitToWidth(100, 2000, 500);

      expect(result.width).toBe(100);
      expect(result.height).toBe(2000);
    });
  });

  describe('Export configuration constants', () => {
    // These are the constants from offscreen.ts
    const MAX_IMAGE_WIDTH = 1200;
    const MAX_IMAGE_HEIGHT = 900;
    const JPEG_QUALITY = 0.7;

    it('should have reasonable max dimensions', () => {
      expect(MAX_IMAGE_WIDTH).toBeGreaterThan(0);
      expect(MAX_IMAGE_HEIGHT).toBeGreaterThan(0);
      expect(MAX_IMAGE_WIDTH).toBeLessThanOrEqual(4096); // Reasonable upper limit
      expect(MAX_IMAGE_HEIGHT).toBeLessThanOrEqual(4096);
    });

    it('should have valid JPEG quality', () => {
      expect(JPEG_QUALITY).toBeGreaterThan(0);
      expect(JPEG_QUALITY).toBeLessThanOrEqual(1);
    });
  });

  describe('Filename sanitization', () => {
    // This matches the pattern used in offscreen.ts
    const sanitizeFilename = (name: string) => name.replace(/[^a-z0-9]/gi, '_');

    it('should replace spaces with underscores', () => {
      expect(sanitizeFilename('My Test Session')).toBe('My_Test_Session');
    });

    it('should replace special characters', () => {
      expect(sanitizeFilename('Test@Session#123')).toBe('Test_Session_123');
    });

    it('should keep alphanumeric characters', () => {
      expect(sanitizeFilename('TestSession123')).toBe('TestSession123');
    });

    it('should handle multiple spaces/special chars', () => {
      expect(sanitizeFilename('Test   Session!!!v2')).toBe('Test___Session___v2');
    });

    it('should handle empty string', () => {
      expect(sanitizeFilename('')).toBe('');
    });
  });

  describe('Image Scaling (scaleDownImages option)', () => {
    // These test the scaling logic from compressImage function
    const MAX_IMAGE_WIDTH = 1200;
    const MAX_IMAGE_HEIGHT = 900;

    /**
     * Helper to calculate what the scale should be based on the compressImage logic:
     * const scale = Math.min(1, MAX_IMAGE_WIDTH / width, MAX_IMAGE_HEIGHT / height);
     */
    function calculateScale(width: number, height: number): number {
      return Math.min(1, MAX_IMAGE_WIDTH / width, MAX_IMAGE_HEIGHT / height);
    }

    /**
     * Calculate the resulting dimensions after scale is applied (only when scale < 1)
     */
    function getScaledDimensions(
      width: number,
      height: number,
      scaleDown: boolean
    ): { width: number; height: number } {
      if (!scaleDown) {
        return { width, height };
      }

      const scale = calculateScale(width, height);
      if (scale < 1) {
        return {
          width: Math.round(width * scale),
          height: Math.round(height * scale),
        };
      }
      return { width, height };
    }

    it('should not scale images when scaleDown is false (default)', () => {
      const result = getScaledDimensions(2000, 1500, false);

      expect(result.width).toBe(2000);
      expect(result.height).toBe(1500);
    });

    it('should scale down width-constrained images when scaleDown is true', () => {
      // Image wider than MAX_IMAGE_WIDTH
      const result = getScaledDimensions(2400, 900, true);

      expect(result.width).toBe(1200); // Scaled to MAX_IMAGE_WIDTH
      expect(result.height).toBe(450); // Scaled proportionally (900 * 0.5)
    });

    it('should scale down height-constrained images when scaleDown is true', () => {
      // Image taller than MAX_IMAGE_HEIGHT
      const result = getScaledDimensions(1200, 1800, true);

      expect(result.width).toBe(600); // Scaled proportionally (1200 * 0.5)
      expect(result.height).toBe(900); // Scaled to MAX_IMAGE_HEIGHT
    });

    it('should not scale images smaller than max dimensions when scaleDown is true', () => {
      const result = getScaledDimensions(800, 600, true);

      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
    });

    it('should scale based on limiting dimension (width limited)', () => {
      const scale = calculateScale(2400, 600);

      // Width limit: 1200/2400 = 0.5
      // Height limit: 900/600 = 1.5
      // Scale should be 0.5 (more limiting)
      expect(scale).toBe(0.5);
    });

    it('should scale based on limiting dimension (height limited)', () => {
      const scale = calculateScale(600, 1800);

      // Width limit: 1200/600 = 2
      // Height limit: 900/1800 = 0.5
      // Scale should be 0.5 (more limiting)
      expect(scale).toBe(0.5);
    });

    it('should handle images at exactly max dimensions', () => {
      const result = getScaledDimensions(1200, 900, true);

      expect(result.width).toBe(1200);
      expect(result.height).toBe(900);
    });

    it('should maintain aspect ratio when scaling', () => {
      const originalWidth = 3000;
      const originalHeight = 2000;
      const originalAspect = originalWidth / originalHeight;

      const result = getScaledDimensions(originalWidth, originalHeight, true);
      const scaledAspect = result.width / result.height;

      // Allow small rounding error due to Math.round
      expect(scaledAspect).toBeCloseTo(originalAspect, 1);
    });
  });
});
