// Screen Selector Component for Region Selection
// Implements snipping tool functionality in offscreen document

export interface SelectionArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenSelectorOptions {
  onComplete: (selectionArea: SelectionArea, croppedImageData: string) => void;
  onCancel: () => void;
  captureType: 'student' | 'professor';
}

export class ScreenSelector {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private video: HTMLVideoElement | null = null;
  private isSelecting: boolean = false;
  private startX: number = 0;
  private startY: number = 0;
  private currentX: number = 0;
  private currentY: number = 0;
  private options: ScreenSelectorOptions | null = null;
  private originalImageData: ImageData | null = null;

  /**
   * Show the screen selector overlay
   */
  showSelector(video: HTMLVideoElement, options: ScreenSelectorOptions): void {
    console.log('🟠 Starting screen selector for:', options.captureType);
    
    this.video = video;
    this.options = options;
    
    // Create full-screen canvas overlay
    this.createCanvasOverlay();
    
    // Draw the video frame onto the canvas
    this.drawVideoFrame();
    
    // Add event listeners for selection
    this.addEventListeners();
    
    // Show instructions
    this.showInstructions();
  }

  /**
   * Create full-screen canvas overlay
   */
  private createCanvasOverlay(): void {
    // Create canvas element
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 999999;
      cursor: crosshair;
      background: rgba(0, 0, 0, 0.1);
    `;
    
    // Set canvas size to match screen
    this.canvas.width = window.screen.width;
    this.canvas.height = window.screen.height;
    
    // Get 2D context
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) {
      throw new Error('Failed to get canvas 2D context');
    }
    
    // Add canvas to document
    document.body.appendChild(this.canvas);
    
    console.log('🟠 Canvas overlay created:', this.canvas.width, 'x', this.canvas.height);
  }

  /**
   * Draw video frame onto canvas
   */
  private drawVideoFrame(): void {
    if (!this.canvas || !this.ctx || !this.video) {
      throw new Error('Canvas or video not available');
    }

    // Draw the video frame to fill the entire canvas
    this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    
    // Store the original image data for restoration during selection
    this.originalImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    
    console.log('🟠 Video frame drawn to canvas');
  }

  /**
   * Add mouse event listeners for selection
   */
  private addEventListeners(): void {
    if (!this.canvas) return;

    // Mouse down - start selection
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    
    // Mouse move - update selection
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    
    // Mouse up - complete selection
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    
    // Escape key - cancel selection
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    
    console.log('🟠 Event listeners added for selection');
  }

  /**
   * Handle mouse down event
   */
  private handleMouseDown(event: MouseEvent): void {
    this.isSelecting = true;
    
    // Get canvas-relative coordinates
    const rect = this.canvas!.getBoundingClientRect();
    this.startX = event.clientX - rect.left;
    this.startY = event.clientY - rect.top;
    this.currentX = this.startX;
    this.currentY = this.startY;
    
    console.log('🟠 Selection started at:', this.startX, this.startY);
  }

  /**
   * Handle mouse move event
   */
  private handleMouseMove(event: MouseEvent): void {
    if (!this.isSelecting || !this.canvas || !this.ctx || !this.originalImageData) return;
    
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
    
    this.isSelecting = false;
    
    // Get final coordinates
    const rect = this.canvas!.getBoundingClientRect();
    this.currentX = event.clientX - rect.left;
    this.currentY = event.clientY - rect.top;
    
    // Calculate selection area
    const selectionArea = this.getSelectionArea();
    
    console.log('🟠 Selection completed:', selectionArea);
    
    // Crop the selected region
    this.cropSelection(selectionArea);
  }

  /**
   * Handle keyboard events
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      console.log('🟠 Selection cancelled by user');
      this.cleanup();
      this.options?.onCancel();
    }
  }

  /**
   * Draw selection rectangle
   */
  private drawSelectionRectangle(): void {
    if (!this.ctx) return;
    
    const selectionArea = this.getSelectionArea();
    
    // Draw selection rectangle
    this.ctx.strokeStyle = '#2196F3';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.strokeRect(selectionArea.x, selectionArea.y, selectionArea.width, selectionArea.height);
    
    // Draw semi-transparent overlay outside selection
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    this.ctx.fillRect(0, 0, this.canvas!.width, selectionArea.y); // Top
    this.ctx.fillRect(0, selectionArea.y, selectionArea.x, selectionArea.height); // Left
    this.ctx.fillRect(selectionArea.x + selectionArea.width, selectionArea.y, 
                     this.canvas!.width - (selectionArea.x + selectionArea.width), selectionArea.height); // Right
    this.ctx.fillRect(0, selectionArea.y + selectionArea.height, this.canvas!.width, 
                     this.canvas!.height - (selectionArea.y + selectionArea.height)); // Bottom
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
    if (!this.ctx || !this.originalImageData) {
      console.error('🔴 Cannot crop: missing context or image data');
      return;
    }
    
    // Ensure minimum selection size
    if (selectionArea.width < 10 || selectionArea.height < 10) {
      console.log('🟠 Selection too small, using full screen');
      selectionArea = {
        x: 0,
        y: 0,
        width: this.canvas!.width,
        height: this.canvas!.height
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
    
    // Draw the selected region onto the crop canvas
    cropCtx.drawImage(
      this.canvas!,
      selectionArea.x, selectionArea.y, selectionArea.width, selectionArea.height,
      0, 0, selectionArea.width, selectionArea.height
    );
    
    // Convert to base64 image data
    const croppedImageData = cropCanvas.toDataURL('image/png');
    
    console.log('🟠 Region cropped successfully, data length:', croppedImageData.length);
    
    // Clean up and call completion callback
    this.cleanup();
    this.options?.onComplete(selectionArea, croppedImageData);
  }

  /**
   * Show selection instructions
   */
  private showInstructions(): void {
    const instructions = document.createElement('div');
    instructions.id = 'screen-selector-instructions';
    instructions.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      z-index: 1000000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      text-align: center;
    `;
    
    instructions.innerHTML = `
      <div style="margin-bottom: 8px;">📸 Select the area you want to capture</div>
      <div style="font-size: 12px; opacity: 0.8;">Click and drag to select • Press ESC to cancel</div>
    `;
    
    document.body.appendChild(instructions);
    
    // Remove instructions after 3 seconds
    setTimeout(() => {
      const instructionsEl = document.getElementById('screen-selector-instructions');
      if (instructionsEl) {
        instructionsEl.remove();
      }
    }, 3000);
  }

  /**
   * Clean up resources and remove elements
   */
  private cleanup(): void {
    // Remove canvas
    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
    }
    
    // Remove instructions
    const instructions = document.getElementById('screen-selector-instructions');
    if (instructions) {
      instructions.remove();
    }
    
    // Remove event listeners
    document.removeEventListener('keydown', this.handleKeyDown.bind(this));
    
    // Reset state
    this.ctx = null;
    this.video = null;
    this.isSelecting = false;
    this.originalImageData = null;
    this.options = null;
    
    console.log('🟠 Screen selector cleanup completed');
  }
}

// Export singleton instance
export const screenSelector = new ScreenSelector();
