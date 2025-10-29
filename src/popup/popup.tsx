// Popup script for Nous-Grade Extension
// Handles popup UI interactions

console.log('Nous-Grade Popup loaded');

// Get DOM elements
const injectButton = document.getElementById('inject-hello') as HTMLButtonElement;
const removeButton = document.getElementById('remove-hello') as HTMLButtonElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;

// Update status message
function updateStatus(message: string) {
  statusDiv.textContent = message;
}

// Inject Grading UI button handler
injectButton.addEventListener('click', async () => {
  try {
    updateStatus('Injecting Grading UI...');
    
    // Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.id) {
      updateStatus('Error: No active tab');
      return;
    }
    
    // Check if the current tab is a restricted URL
    if (tab.url && (
      tab.url.startsWith('chrome://') ||
      tab.url.startsWith('chrome-extension://') ||
      tab.url.startsWith('moz-extension://') ||
      tab.url.startsWith('edge://') ||
      tab.url.startsWith('about:')
    )) {
      updateStatus('Cannot inject on this page. Please navigate to a regular website.');
      return;
    }
    
    // Send message to content script to inject React UI
    await chrome.tabs.sendMessage(tab.id, {
      type: 'INJECT_GRADING_UI'
    });
    
    updateStatus('Grading UI injected!');
  } catch (error) {
    console.error('Error injecting grading UI:', error);
    
    // Provide more specific error messages
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('chrome://')) {
      updateStatus('Cannot inject on Chrome pages. Try a regular website.');
    } else if (errorMessage.includes('Cannot access')) {
      updateStatus('Cannot access this page. Try a different website.');
    } else {
      updateStatus('Injection failed. Try refreshing the page.');
    }
  }
});

// Show region selector overlay in popup context
async function showRegionSelector(canvas: HTMLCanvasElement, captureType: 'student' | 'professor'): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log('🟡 Starting region selector in popup context');
    
    // Create full-screen overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 999999;
      cursor: crosshair;
      background: rgba(0, 0, 0, 0.1);
    `;
    
    // Create selection canvas
    const selectionCanvas = document.createElement('canvas');
    selectionCanvas.width = window.screen.width;
    selectionCanvas.height = window.screen.height;
    selectionCanvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    `;
    
    const ctx = selectionCanvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Failed to get selection canvas context'));
      return;
    }
    
    // Draw the captured screen onto the selection canvas
    ctx.drawImage(canvas, 0, 0, selectionCanvas.width, selectionCanvas.height);
    
    // Store original image data
    const originalImageData = ctx.getImageData(0, 0, selectionCanvas.width, selectionCanvas.height);
    
    overlay.appendChild(selectionCanvas);
    document.body.appendChild(overlay);
    
    // Show instructions
    const instructions = document.createElement('div');
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
    
    // Selection state
    let isSelecting = false;
    let startX = 0, startY = 0, currentX = 0, currentY = 0;
    
    // Mouse event handlers
    const handleMouseDown = (e: MouseEvent) => {
      isSelecting = true;
      const rect = selectionCanvas.getBoundingClientRect();
      startX = (e.clientX - rect.left) * (selectionCanvas.width / rect.width);
      startY = (e.clientY - rect.top) * (selectionCanvas.height / rect.height);
      currentX = startX;
      currentY = startY;
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isSelecting) return;
      
      const rect = selectionCanvas.getBoundingClientRect();
      currentX = (e.clientX - rect.left) * (selectionCanvas.width / rect.width);
      currentY = (e.clientY - rect.top) * (selectionCanvas.height / rect.height);
      
      // Redraw
      ctx.putImageData(originalImageData, 0, 0);
      
      // Draw selection rectangle
      const x = Math.min(startX, currentX);
      const y = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);
      
      // Draw selection rectangle
      ctx.strokeStyle = '#2196F3';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(x, y, width, height);
      
      // Draw overlay outside selection
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, selectionCanvas.width, y); // Top
      ctx.fillRect(0, y, x, height); // Left
      ctx.fillRect(x + width, y, selectionCanvas.width - (x + width), height); // Right
      ctx.fillRect(0, y + height, selectionCanvas.width, selectionCanvas.height - (y + height)); // Bottom
    };
    
    const handleMouseUp = (e: MouseEvent) => {
      if (!isSelecting) return;
      isSelecting = false;
      
      const rect = selectionCanvas.getBoundingClientRect();
      currentX = (e.clientX - rect.left) * (selectionCanvas.width / rect.width);
      currentY = (e.clientY - rect.top) * (selectionCanvas.height / rect.height);
      
      // Calculate selection area
      const x = Math.min(startX, currentX);
      const y = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);
      
      // Ensure minimum size
      if (width < 10 || height < 10) {
        console.log('🟡 Selection too small, using full canvas');
        cleanup();
        resolve(canvas.toDataURL('image/png'));
        return;
      }
      
      // Crop selection
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = width;
      cropCanvas.height = height;
      const cropCtx = cropCanvas.getContext('2d');
      
      if (!cropCtx) {
        reject(new Error('Failed to get crop canvas context'));
        return;
      }
      
      // Draw selected region
      cropCtx.drawImage(selectionCanvas, x, y, width, height, 0, 0, width, height);
      
      const croppedImageData = cropCanvas.toDataURL('image/png');
      console.log('🟡 Region cropped in popup, data length:', croppedImageData.length);
      
      cleanup();
      resolve(croppedImageData);
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        console.log('🟡 Region selection cancelled');
        cleanup();
        reject(new Error('Region selection cancelled by user'));
      }
    };
    
    const cleanup = () => {
      selectionCanvas.removeEventListener('mousedown', handleMouseDown);
      selectionCanvas.removeEventListener('mousemove', handleMouseMove);
      selectionCanvas.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
      overlay.remove();
      instructions.remove();
    };
    
    // Add event listeners
    selectionCanvas.addEventListener('mousedown', handleMouseDown);
    selectionCanvas.addEventListener('mousemove', handleMouseMove);
    selectionCanvas.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);
    
    // Remove instructions after 3 seconds
    setTimeout(() => {
      if (instructions.parentNode) {
        instructions.remove();
      }
    }, 3000);
  });
}

// Capture full screen directly in popup context
async function captureFullScreen(streamId: string, captureType: 'student' | 'professor'): Promise<string> {
  console.log('🟡 Processing stream in popup context:', streamId);
  
  try {
    // Create media stream constraints
    const constraints = {
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: streamId
        }
      }
    };

    // Get the media stream using the streamId
    const stream = await navigator.mediaDevices.getUserMedia(constraints as any);
    console.log('🟡 Media stream obtained in popup:', stream);

    // Create video element to capture frame
    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.muted = true;
    video.style.display = 'none'; // Hidden video element
    document.body.appendChild(video);

    // Wait for video to be ready
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => {
        console.log('🟡 Video metadata loaded, dimensions:', video.videoWidth, 'x', video.videoHeight);
        resolve();
      };
      video.onerror = (e) => {
        console.error('🟡 Video error:', e);
        reject(new Error('Failed to load video stream'));
      };
      // Timeout after 10 seconds
      setTimeout(() => reject(new Error('Video loading timeout')), 10000);
    });

    // Capture the full screen immediately in the popup context
    // because streamId expires quickly in Manifest V3
    console.log('🟡 Stream ready, capturing full screen immediately to avoid expiration');
    
    // Create a canvas for the full screen capture
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Wait for video to actually start playing and showing content
    console.log('🟡 Waiting for video to start playing...');
    await new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 20; // 2 seconds max
      
      const checkVideo = () => {
        attempts++;
        console.log(`🟡 Attempt ${attempts}: Checking video content...`);
        
        // Try to play the video
        video.play().catch(() => {
          // Ignore play errors, video might already be playing
        });
        
        // Create a small test canvas to check if video has content
        const testCanvas = document.createElement('canvas');
        testCanvas.width = 100;
        testCanvas.height = 100;
        const testCtx = testCanvas.getContext('2d');
        
        if (testCtx) {
          testCtx.drawImage(video, 0, 0, 100, 100);
          const testPixel = testCtx.getImageData(50, 50, 1, 1);
          const hasContent = testPixel.data[0] > 0 || testPixel.data[1] > 0 || testPixel.data[2] > 0;
          
          console.log(`🟡 Test pixel: [${testPixel.data[0]}, ${testPixel.data[1]}, ${testPixel.data[2]}, ${testPixel.data[3]}]`);
          
          if (hasContent || attempts >= maxAttempts) {
            console.log(`🟡 Video content ${hasContent ? 'detected' : 'timeout'} after ${attempts} attempts`);
            resolve(undefined);
            return;
          }
        }
        
        // Wait 100ms and try again
        setTimeout(checkVideo, 100);
      };
      
      checkVideo();
    });
    
    // Debug video state
    console.log('🟡 Video ready state:', video.readyState);
    console.log('🟡 Video current time:', video.currentTime);
    console.log('🟡 Video dimensions:', video.videoWidth, 'x', video.videoHeight);
    console.log('🟡 Canvas dimensions:', canvas.width, 'x', canvas.height);
    
    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Debug what we captured
    const samplePixel = ctx.getImageData(100, 100, 1, 1);
    console.log('🟡 Sample pixel from video capture:', samplePixel.data);
    
    // Check if canvas has any content
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let hasContent = false;
    for (let i = 0; i < imageData.data.length; i += 4) {
      if (imageData.data[i] > 0 || imageData.data[i + 1] > 0 || imageData.data[i + 2] > 0) {
        hasContent = true;
        break;
      }
    }
    console.log('🟡 Video capture has content:', hasContent);
    
    // Clean up video and stream
    stream.getTracks().forEach(track => track.stop());
    video.remove();
    
    // Convert full screen to base64 image data
    const fullScreenImageData = canvas.toDataURL('image/png', 0.9);
    
    console.log('🟡 Full screen capture completed, data length:', fullScreenImageData.length);
    
    return fullScreenImageData;

  } catch (error) {
    console.error('🟡 Error processing stream in popup:', error);
    throw error;
  }
}

// Handle desktop capture directly in the popup
async function handleDesktopCapture(captureType: 'student' | 'professor') {
  try {
    updateStatus(`Capturing ${captureType} answer...`);
    
    console.log('🟡 Starting desktop capture from popup for:', captureType);
    
    // Call desktop capture API from popup context (this should work!)
    const streamId = await new Promise<string>((resolve, reject) => {
      chrome.desktopCapture.chooseDesktopMedia(
        ['screen', 'window', 'tab'],
        (streamId) => {
          console.log('🟡 Desktop capture callback in popup:', streamId);
          
          if (chrome.runtime.lastError) {
            console.error('🟡 Desktop capture error:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message || 'Desktop capture failed'));
            return;
          }
          
          if (streamId) {
            resolve(streamId);
          } else {
            reject(new Error('User cancelled screen selection'));
          }
        }
      );
    });
    
    console.log('🟡 Desktop capture successful, streamId:', streamId);
    updateStatus(`Processing ${captureType} capture...`);
    
    // Capture the full screen first, then send to content script for region selection
    const fullScreenImageData = await captureFullScreen(streamId, captureType);
    
    // Send the full screen image to content script for region selection
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) {
      throw new Error('No active tab found');
    }
    
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'SHOW_SCREEN_SELECTOR',
      screenImageData: fullScreenImageData,
      captureType: captureType
    });
    
    if (response.success) {
      updateStatus(`${captureType} region selection started...`);
      console.log('🟡 Full screen sent to content script for region selection');
    } else {
      throw new Error(response.error || 'Failed to start region selection');
    }
    
    return fullScreenImageData;
    
  } catch (error) {
    console.error('🟡 Desktop capture failed:', error);
    updateStatus(`${captureType} capture failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

// Add capture button handlers to the popup
document.addEventListener('DOMContentLoaded', () => {
  // Add capture buttons to the popup
  const captureStudentBtn = document.createElement('button');
  captureStudentBtn.textContent = 'Capture Student Answer';
  captureStudentBtn.className = 'button';
  captureStudentBtn.addEventListener('click', () => handleDesktopCapture('student'));
  
  const captureProfessorBtn = document.createElement('button');
  captureProfessorBtn.textContent = 'Capture Professor Answer';
  captureProfessorBtn.className = 'button';
  captureProfessorBtn.addEventListener('click', () => handleDesktopCapture('professor'));
  
  // Insert before the status div
  const statusDiv = document.getElementById('status');
  if (statusDiv && statusDiv.parentNode) {
    statusDiv.parentNode.insertBefore(captureStudentBtn, statusDiv);
    statusDiv.parentNode.insertBefore(captureProfessorBtn, statusDiv);
  }
});

// Remove Grading UI button handler
removeButton.addEventListener('click', async () => {
  try {
    updateStatus('Removing Grading UI...');
    
    // Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.id) {
      updateStatus('Error: No active tab');
      return;
    }
    
    // Check if the current tab is a restricted URL
    if (tab.url && (
      tab.url.startsWith('chrome://') ||
      tab.url.startsWith('chrome-extension://') ||
      tab.url.startsWith('moz-extension://') ||
      tab.url.startsWith('edge://') ||
      tab.url.startsWith('about:')
    )) {
      updateStatus('Cannot access this page. Please navigate to a regular website.');
      return;
    }
    
    // Send message to content script to remove React UI
    await chrome.tabs.sendMessage(tab.id, {
      type: 'REMOVE_GRADING_UI'
    });
    
    updateStatus('Grading UI removed!');
  } catch (error) {
    console.error('Error removing grading UI:', error);
    
    // Provide more specific error messages
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('chrome://')) {
      updateStatus('Cannot access Chrome pages. Try a regular website.');
    } else if (errorMessage.includes('Cannot access')) {
      updateStatus('Cannot access this page. Try a different website.');
    } else {
      updateStatus('Removal failed. UI may not be present.');
    }
  }
});

// Old HTML-based UI functions removed - now using React component via content script
