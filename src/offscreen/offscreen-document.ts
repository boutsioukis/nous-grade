// Offscreen document for handling screen capture
// This runs in an offscreen context and processes media streams

import { OffscreenMessage, CropArea, MediaStreamConstraints } from '../types/capture';
import { captureFrameFromStream, createSelectionOverlay } from '../utils/image-processing';

console.log('Offscreen document loaded');

let currentStream: MediaStream | null = null;
let currentVideo: HTMLVideoElement | null = null;

// Listen for messages from the service worker
chrome.runtime.onMessage.addListener((message: OffscreenMessage, sender, sendResponse) => {
  console.log('Offscreen document received message:', message);

  switch (message.type) {
    case 'START_CAPTURE':
      if (message.streamId && message.requestId) {
        handleStartCapture(message.streamId, message.requestId);
      }
      break;
      
    case 'PROCESS_MEDIA_STREAM':
      if (message.streamId && message.requestId) {
        console.log('🟠 Offscreen processing media stream:', message.streamId, 'for:', message.captureType);
        handleStartCapture(message.streamId, message.requestId);
      }
      break;
      
    default:
      console.log('Unknown message type in offscreen document:', message.type);
  }

  return true; // Keep message channel open
});

/**
 * Handles the screen capture process
 */
async function handleStartCapture(streamId: string, requestId: string) {
  try {
    console.log(`Starting capture with streamId: ${streamId}`);

    // Create media stream constraints
    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: streamId
        }
      }
    };

    // Get the media stream
    currentStream = await navigator.mediaDevices.getUserMedia(constraints as any);
    console.log('Media stream obtained:', currentStream);

    // Create video element to display the stream
    currentVideo = document.createElement('video');
    currentVideo.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 10000;
      object-fit: contain;
      background: black;
    `;

    // Set up video element
    currentVideo.srcObject = currentStream;
    currentVideo.autoplay = true;
    currentVideo.muted = true;

    // Wait for video to be ready
    await new Promise<void>((resolve, reject) => {
      if (!currentVideo) {
        reject(new Error('Video element not available'));
        return;
      }

      currentVideo.onloadedmetadata = () => {
        console.log('Video metadata loaded');
        resolve();
      };

      currentVideo.onerror = () => {
        reject(new Error('Failed to load video stream'));
      };

      // Timeout after 10 seconds
      setTimeout(() => {
        reject(new Error('Video loading timeout'));
      }, 10000);
    });

    // Add video to document
    document.body.appendChild(currentVideo);

    // Show selection overlay
    console.log('Showing selection overlay');
    const cropArea = await createSelectionOverlay(currentVideo);
    console.log('Crop area selected:', cropArea);

    // Capture the selected area
    const imageData = await captureFrameFromStream(currentVideo, cropArea);
    console.log('Image captured, data length:', imageData.length);

    // Clean up
    cleanup();

    // Send success message back to service worker
    chrome.runtime.sendMessage({
      type: 'CAPTURE_COMPLETE',
      requestId,
      imageData,
      success: true
    } as OffscreenMessage);

  } catch (error) {
    console.error('Capture error:', error);
    
    // Clean up on error
    cleanup();

    // Send error message back to service worker
    chrome.runtime.sendMessage({
      type: 'CAPTURE_ERROR',
      requestId,
      error: error instanceof Error ? error.message : 'Unknown capture error'
    } as OffscreenMessage);
  }
}

/**
 * Cleans up resources
 */
function cleanup() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }

  if (currentVideo) {
    currentVideo.remove();
    currentVideo = null;
  }

  console.log('Cleanup completed');
}

// Handle page unload
window.addEventListener('beforeunload', cleanup);

// Export for potential external access
(window as any).offscreenCapture = {
  cleanup,
  getCurrentStream: () => currentStream,
  getCurrentVideo: () => currentVideo
};
