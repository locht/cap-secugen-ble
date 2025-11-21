/**
 * Image processing utilities for SecuGen fingerprint images
 * Handles raw grayscale image buffers from device
 */

/**
 * Convert base64 string to ArrayBuffer (raw bytes)
 * @param base64String Base64 encoded image data from device
 * @returns ArrayBuffer containing raw bytes
 */
export function base64ToArrayBuffer(base64String: string): ArrayBuffer {
  const binaryString = atob(base64String);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Create ImageData (displayable) from raw grayscale buffer
 * @param rawBuffer Raw image bytes (width * height for grayscale)
 * @param width Image width in pixels
 * @param height Image height in pixels
 * @returns ImageData object ready for canvas display
 */
export function createImageDataFromRaw(rawBuffer: Uint8Array, width: number, height: number): ImageData {
  // Create RGBA ImageData (4 bytes per pixel: R, G, B, A)
  const imageData = new ImageData(width, height);
  const data = imageData.data;

  // Convert grayscale to RGBA
  // For each grayscale pixel value, set R=G=B=value, A=255 (fully opaque)
  for (let i = 0; i < rawBuffer.length; i++) {
    const grayValue = rawBuffer[i];
    data[i * 4 + 0] = grayValue; // Red
    data[i * 4 + 1] = grayValue; // Green
    data[i * 4 + 2] = grayValue; // Blue
    data[i * 4 + 3] = 255; // Alpha (fully opaque)
  }

  return imageData;
}

/**
 * Display raw image on canvas
 * @param canvas Canvas element to draw on
 * @param rawBuffer Raw grayscale image bytes
 * @param width Image width
 * @param height Image height
 */
export function drawImageOnCanvas(
  canvas: HTMLCanvasElement,
  rawBuffer: Uint8Array,
  width: number,
  height: number,
): void {
  // Set canvas size
  canvas.width = width;
  canvas.height = height;

  // Get 2D context
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('Could not get canvas 2D context');
    return;
  }

  // Create ImageData from raw buffer
  const imageData = createImageDataFromRaw(rawBuffer, width, height);

  // Draw image on canvas
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Create blob from base64 for download/save
 * @param base64String Base64 encoded image
 * @param mimeType MIME type (default: image/png)
 * @returns Blob object
 */
export function base64ToBlob(base64String: string, mimeType: string = 'image/png'): Blob {
  const binaryString = atob(base64String);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

/**
 * Scale image using Canvas (much faster than pixel-by-pixel in JS)
 * @param sourceWidth Original image width
 * @param sourceHeight Original image height
 * @param rawBuffer Raw grayscale image bytes
 * @param targetWidth Desired width
 * @param targetHeight Desired height
 * @returns Scaled ImageData
 */
export function scaleImageFast(
  sourceWidth: number,
  sourceHeight: number,
  rawBuffer: Uint8Array,
  targetWidth: number,
  targetHeight: number,
): ImageData {
  // Create temporary canvas for source image
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = sourceWidth;
  sourceCanvas.height = sourceHeight;

  // Draw source image on temp canvas
  drawImageOnCanvas(sourceCanvas, rawBuffer, sourceWidth, sourceHeight);

  // Create target canvas and scale using canvas
  const targetCanvas = document.createElement('canvas');
  targetCanvas.width = targetWidth;
  targetCanvas.height = targetHeight;

  const targetCtx = targetCanvas.getContext('2d');
  if (!targetCtx) {
    throw new Error('Could not get target canvas context');
  }

  // Canvas scaling is much faster than manual pixel copying
  // Uses interpolation for smooth scaling
  targetCtx.drawImage(sourceCanvas, 0, 0, sourceWidth, sourceHeight, 0, 0, targetWidth, targetHeight);

  // Get scaled ImageData
  return targetCtx.getImageData(0, 0, targetWidth, targetHeight);
}

/**
 * Scale image using simple nearest-neighbor (faster for small upscales)
 * @param sourceWidth Original width
 * @param sourceHeight Original height
 * @param rawBuffer Raw image bytes
 * @param targetWidth Target width
 * @param targetHeight Target height
 * @returns Scaled raw Uint8Array
 */
export function scaleImageNearest(
  sourceWidth: number,
  sourceHeight: number,
  rawBuffer: Uint8Array,
  targetWidth: number,
  targetHeight: number,
): Uint8Array {
  const scaledBuffer = new Uint8Array(targetWidth * targetHeight);

  const xRatio = sourceWidth / targetWidth;
  const yRatio = sourceHeight / targetHeight;

  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const sourceX = Math.floor(x * xRatio);
      const sourceY = Math.floor(y * yRatio);
      const sourceIndex = sourceY * sourceWidth + sourceX;
      const targetIndex = y * targetWidth + x;

      if (sourceIndex < rawBuffer.length) {
        scaledBuffer[targetIndex] = rawBuffer[sourceIndex];
      }
    }
  }

  return scaledBuffer;
}

/**
 * Convert raw image to PNG blob (requires canvas)
 * @param rawBuffer Raw grayscale image bytes
 * @param width Image width
 * @param height Image height
 * @returns Promise<Blob> PNG blob
 */
export async function rawImageToPNG(rawBuffer: Uint8Array, width: number, height: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');

    try {
      drawImageOnCanvas(canvas, rawBuffer, width, height);
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      }, 'image/png');
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Display raw image from device on HTML img element
 * @param imgElement HTML img element
 * @param base64String Base64 encoded image from device
 * @param width Image width
 * @param height Image height
 */
export function displayRawImage(
  imgElement: HTMLImageElement,
  base64String: string,
  width: number,
  height: number,
): void {
  // Convert base64 to ArrayBuffer
  const buffer = new Uint8Array(base64ToArrayBuffer(base64String));

  // Create temp canvas
  const canvas = document.createElement('canvas');
  drawImageOnCanvas(canvas, buffer, width, height);

  // Convert canvas to data URL and set as image source
  imgElement.src = canvas.toDataURL('image/png');
}

/**
 * Get raw image statistics (min, max, mean brightness)
 * @param rawBuffer Raw grayscale image bytes
 * @returns Object with min, max, mean, histogram
 */
export function getImageStats(rawBuffer: Uint8Array): {
  min: number;
  max: number;
  mean: number;
  median: number;
  histogram: number[];
} {
  let min = 255;
  let max = 0;
  let sum = 0;
  const histogram = new Array(256).fill(0);

  for (const pixel of rawBuffer) {
    min = Math.min(min, pixel);
    max = Math.max(max, pixel);
    sum += pixel;
    histogram[pixel]++;
  }

  const mean = sum / rawBuffer.length;

  // Calculate median
  let medianIndex = 0;
  let count = 0;
  for (let i = 0; i < 256; i++) {
    count += histogram[i];
    if (count >= rawBuffer.length / 2) {
      medianIndex = i;
      break;
    }
  }

  return { min, max, mean, median: medianIndex, histogram };
}

/**
 * Apply histogram equalization to improve contrast
 * @param rawBuffer Raw grayscale image bytes
 * @returns Enhanced image bytes
 */
export function enhanceContrast(rawBuffer: Uint8Array): Uint8Array {
  const width = Math.sqrt(rawBuffer.length);
  const height = width;

  // Get histogram
  const { histogram } = getImageStats(rawBuffer);

  // Calculate cumulative distribution function (CDF)
  const cdf = new Array(256).fill(0);
  cdf[0] = histogram[0];
  for (let i = 1; i < 256; i++) {
    cdf[i] = cdf[i - 1] + histogram[i];
  }

  // Normalize CDF
  const cdfMin = cdf[0];
  const cdfMax = cdf[255];
  for (let i = 0; i < 256; i++) {
    cdf[i] = Math.round(((cdf[i] - cdfMin) / (cdfMax - cdfMin)) * 255);
  }

  // Apply equalization
  const enhanced = new Uint8Array(rawBuffer.length);
  for (let i = 0; i < rawBuffer.length; i++) {
    enhanced[i] = cdf[rawBuffer[i]];
  }

  return enhanced;
}
