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
    
    // Use scripting API to inject the grading UI directly
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: injectGradingUIFromPopup
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
    
    // Use scripting API to remove the grading UI directly
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: removeGradingUIFromPopup
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

// Function to inject grading UI (to be executed in page context)
function injectGradingUIFromPopup() {
  // Check if grading UI already exists
  const existingUI = document.getElementById('nous-grade-grading-ui');
  if (existingUI) {
    console.log('Grading UI already exists');
    return;
  }
  
  // Create a simple grading UI overlay
  const overlay = document.createElement('div');
  overlay.id = 'nous-grade-grading-ui';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.8);
    z-index: 10000;
    display: flex;
    justify-content: center;
    align-items: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  const container = document.createElement('div');
  container.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 24px;
    max-width: 800px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  `;
  
  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #e0e0e0;">
      <h2 style="margin: 0; color: #333; font-size: 24px; font-weight: 600;">Nous-Grade Tool</h2>
      <button id="close-grading-ui" style="background: #f5f5f5; border: none; border-radius: 50%; width: 32px; height: 32px; font-size: 18px; cursor: pointer; color: #666;">×</button>
    </div>
    
    <!-- Processing Status Bar -->
    <div id="processing-status" style="margin-bottom: 24px; padding: 16px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #2196F3;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div id="processing-spinner" style="width: 20px; height: 20px; border: 2px solid #e0e0e0; border-top: 2px solid #2196F3; border-radius: 50%; animation: spin 1s linear infinite; display: none;"></div>
        <div>
          <div id="processing-message" style="font-weight: 600; color: #333;">Ready to start grading</div>
          <div id="processing-progress" style="font-size: 12px; color: #666; margin-top: 4px;">Click capture buttons to begin</div>
        </div>
      </div>
      <div id="progress-bar" style="width: 100%; height: 4px; background: #e0e0e0; border-radius: 2px; margin-top: 12px; overflow: hidden;">
        <div id="progress-fill" style="width: 0%; height: 100%; background: #2196F3; transition: width 0.3s ease;"></div>
      </div>
    </div>

    <div style="margin-bottom: 24px;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
        <div id="student-panel" style="background: #f8f9fa; border-radius: 8px; padding: 20px; border: 2px solid #e9ecef;">
          <h3 style="margin: 0 0 16px 0; color: #495057; font-size: 16px; font-weight: 600;">Student Answer</h3>
          <div id="student-content" style="min-height: 200px;">
            <div id="student-capture-area" style="display: flex; align-items: center; justify-content: center; min-height: 200px;">
              <button id="capture-student" style="background: #4CAF50; color: white; border: none; border-radius: 8px; padding: 16px 24px; font-size: 14px; font-weight: 600; cursor: pointer;">
                + Capture Student Answer
              </button>
            </div>
            <div id="student-markdown" style="display: none; background: white; border-radius: 4px; padding: 16px; font-family: monospace; font-size: 12px; max-height: 300px; overflow-y: auto; border: 1px solid #ddd;"></div>
          </div>
        </div>
        
        <div id="professor-panel" style="background: #f8f9fa; border-radius: 8px; padding: 20px; border: 2px solid #e9ecef;">
          <h3 style="margin: 0 0 16px 0; color: #495057; font-size: 16px; font-weight: 600;">Professor Answer</h3>
          <div id="professor-content" style="min-height: 200px;">
            <div id="professor-capture-area" style="display: flex; align-items: center; justify-content: center; min-height: 200px;">
              <button id="capture-professor" style="background: #4CAF50; color: white; border: none; border-radius: 8px; padding: 16px 24px; font-size: 14px; font-weight: 600; cursor: pointer;">
                + Capture Professor Answer
              </button>
            </div>
            <div id="professor-markdown" style="display: none; background: white; border-radius: 4px; padding: 16px; font-family: monospace; font-size: 12px; max-height: 300px; overflow-y: auto; border: 1px solid #ddd;"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Grading Results Section -->
    <div id="grading-results" style="display: none; margin-bottom: 24px; padding: 20px; background: #f0f8ff; border-radius: 8px; border: 2px solid #2196F3;">
      <h3 style="margin: 0 0 16px 0; color: #1976D2; font-size: 18px; font-weight: 600;">Grading Results</h3>
      <div id="grading-score" style="margin-bottom: 16px; padding: 12px; background: white; border-radius: 4px; text-align: center;">
        <span id="points-earned" style="font-size: 24px; font-weight: bold; color: #4CAF50;">-</span>
        <span style="font-size: 18px; color: #666;"> / </span>
        <span id="points-total" style="font-size: 18px; color: #666;">10</span>
        <div style="font-size: 14px; color: #666; margin-top: 4px;">Points</div>
      </div>
      <div id="grading-feedback" style="background: white; border-radius: 4px; padding: 16px; margin-bottom: 12px;">
        <h4 style="margin: 0 0 8px 0; color: #333;">Feedback:</h4>
        <p id="feedback-text" style="margin: 0; color: #555; line-height: 1.5;"></p>
      </div>
      <div id="grading-reasoning" style="background: white; border-radius: 4px; padding: 16px;">
        <h4 style="margin: 0 0 8px 0; color: #333;">Reasoning:</h4>
        <p id="reasoning-text" style="margin: 0; color: #555; line-height: 1.5;"></p>
      </div>
    </div>
    
    <div style="display: flex; justify-content: center; margin-bottom: 24px;">
      <button id="start-grading" style="background: #2196F3; color: white; border: none; border-radius: 8px; padding: 16px 32px; font-size: 16px; font-weight: 600; cursor: pointer;">
        Start Grading
      </button>
    </div>
    
    <div style="display: flex; justify-content: space-around; padding-top: 16px; border-top: 1px solid #e0e0e0;">
      <div style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: #666;">
        <span id="student-status" style="width: 12px; height: 12px; border-radius: 50%; background: #ccc;"></span>
        Student Answer Pending
      </div>
      <div style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: #666;">
        <span id="professor-status" style="width: 12px; height: 12px; border-radius: 50%; background: #ccc;"></span>
        Professor Answer Pending
      </div>
    </div>
  `;
  
  overlay.appendChild(container);
  document.body.appendChild(overlay);

  // Add CSS for spinner animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
  
  // Listen for capture result events from content script
  document.addEventListener('nous-grade-capture-result', (event: Event) => {
    const customEvent = event as CustomEvent;
    console.log('Received capture result:', customEvent.detail);
    const message = customEvent.detail;
    
    if (message.type === 'CAPTURE_COMPLETE') {
      // Display the captured image as a thumbnail
      displayCapturedImage(message.captureType, message.imageData);
      
      const button = document.getElementById(`capture-${message.captureType}`) as HTMLButtonElement;
      
      if (button) {
        button.textContent = '✓ Captured';
        button.style.background = '#4CAF50';
        button.disabled = false;
      }
    } else if (message.type === 'CAPTURE_ERROR') {
      const button = document.getElementById(`capture-${message.captureType}`) as HTMLButtonElement;
      
      if (button) {
        button.textContent = 'Error - Try Again';
        button.style.background = '#f44336';
        button.disabled = false;
      }
    }
  });
  
  // Listen for processing state updates
  document.addEventListener('nous-grade-processing-update', (event: Event) => {
    const customEvent = event as CustomEvent;
    console.log('Received processing update:', customEvent.detail);
    updateProcessingState(customEvent.detail);
  });

  // Listen for markdown conversion completion
  document.addEventListener('nous-grade-markdown-complete', (event: Event) => {
    const customEvent = event as CustomEvent;
    console.log('Received markdown conversion:', customEvent.detail);
    displayMarkdown(customEvent.detail.captureType, customEvent.detail.markdown);
  });

  // Listen for grading completion
  document.addEventListener('nous-grade-grading-complete', (event: Event) => {
    const customEvent = event as CustomEvent;
    console.log('Received grading result:', customEvent.detail);
    displayGradingResults(customEvent.detail.result);
  });

  // Listen for capture notifications from content script
  document.addEventListener('nous-grade-capture-notification', (event: Event) => {
    const customEvent = event as CustomEvent;
    console.log('Received capture notification:', customEvent.detail);
    const { captureType, message } = customEvent.detail;
    
    // Show a notification to the user
    const notificationDiv = document.createElement('div');
    notificationDiv.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #2196F3;
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      z-index: 10002;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      max-width: 500px;
      text-align: center;
    `;
    notificationDiv.textContent = message;
    document.body.appendChild(notificationDiv);
    
    // Remove the notification after 8 seconds
    setTimeout(() => {
      notificationDiv.remove();
    }, 8000);
    
    // Update the button to show instruction
    const button = document.getElementById(`capture-${captureType}`) as HTMLButtonElement;
    if (button) {
      button.textContent = 'Use Extension Popup';
      button.style.background = '#2196F3';
      button.disabled = false;
    }
  });
  
  // Also listen for capture errors from content script
  document.addEventListener('nous-grade-capture-error', (event: Event) => {
    const customEvent = event as CustomEvent;
    console.log('Received capture error:', customEvent.detail);
    const { captureType, error } = customEvent.detail;
    
    const button = document.getElementById(`capture-${captureType}`) as HTMLButtonElement;
    if (button) {
      if (error.includes('Extension context invalidated') || error.includes('Extension was reloaded')) {
        button.textContent = 'Reload Page & Try Again';
        button.style.background = '#ff9800';
        
        // Show a more prominent message
        const statusDiv = document.createElement('div');
        statusDiv.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: #ff9800;
          color: white;
          padding: 16px 24px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          z-index: 10001;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        statusDiv.textContent = 'Extension was reloaded. Please refresh this page and try again.';
        document.body.appendChild(statusDiv);
        
        // Remove the message after 5 seconds
        setTimeout(() => {
          statusDiv.remove();
        }, 5000);
      } else {
        button.textContent = 'Error - Try Again';
        button.style.background = '#f44336';
      }
      button.disabled = false;
    }
  });
  
  // Add event listeners
  document.getElementById('close-grading-ui')?.addEventListener('click', () => {
    overlay.remove();
  });
  
  document.getElementById('capture-student')?.addEventListener('click', async () => {
    const button = document.getElementById('capture-student') as HTMLButtonElement;
    const status = document.getElementById('student-status');
    
    if (button && status) {
      // Update UI to show capturing state
      button.textContent = 'Capturing...';
      button.style.background = '#ff9800';
      button.disabled = true;
      
      try {
        // Try to call desktop capture directly from popup context
        console.log('Sending capture request for student...');
        
        // Since we're injected into the page, we need to use a different approach
        // Let's try calling the desktop capture API through the extension context
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          console.log('🟡 Attempting direct desktop capture from popup context');
          
          // Try to get desktop media directly
          try {
            const streamId = await new Promise<string>((resolve, reject) => {
              if (chrome.desktopCapture && chrome.desktopCapture.chooseDesktopMedia) {
                chrome.desktopCapture.chooseDesktopMedia(
                  ['screen', 'window', 'tab'],
                  (streamId) => {
                    if (streamId) {
                      resolve(streamId);
                    } else {
                      reject(new Error('User cancelled or no stream available'));
                    }
                  }
                );
              } else {
                reject(new Error('Desktop capture API not available'));
              }
            });
            
            console.log('🟡 Got stream ID from popup:', streamId);
            // For now, just simulate success
            button.textContent = '✓ Captured (Direct)';
            button.style.background = '#4CAF50';
            button.disabled = false;
            return;
            
          } catch (directError) {
            console.log('🟡 Direct capture failed, falling back to content script:', directError);
          }
        }
        
        // Fallback to content script approach
        const captureEvent = new CustomEvent('nous-grade-capture-request', {
          detail: {
            type: 'START_CAPTURE',
            captureType: 'student'
          }
        });
        
        document.dispatchEvent(captureEvent);
        
        // For now, assume success (will be handled by event response)
        const response = { success: true };
        
        if (response.success) {
          // Wait for capture completion (handled by message listener)
          console.log('Student capture request sent successfully');
        } else {
          throw new Error('Failed to start capture');
        }
      } catch (error) {
        console.error('Error starting student capture:', error);
        button.textContent = 'Error - Try Again';
        button.style.background = '#f44336';
        button.disabled = false;
      }
    }
  });
  
  document.getElementById('capture-professor')?.addEventListener('click', async () => {
    const button = document.getElementById('capture-professor') as HTMLButtonElement;
    const status = document.getElementById('professor-status');
    
    if (button && status) {
      // Update UI to show capturing state
      button.textContent = 'Capturing...';
      button.style.background = '#ff9800';
      button.disabled = true;
      
      try {
        // Send capture request to service worker via content script
        // Since we're in page context, we need to use a different approach
        console.log('Sending capture request for professor...');
        
        // Create a custom event to communicate with content script
        const captureEvent = new CustomEvent('nous-grade-capture-request', {
          detail: {
            type: 'START_CAPTURE',
            captureType: 'professor'
          }
        });
        
        document.dispatchEvent(captureEvent);
        
        // For now, assume success (will be handled by event response)
        const response = { success: true };
        
        if (response.success) {
          // Wait for capture completion (handled by message listener)
          console.log('Professor capture request sent successfully');
        } else {
          throw new Error('Failed to start capture');
        }
      } catch (error) {
        console.error('Error starting professor capture:', error);
        button.textContent = 'Error - Try Again';
        button.style.background = '#f44336';
        button.disabled = false;
      }
    }
  });
  
  document.getElementById('start-grading')?.addEventListener('click', async () => {
    const button = document.getElementById('start-grading') as HTMLButtonElement;
    if (button) {
      button.textContent = 'Processing...';
      button.style.background = '#ccc';
      button.disabled = true;
      
      try {
        // Get the markdown content from the UI
        const studentMarkdown = document.getElementById('student-markdown')?.textContent || '';
        const professorMarkdown = document.getElementById('professor-markdown')?.textContent || '';
        
        if (!studentMarkdown || !professorMarkdown) {
          throw new Error('Both student and professor answers must be converted to markdown first');
        }
        
        // Send grading request to service worker via content script
        console.log('Sending grading request to service worker...');
        
        // Create a custom event to communicate with content script
        const gradingEvent = new CustomEvent('nous-grade-grading-request', {
          detail: {
            type: 'PROCESS_GRADING',
            studentMarkdown: studentMarkdown,
            professorMarkdown: professorMarkdown
          }
        });
        
        document.dispatchEvent(gradingEvent);
        
        console.log('Grading request sent successfully');
        
      } catch (error) {
        console.error('Error starting grading process:', error);
        button.textContent = 'Error - Try Again';
        button.style.background = '#f44336';
        button.disabled = false;
        
        // Show error message
        alert(`Grading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  });
  
  console.log('Grading UI injected successfully');

  // Helper function to update processing state
  function updateProcessingState(state: any) {
    const messageEl = document.getElementById('processing-message');
    const progressEl = document.getElementById('processing-progress');
    const spinnerEl = document.getElementById('processing-spinner');
    const progressFillEl = document.getElementById('progress-fill');

    if (messageEl) messageEl.textContent = state.message || 'Processing...';
    if (progressEl) progressEl.textContent = `${state.progress || 0}% complete`;
    if (progressFillEl) progressFillEl.style.width = `${state.progress || 0}%`;
    
    if (spinnerEl) {
      spinnerEl.style.display = state.status === 'idle' || state.status === 'completed' ? 'none' : 'block';
    }
  }

  // Helper function to display captured image thumbnail
  function displayCapturedImage(type: 'student' | 'professor', imageData: string) {
    const captureArea = document.getElementById(`${type}-capture-area`);
    const markdownArea = document.getElementById(`${type}-markdown`);
    
    if (captureArea) {
      // Create thumbnail preview
      const thumbnailContainer = document.createElement('div');
      thumbnailContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        padding: 16px;
      `;
      
      const thumbnail = document.createElement('img');
      thumbnail.src = imageData;
      thumbnail.style.cssText = `
        max-width: 200px;
        max-height: 150px;
        border-radius: 4px;
        border: 2px solid #4CAF50;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      `;
      
      const status = document.createElement('div');
      status.style.cssText = `
        font-size: 12px;
        color: #4CAF50;
        font-weight: 600;
      `;
      status.textContent = '✓ Captured';
      
      thumbnailContainer.appendChild(thumbnail);
      thumbnailContainer.appendChild(status);
      
      // Replace capture area with thumbnail
      captureArea.innerHTML = '';
      captureArea.appendChild(thumbnailContainer);
    }

    // Update status indicator
    const statusIndicator = document.getElementById(`${type}-status`);
    if (statusIndicator) {
      statusIndicator.style.background = '#4CAF50';
      statusIndicator.style.boxShadow = '0 0 8px rgba(76, 175, 80, 0.5)';
    }
  }

  // Helper function to display markdown content
  function displayMarkdown(type: 'student' | 'professor', markdown: string) {
    const captureArea = document.getElementById(`${type}-capture-area`);
    const markdownArea = document.getElementById(`${type}-markdown`);
    
    if (captureArea && markdownArea) {
      captureArea.style.display = 'none';
      markdownArea.style.display = 'block';
      markdownArea.textContent = markdown;
    }

    // Update status indicator
    const status = document.getElementById(`${type}-status`);
    if (status) {
      status.style.background = '#4CAF50';
      status.style.boxShadow = '0 0 8px rgba(76, 175, 80, 0.5)';
    }
  }

  // Helper function to display grading results
  function displayGradingResults(result: any) {
    const resultsSection = document.getElementById('grading-results');
    const pointsEarned = document.getElementById('points-earned');
    const pointsTotal = document.getElementById('points-total');
    const feedbackText = document.getElementById('feedback-text');
    const reasoningText = document.getElementById('reasoning-text');

    if (resultsSection) resultsSection.style.display = 'block';
    if (pointsEarned) pointsEarned.textContent = result.points.toString();
    if (pointsTotal) pointsTotal.textContent = result.maxPoints.toString();
    if (feedbackText) feedbackText.textContent = result.feedback;
    if (reasoningText) reasoningText.textContent = result.reasoning;

    // Update start grading button
    const startButton = document.getElementById('start-grading') as HTMLButtonElement;
    if (startButton) {
      startButton.textContent = 'Grading Complete!';
      startButton.style.background = '#4CAF50';
      startButton.disabled = true;
    }
  }
}

// Function to remove grading UI (to be executed in page context)
function removeGradingUIFromPopup() {
  const existingUI = document.getElementById('nous-grade-grading-ui');
  if (existingUI) {
    existingUI.remove();
    console.log('Grading UI removed successfully');
  }
}
