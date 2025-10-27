// Image processing utilities for screen capture

import { CropArea } from '../types/capture';

/**
 * Captures a frame from a video stream and returns it as a base64 image
 */
export function captureFrameFromStream(video: HTMLVideoElement, cropArea?: CropArea): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Set canvas dimensions based on crop area or full video
      if (cropArea) {
        canvas.width = cropArea.width;
        canvas.height = cropArea.height;
        
        // Draw the cropped portion of the video
        ctx.drawImage(
          video,
          cropArea.x, cropArea.y, cropArea.width, cropArea.height, // Source rectangle
          0, 0, cropArea.width, cropArea.height // Destination rectangle
        );
      } else {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw the full video frame
        ctx.drawImage(video, 0, 0);
      }

      // Convert canvas to base64 image
      const imageData = canvas.toDataURL('image/png');
      resolve(imageData);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Creates a selection overlay for cropping
 */
export function createSelectionOverlay(video: HTMLVideoElement): Promise<CropArea> {
  return new Promise((resolve, reject) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10001;
      cursor: crosshair;
    `;

    const instructions = document.createElement('div');
    instructions.style.cssText = `
      position: absolute;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 10002;
    `;
    instructions.textContent = 'Click and drag to select area to capture. Press ESC to cancel.';

    const selectionBox = document.createElement('div');
    selectionBox.style.cssText = `
      position: absolute;
      border: 2px dashed #4CAF50;
      background: rgba(76, 175, 80, 0.1);
      display: none;
      z-index: 10002;
    `;

    overlay.appendChild(instructions);
    overlay.appendChild(selectionBox);
    document.body.appendChild(overlay);

    let isSelecting = false;
    let startX = 0;
    let startY = 0;

    const handleMouseDown = (e: MouseEvent) => {
      isSelecting = true;
      startX = e.clientX;
      startY = e.clientY;
      selectionBox.style.left = startX + 'px';
      selectionBox.style.top = startY + 'px';
      selectionBox.style.width = '0px';
      selectionBox.style.height = '0px';
      selectionBox.style.display = 'block';
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isSelecting) return;

      const currentX = e.clientX;
      const currentY = e.clientY;
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);
      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);

      selectionBox.style.left = left + 'px';
      selectionBox.style.top = top + 'px';
      selectionBox.style.width = width + 'px';
      selectionBox.style.height = height + 'px';
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!isSelecting) return;

      const currentX = e.clientX;
      const currentY = e.clientY;
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);
      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);

      // Minimum selection size
      if (width < 50 || height < 50) {
        selectionBox.style.display = 'none';
        isSelecting = false;
        return;
      }

      cleanup();

      // Calculate relative coordinates based on video dimensions
      const videoRect = video.getBoundingClientRect();
      const scaleX = video.videoWidth / videoRect.width;
      const scaleY = video.videoHeight / videoRect.height;

      const cropArea: CropArea = {
        x: Math.max(0, (left - videoRect.left) * scaleX),
        y: Math.max(0, (top - videoRect.top) * scaleY),
        width: width * scaleX,
        height: height * scaleY
      };

      resolve(cropArea);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cleanup();
        reject(new Error('Selection cancelled by user'));
      }
    };

    const cleanup = () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
      overlay.remove();
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);
  });
}

/**
 * Resizes an image to fit within maximum dimensions while maintaining aspect ratio
 */
export function resizeImage(imageData: string, maxWidth: number, maxHeight: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Calculate new dimensions maintaining aspect ratio
      let { width, height } = img;
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      canvas.width = width;
      canvas.height = height;
      
      ctx.drawImage(img, 0, 0, width, height);
      
      const resizedImageData = canvas.toDataURL('image/png');
      resolve(resizedImageData);
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageData;
  });
}
