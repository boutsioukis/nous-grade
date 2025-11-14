// Content Script Screen Selector - Full Browser Overlay
// Creates a full-browser overlay for region selection

export interface SelectionArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ContentScreenSelectorOptions {
  onComplete: (selectionArea: SelectionArea, croppedImageData: string) => void;
  onCancel: () => void;
  captureType: 'student' | 'professor';
  screenImageData: string; // Base64 image data of captured screen
}

export class ContentScriptScreenSelector {
  private overlay: HTMLDivElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private isSelecting: boolean = false;
  private startX: number = 0;
  private startY: number = 0;
  private currentX: number = 0;
  private currentY: number = 0;
  private options: ContentScreenSelectorOptions | null = null;
  private originalImageData: ImageData | null = null;
  private screenImage: HTMLImageElement | null = null;

  /**
   * Show the full-browser screen selector overlay
   */
  async showSelector(options: ContentScreenSelectorOptions): Promise<void> {
    console.log('🔵 Starting content script screen selector for:', options.captureType);
    
    this.options = options;
    
    try {
      // Load the screen image first
      console.log('🔵 Loading screen image...');
      await this.loadScreenImage(options.screenImageData);
      
      // Create full-browser overlay
      console.log('🔵 Creating overlay...');
      this.createFullBrowserOverlay();
      
      // Ensure image is ready before drawing
      console.log('🔵 Drawing screen image...');
      await this.drawScreenImageAsync();
      
      // Add event listeners for selection
      console.log('🔵 Adding event listeners...');
      this.addEventListeners();
      
      // Show instructions
      console.log('🔵 Showing instructions...');
      this.showInstructions();
      
      console.log('🔵 Content script screen selector setup complete');
    } catch (error) {
      console.error('🔴 Error setting up screen selector:', error);
      throw error;
    }
  }

  /**
   * Load the captured screen image
   */
  private async loadScreenImage(imageData: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.screenImage = new Image();
      this.screenImage.onload = () => {
        console.log('🔵 Screen image loaded successfully:', this.screenImage!.width, 'x', this.screenImage!.height);
        console.log('🔵 Image data length:', imageData.length);
        console.log('🔵 Image data preview:', imageData.substring(0, 50) + '...');
        resolve();
      };
      this.screenImage.onerror = (error) => {
        console.error('🔴 Failed to load screen image:', error);
        reject(new Error('Failed to load screen image'));
      };
      this.screenImage.src = imageData;
    });
  }

  /**
   * Create full-browser overlay
   */
  private createFullBrowserOverlay(): void {
    // Create overlay container
    this.overlay = document.createElement('div');
    this.overlay.id = 'nous-grade-screen-selector-overlay';
    this.overlay.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      z-index: 2147483647 !important;
      cursor: crosshair !important;
      background: transparent !important;
      user-select: none !important;
      pointer-events: auto !important;
      display: block !important;
      visibility: visible !important;
    `;
    
    // Create canvas for drawing
    this.canvas = document.createElement('canvas');
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.canvas.style.cssText = `
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      cursor: crosshair !important;
      background: transparent !important;
      opacity: 1 !important;
      z-index: 2147483648 !important;
      display: block !important;
      visibility: visible !important;
    `;
    
    // Get 2D context with willReadFrequently for better performance
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!this.ctx) {
      throw new Error('Failed to get canvas 2D context');
    }
    
    // Add canvas to overlay
    this.overlay.appendChild(this.canvas);
    
    // Add overlay to document body with force
    document.body.appendChild(this.overlay);
    
    // Double-check the elements are in the DOM
    console.log('🔵 Overlay in DOM:', document.contains(this.overlay));
    console.log('🔵 Canvas in DOM:', document.contains(this.canvas));
    console.log('🔵 Overlay computed style:', window.getComputedStyle(this.overlay));
    console.log('🔵 Canvas computed style:', window.getComputedStyle(this.canvas));
    
    console.log('🔵 Full-browser overlay created:', this.canvas.width, 'x', this.canvas.height);
  }

  /**
   * Draw screen image onto canvas (async version)
   */
  private async drawScreenImageAsync(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.canvas || !this.ctx || !this.screenImage) {
        console.error('🔴 Missing components for drawing:', {
          canvas: !!this.canvas,
          ctx: !!this.ctx,
          screenImage: !!this.screenImage
        });
        reject(new Error('Canvas, context, or screen image not available'));
        return;
      }

      console.log('🔵 Drawing screen image to canvas:', {
        canvasSize: `${this.canvas.width}x${this.canvas.height}`,
        imageSize: `${this.screenImage.width}x${this.screenImage.height}`,
        imageSrc: this.screenImage.src.substring(0, 50) + '...'
      });

      try {
        // First, draw the actual screen image to fill the entire canvas
        this.ctx.drawImage(this.screenImage, 0, 0, this.canvas.width, this.canvas.height);
        
        // Debug: Check what we actually drew by sampling some pixels
        const samplePixels = this.ctx.getImageData(100, 100, 1, 1);
        console.log('🔵 Sample pixel after drawing image:', samplePixels.data);
        
        // Store the original BRIGHT image data BEFORE applying overlay
        this.originalImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        
        // Debug: Check original image data
        const originalSample = this.originalImageData.data.slice(0, 12); // First 3 pixels (RGBA)
        console.log('🔵 Original image data sample (first 3 pixels):', originalSample);
        
        // Create a test to verify the image has content
        let hasContent = false;
        for (let i = 0; i < this.originalImageData.data.length; i += 4) {
          const r = this.originalImageData.data[i];
          const g = this.originalImageData.data[i + 1];
          const b = this.originalImageData.data[i + 2];
          if (r > 0 || g > 0 || b > 0) {
            hasContent = true;
            break;
          }
        }
        console.log('🔵 Image has non-black content:', hasContent);
        
        if (!hasContent) {
          console.log('🔴 Warning: Captured image appears to be black or empty');
        }
        
        // Now apply a semi-transparent dark overlay to dim the entire screen
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; // Semi-transparent black overlay
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        console.log('🔵 Screen image drawn with dimming overlay successfully');
        console.log('🔵 Canvas dimensions:', this.canvas.width, 'x', this.canvas.height);
        console.log('🔵 Original image data stored BEFORE dimming overlay');
        
        resolve();
      } catch (error) {
        console.error('🔴 Error drawing screen image:', error);
        reject(error);
      }
    });
  }

  /**
   * Draw screen image onto canvas (legacy sync version)
   */
  private drawScreenImage(): void {
    if (!this.canvas || !this.ctx || !this.screenImage) {
      console.error('🔴 Missing components for drawing:', {
        canvas: !!this.canvas,
        ctx: !!this.ctx,
        screenImage: !!this.screenImage
      });
      throw new Error('Canvas, context, or screen image not available');
    }

    console.log('🔵 Drawing screen image to canvas:', {
      canvasSize: `${this.canvas.width}x${this.canvas.height}`,
      imageSize: `${this.screenImage.width}x${this.screenImage.height}`,
      imageSrc: this.screenImage.src.substring(0, 50) + '...'
    });

    // Clear canvas with a test color first to ensure it's working
    this.ctx.fillStyle = '#ff0000'; // Red background for testing
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Wait a moment then draw the actual image
    setTimeout(() => {
      if (!this.ctx || !this.screenImage || !this.canvas) return;
      
      // Clear the test background
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      
      // Draw the screen image to fill the entire canvas
      this.ctx.drawImage(this.screenImage, 0, 0, this.canvas.width, this.canvas.height);
      
      // Store the original image data for restoration during selection
      this.originalImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      
      console.log('🔵 Screen image drawn to full-browser canvas successfully');
    }, 100);
  }

  /**
   * Add mouse event listeners for selection
   */
  private addEventListeners(): void {
    if (!this.canvas) return;

    // Mouse events
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    
    // Keyboard events
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    
    // Prevent context menu
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    
    console.log('🔵 Event listeners added for full-browser selection');
  }

  /**
   * Handle mouse down event
   */
  private handleMouseDown(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    
    this.isSelecting = true;
    
    // Get canvas-relative coordinates
    const rect = this.canvas!.getBoundingClientRect();
    this.startX = event.clientX - rect.left;
    this.startY = event.clientY - rect.top;
    this.currentX = this.startX;
    this.currentY = this.startY;
    
    console.log('🔵 Selection started at:', this.startX, this.startY);
  }

  /**
   * Handle mouse move event
   */
  private handleMouseMove(event: MouseEvent): void {
    if (!this.isSelecting || !this.canvas || !this.ctx || !this.originalImageData) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    // Get current mouse position
    const rect = this.canvas.getBoundingClientRect();
    this.currentX = event.clientX - rect.left;
    this.currentY = event.clientY - rect.top;
    
    // Redraw the original image
    this.ctx.putImageData(this.originalImageData, 0, 0);
    
    // Draw selection rectangle
    this.drawSelectionRectangle();
  }

  /**
   * Handle mouse up event
   */
  private handleMouseUp(event: MouseEvent): void {
    if (!this.isSelecting) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    this.isSelecting = false;
    
    // Get final coordinates
    const rect = this.canvas!.getBoundingClientRect();
    this.currentX = event.clientX - rect.left;
    this.currentY = event.clientY - rect.top;
    
    // Calculate selection area
    const selectionArea = this.getSelectionArea();
    
    console.log('🔵 Selection completed:', selectionArea);
    
    // Crop the selected region
    this.cropSelection(selectionArea);
  }

  /**
   * Handle keyboard events
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      console.log('🔵 Selection cancelled by user');
      this.cleanup();
      this.options?.onCancel();
    }
  }

  /**
   * Draw selection rectangle with overlay
   */
  private drawSelectionRectangle(): void {
    if (!this.ctx || !this.canvas || !this.originalImageData) return;
    
    const selectionArea = this.getSelectionArea();
    
    // Validate selection area dimensions
    if (selectionArea.width <= 0 || selectionArea.height <= 0) {
      // If no valid selection, just show the dimmed overlay
      this.ctx.putImageData(this.originalImageData, 0, 0);
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }
    
    // First, restore the original image (screen capture)
    this.ctx.putImageData(this.originalImageData, 0, 0);
    
    // Debug: Check what we restored
    const restoredSample = this.ctx.getImageData(100, 100, 1, 1);
    console.log('🔵 Sample pixel after restoring original:', restoredSample.data);
    
    // Apply semi-transparent dark overlay to the entire canvas
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Debug: Check after overlay
    const overlayedSample = this.ctx.getImageData(100, 100, 1, 1);
    console.log('🔵 Sample pixel after overlay:', overlayedSample.data);
    
    // Clear the selected rectangle area to show the bright, undimmed content
    this.ctx.clearRect(selectionArea.x, selectionArea.y, selectionArea.width, selectionArea.height);
    
    // Debug: Check after clearRect
    const clearedSample = this.ctx.getImageData(selectionArea.x + 10, selectionArea.y + 10, 1, 1);
    console.log('🔵 Sample pixel after clearRect:', clearedSample.data);
    
    // Redraw the original image data in the cleared selection area (bright and clear)
    try {
      const selectionImageData = this.ctx.createImageData(selectionArea.width, selectionArea.height);
      const originalData = this.originalImageData.data;
      const selectionData = selectionImageData.data;
      
      // Copy pixels from original image to selection area
      for (let y = 0; y < selectionArea.height; y++) {
        for (let x = 0; x < selectionArea.width; x++) {
          const sourceX = selectionArea.x + x;
          const sourceY = selectionArea.y + y;
          
          if (sourceX >= 0 && sourceX < this.canvas.width && sourceY >= 0 && sourceY < this.canvas.height) {
            const sourceIndex = (sourceY * this.canvas.width + sourceX) * 4;
            const targetIndex = (y * selectionArea.width + x) * 4;
            
            selectionData[targetIndex] = originalData[sourceIndex];     // R
            selectionData[targetIndex + 1] = originalData[sourceIndex + 1]; // G
            selectionData[targetIndex + 2] = originalData[sourceIndex + 2]; // B
            selectionData[targetIndex + 3] = originalData[sourceIndex + 3]; // A
          }
        }
      }
      
      // Put the bright selection area back
      this.ctx.putImageData(selectionImageData, selectionArea.x, selectionArea.y);
    } catch (error) {
      console.error('🔴 Error creating selection image data:', error);
      // Fallback: just clear the selection area without redrawing pixels
    }
    
    // Draw selection rectangle border
    this.ctx.strokeStyle = '#2196F3';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([8, 4]);
    this.ctx.strokeRect(selectionArea.x, selectionArea.y, selectionArea.width, selectionArea.height);
    
    // Draw corner handles
    this.drawCornerHandles(selectionArea);
  }

  /**
   * Draw corner handles for better UX
   */
  private drawCornerHandles(area: SelectionArea): void {
    if (!this.ctx || area.width <= 0 || area.height <= 0) return;
    
    const handleSize = 8;
    this.ctx.fillStyle = '#2196F3';
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([]);
    
    // Corner positions
    const corners = [
      { x: area.x - handleSize/2, y: area.y - handleSize/2 }, // Top-left
      { x: area.x + area.width - handleSize/2, y: area.y - handleSize/2 }, // Top-right
      { x: area.x - handleSize/2, y: area.y + area.height - handleSize/2 }, // Bottom-left
      { x: area.x + area.width - handleSize/2, y: area.y + area.height - handleSize/2 } // Bottom-right
    ];
    
    corners.forEach(corner => {
      this.ctx!.fillRect(corner.x, corner.y, handleSize, handleSize);
      this.ctx!.strokeRect(corner.x, corner.y, handleSize, handleSize);
    });
  }

  /**
   * Get normalized selection area
   */
  private getSelectionArea(): SelectionArea {
    const x = Math.min(this.startX, this.currentX);
    const y = Math.min(this.startY, this.currentY);
    const width = Math.abs(this.currentX - this.startX);
    const height = Math.abs(this.currentY - this.startY);
    
    return { x, y, width, height };
  }

  /**
   * Crop the selected region
   */
  private cropSelection(selectionArea: SelectionArea): void {
    if (!this.ctx || !this.originalImageData || !this.canvas) {
      console.error('🔴 Cannot crop: missing context or image data');
      return;
    }
    
    // Ensure minimum selection size
    if (selectionArea.width < 20 || selectionArea.height < 20) {
      console.log('🔵 Selection too small, using full screen');
      selectionArea = {
        x: 0,
        y: 0,
        width: this.canvas.width,
        height: this.canvas.height
      };
    }
    
    // Create temporary canvas for cropping
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = selectionArea.width;
    cropCanvas.height = selectionArea.height;
    const cropCtx = cropCanvas.getContext('2d');
    
    if (!cropCtx) {
      console.error('🔴 Failed to get crop canvas context');
      return;
    }
    
    // Draw the selected region from the original image data
    const imageData = this.ctx.getImageData(
      selectionArea.x, 
      selectionArea.y, 
      selectionArea.width, 
      selectionArea.height
    );
    
    cropCtx.putImageData(imageData, 0, 0);
    
    // Convert to base64 image data
    const croppedImageData = cropCanvas.toDataURL('image/png', 0.9);
    
    console.log('🔵 Region cropped successfully in content script, data length:', croppedImageData.length);
    
    // Call completion callback BEFORE cleanup (cleanup sets options to null)
    console.log('🔵 About to call onComplete callback with:', { selectionArea, croppedImageDataLength: croppedImageData.length });
    console.log('🔵 onComplete callback exists:', !!this.options?.onComplete);
    
    if (this.options?.onComplete) {
      console.log('🔵 Calling onComplete callback...');
      this.options.onComplete(selectionArea, croppedImageData);
      console.log('🔵 onComplete callback called successfully');
    } else {
      console.error('🔴 onComplete callback is missing!');
    }
    
    // Clean up after calling the callback
    this.cleanup();
  }

  /**
   * Show selection instructions
   */
  private showInstructions(): void {
    const instructions = document.createElement('div');
    instructions.id = 'nous-grade-screen-selector-instructions';
    instructions.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 20px 32px;
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 16px;
      font-weight: 600;
      z-index: 2147483648;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      text-align: center;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.1);
    `;
    
    instructions.innerHTML = `
      <div style="margin-bottom: 12px; font-size: 18px;">📸 Select the area you want to capture</div>
      <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">Click and drag to select the region</div>
      <div style="font-size: 12px; opacity: 0.7;">Press ESC to cancel • Click outside to select full screen</div>
    `;
    
    document.body.appendChild(instructions);
    
    // Remove instructions after 4 seconds
    setTimeout(() => {
      const instructionsEl = document.getElementById('nous-grade-screen-selector-instructions');
      if (instructionsEl) {
        instructionsEl.remove();
      }
    }, 4000);
  }

  /**
   * Clean up resources and remove elements
   */
  private cleanup(): void {
    // Remove event listeners
    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this.handleMouseDown.bind(this));
      this.canvas.removeEventListener('mousemove', this.handleMouseMove.bind(this));
      this.canvas.removeEventListener('mouseup', this.handleMouseUp.bind(this));
      this.canvas.removeEventListener('contextmenu', (e) => e.preventDefault());
    }
    
    document.removeEventListener('keydown', this.handleKeyDown.bind(this));
    
    // Remove overlay
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    
    // Remove instructions
    const instructions = document.getElementById('nous-grade-screen-selector-instructions');
    if (instructions) {
      instructions.remove();
    }
    
    // Reset state
    this.canvas = null;
    this.ctx = null;
    this.isSelecting = false;
    this.originalImageData = null;
    this.screenImage = null;
    this.options = null;
    
    console.log('🔵 Content script screen selector cleanup completed');
  }
}

// Export singleton instance
export const contentScriptScreenSelector = new ContentScriptScreenSelector();
