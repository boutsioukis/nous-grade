// Screen region selection component for cropping captured images
// Provides an overlay interface for selecting specific areas of the screen

export interface SelectionArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class ScreenSelector {
  private overlay: HTMLDivElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private video: HTMLVideoElement | null = null;
  private isSelecting: boolean = false;
  private startX: number = 0;
  private startY: number = 0;
  private currentX: number = 0;
  private currentY: number = 0;
  private onSelectionComplete: ((area: SelectionArea, croppedImageData: string) => void) | null = null;
  private onCancel: (() => void) | null = null;

  /**
   * Show the screen selector overlay with the video stream
   */
  async showSelector(
    videoElement: HTMLVideoElement,
    onComplete: (area: SelectionArea, croppedImageData: string) => void,
    onCancel: () => void
  ): Promise<void> {
    console.log('🟡 Showing screen selector overlay');
    
    this.video = videoElement;
    this.onSelectionComplete = onComplete;
    this.onCancel = onCancel;

    // Create overlay
    this.createOverlay();
    
    // Create canvas for drawing
    this.createCanvas();
    
    // Draw the current video frame
    this.drawVideoFrame();
    
    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Create the overlay container
   */
  private createOverlay(): void {
    this.overlay = document.createElement('div');
    this.overlay.id = 'nous-grade-screen-selector';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.8);
      z-index: 10001;
      cursor: crosshair;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    `;

    // Add instructions
    const instructions = document.createElement('div');
    instructions.style.cssText = `
      position: absolute;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 16px;
      font-weight: 600;
      text-align: center;
      z-index: 10002;
    `;
    instructions.innerHTML = `
      <div>Select the area to capture</div>
      <div style="font-size: 14px; font-weight: normal; margin-top: 8px; opacity: 0.8;">
        Click and drag to select • Press ESC to cancel
      </div>
    `;

    // Add cancel button
    const cancelButton = document.createElement('button');
    cancelButton.textContent = '× Cancel';
    cancelButton.style.cssText = `
      position: absolute;
      top: 20px;
      right: 20px;
      background: #f44336;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 12px 20px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      z-index: 10002;
    `;
    cancelButton.addEventListener('click', () => this.cancel());

    this.overlay.appendChild(instructions);
    this.overlay.appendChild(cancelButton);
    document.body.appendChild(this.overlay);
  }

  /**
   * Create the canvas for drawing the video frame and selection
   */
  private createCanvas(): void {
    if (!this.video || !this.overlay) return;

    this.canvas = document.createElement('canvas');
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.canvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      cursor: crosshair;
    `;

    this.ctx = this.canvas.getContext('2d');
    this.overlay.appendChild(this.canvas);
  }

  /**
   * Draw the current video frame onto the canvas
   */
  private drawVideoFrame(): void {
    if (!this.ctx || !this.video || !this.canvas) return;

    // Calculate scaling to fit video in viewport while maintaining aspect ratio
    const videoAspect = this.video.videoWidth / this.video.videoHeight;
    const canvasAspect = this.canvas.width / this.canvas.height;

    let drawWidth, drawHeight, offsetX, offsetY;

    if (videoAspect > canvasAspect) {
      // Video is wider than canvas
      drawWidth = this.canvas.width;
      drawHeight = this.canvas.width / videoAspect;
      offsetX = 0;
      offsetY = (this.canvas.height - drawHeight) / 2;
    } else {
      // Video is taller than canvas
      drawWidth = this.canvas.height * videoAspect;
      drawHeight = this.canvas.height;
      offsetX = (this.canvas.width - drawWidth) / 2;
      offsetY = 0;
    }

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw video frame
    this.ctx.drawImage(this.video, offsetX, offsetY, drawWidth, drawHeight);

    // Store the video drawing parameters for later use
    (this.canvas as any)._videoDrawParams = { offsetX, offsetY, drawWidth, drawHeight };
  }

  /**
   * Set up mouse event listeners for selection
   */
  private setupEventListeners(): void {
    if (!this.canvas) return;

    // Mouse down - start selection
    this.canvas.addEventListener('mousedown', (e) => {
      this.isSelecting = true;
      const rect = this.canvas!.getBoundingClientRect();
      this.startX = e.clientX - rect.left;
      this.startY = e.clientY - rect.top;
      this.currentX = this.startX;
      this.currentY = this.startY;
    });

    // Mouse move - update selection
    this.canvas.addEventListener('mousemove', (e) => {
      if (!this.isSelecting) return;
      
      const rect = this.canvas!.getBoundingClientRect();
      this.currentX = e.clientX - rect.left;
      this.currentY = e.clientY - rect.top;
      
      this.redrawCanvas();
    });

    // Mouse up - complete selection
    this.canvas.addEventListener('mouseup', () => {
      if (this.isSelecting) {
        this.completeSelection();
      }
    });

    // Keyboard events
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.cancel();
      }
    });
  }

  /**
   * Redraw the canvas with the current selection
   */
  private redrawCanvas(): void {
    if (!this.ctx || !this.canvas) return;

    // Redraw the video frame
    this.drawVideoFrame();

    // Draw selection rectangle
    const selectionX = Math.min(this.startX, this.currentX);
    const selectionY = Math.min(this.startY, this.currentY);
    const selectionWidth = Math.abs(this.currentX - this.startX);
    const selectionHeight = Math.abs(this.currentY - this.startY);

    // Draw semi-transparent overlay everywhere except selection
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Clear the selection area (make it fully visible)
    this.ctx.clearRect(selectionX, selectionY, selectionWidth, selectionHeight);
    
    // Redraw the video in the selection area
    const params = (this.canvas as any)._videoDrawParams;
    if (params && this.video) {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(selectionX, selectionY, selectionWidth, selectionHeight);
      this.ctx.clip();
      this.ctx.drawImage(this.video, params.offsetX, params.offsetY, params.drawWidth, params.drawHeight);
      this.ctx.restore();
    }

    // Draw selection border
    this.ctx.strokeStyle = '#2196F3';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(selectionX, selectionY, selectionWidth, selectionHeight);

    // Draw selection info
    this.ctx.fillStyle = '#2196F3';
    this.ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    this.ctx.fillText(
      `${Math.round(selectionWidth)} × ${Math.round(selectionHeight)}`,
      selectionX,
      selectionY - 8
    );
  }

  /**
   * Complete the selection and crop the image
   */
  private completeSelection(): void {
    if (!this.canvas || !this.video || !this.onSelectionComplete) return;

    const selectionX = Math.min(this.startX, this.currentX);
    const selectionY = Math.min(this.startY, this.currentY);
    const selectionWidth = Math.abs(this.currentX - this.startX);
    const selectionHeight = Math.abs(this.currentY - this.startY);

    // Validate selection size
    if (selectionWidth < 10 || selectionHeight < 10) {
      alert('Selection too small. Please select a larger area.');
      this.isSelecting = false;
      return;
    }

    console.log('🟡 Cropping selected area:', { selectionX, selectionY, selectionWidth, selectionHeight });

    // Create a new canvas for the cropped image
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = selectionWidth;
    croppedCanvas.height = selectionHeight;
    const croppedCtx = croppedCanvas.getContext('2d');

    if (!croppedCtx) {
      console.error('Failed to get cropped canvas context');
      return;
    }

    // Get the video drawing parameters
    const params = (this.canvas as any)._videoDrawParams;
    if (!params) {
      console.error('Video drawing parameters not found');
      return;
    }

    // Calculate the source coordinates in the original video
    const scaleX = this.video.videoWidth / params.drawWidth;
    const scaleY = this.video.videoHeight / params.drawHeight;
    
    const sourceX = (selectionX - params.offsetX) * scaleX;
    const sourceY = (selectionY - params.offsetY) * scaleY;
    const sourceWidth = selectionWidth * scaleX;
    const sourceHeight = selectionHeight * scaleY;

    // Draw the cropped portion
    croppedCtx.drawImage(
      this.video,
      sourceX, sourceY, sourceWidth, sourceHeight,
      0, 0, selectionWidth, selectionHeight
    );

    // Convert to base64
    const croppedImageData = croppedCanvas.toDataURL('image/png');
    
    console.log('🟡 Cropped image data length:', croppedImageData.length);

    // Create selection area object
    const selectionArea: SelectionArea = {
      x: selectionX,
      y: selectionY,
      width: selectionWidth,
      height: selectionHeight
    };

    // Call completion callback
    this.onSelectionComplete(selectionArea, croppedImageData);

    // Clean up
    this.cleanup();
  }

  /**
   * Cancel the selection
   */
  private cancel(): void {
    console.log('🟡 Screen selection cancelled');
    
    if (this.onCancel) {
      this.onCancel();
    }
    
    this.cleanup();
  }

  /**
   * Clean up the overlay and event listeners
   */
  private cleanup(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    
    this.canvas = null;
    this.ctx = null;
    this.video = null;
    this.isSelecting = false;
    this.onSelectionComplete = null;
    this.onCancel = null;
    
    // Remove keyboard event listener
    document.removeEventListener('keydown', this.cancel);
    
    console.log('🟡 Screen selector cleaned up');
  }
}

// Export singleton instance
export const screenSelector = new ScreenSelector();
