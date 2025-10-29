// Content Script for Nous-Grade Extension
// This script runs in the context of web pages and injects the React grading UI

import React from 'react';
import { createRoot } from 'react-dom/client';
import GradingOverlay from '../components/GradingOverlay';
import { contentScriptScreenSelector } from '../components/ContentScriptScreenSelector';

console.log('Nous-Grade Content Script loaded on:', window.location.href);

// Add a global test listener to debug event flow
document.addEventListener('nous-grade-capture-result', (event) => {
  console.log('🟡 GLOBAL: nous-grade-capture-result event detected:', event);
  console.log('🟡 GLOBAL: Event detail:', (event as CustomEvent).detail);
});

let gradingUI: HTMLElement | null = null;
let reactRoot: any = null;

// Listen for custom events from injected UI
document.addEventListener('nous-grade-capture-request', (event: Event) => {
  const customEvent = event as CustomEvent;
  console.log('🔵 Content script received capture request:', customEvent.detail);
  
  // Check if extension context is still valid
  if (!chrome.runtime?.id) {
    console.error('Extension context invalidated - extension may have been reloaded');
    
    // Send error back to the page
    const errorEvent = new CustomEvent('nous-grade-capture-error', {
      detail: {
        captureType: customEvent.detail.captureType,
        error: 'Extension context invalidated. Please reload the page and try again.'
      }
    });
    document.dispatchEvent(errorEvent);
    return;
  }
  
  // Forward the request to the service worker
  console.log('🔵 Forwarding to service worker:', customEvent.detail);
  chrome.runtime.sendMessage({
    type: customEvent.detail.type,
    captureType: customEvent.detail.captureType
  }).then(response => {
    console.log('🔵 Service worker response:', response);
  }).catch(error => {
    console.error('🔴 Error forwarding capture request:', error);
    
    let errorMessage = error.message;
    if (error.message.includes('Extension context invalidated')) {
      errorMessage = 'Extension was reloaded. Please refresh the page and try again.';
    }
    
    // Send error back to the page
    const errorEvent = new CustomEvent('nous-grade-capture-error', {
      detail: {
        captureType: customEvent.detail.captureType,
        error: errorMessage
      }
    });
    document.dispatchEvent(errorEvent);
  });
});

// Listen for markdown conversion requests from injected UI
document.addEventListener('nous-grade-convert-to-markdown', (event: Event) => {
  const customEvent = event as CustomEvent;
  console.log('🔵 Content script received markdown conversion request:', customEvent.detail);
  
  // Check if extension context is still valid
  if (!chrome.runtime?.id) {
    console.error('Extension context invalidated - extension may have been reloaded');
    return;
  }
  
  // Forward the conversion request to the service worker for both images
  chrome.runtime.sendMessage({
    type: 'CONVERT_IMAGE_TO_MARKDOWN',
    imageData: customEvent.detail.studentImageData,
    imageType: 'student'
  }).then(response => {
    console.log('🔵 Student markdown conversion response:', response);
  }).catch(error => {
    console.error('🔴 Error converting student image:', error);
  });

  chrome.runtime.sendMessage({
    type: 'CONVERT_IMAGE_TO_MARKDOWN',
    imageData: customEvent.detail.professorImageData,
    imageType: 'professor'
  }).then(response => {
    console.log('🔵 Professor markdown conversion response:', response);
  }).catch(error => {
    console.error('🔴 Error converting professor image:', error);
  });
});

// Listen for grading requests from injected UI
document.addEventListener('nous-grade-grading-request', (event: Event) => {
  const customEvent = event as CustomEvent;
  console.log('🔵 Content script received grading request:', customEvent.detail);
  
  // Check if extension context is still valid
  if (!chrome.runtime?.id) {
    console.error('Extension context invalidated - extension may have been reloaded');
    return;
  }
  
  // Forward the grading request to the service worker
  console.log('🔵 Forwarding grading request to service worker');
  chrome.runtime.sendMessage({
    type: 'PROCESS_GRADING'
  }).then(response => {
    console.log('🔵 Grading request service worker response:', response);
  }).catch(error => {
    console.error('🔴 Error forwarding grading request:', error);
  });
});

// Listen for messages from the service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  // Check if extension context is still valid
  if (!chrome.runtime?.id) {
    console.error('Extension context invalidated in message listener');
    sendResponse({ success: false, error: 'Extension context invalidated' });
    return false;
  }
  
  if (message.type === 'INJECT_GRADING_UI') {
    injectGradingUI();
    sendResponse({ success: true });
  } else if (message.type === 'REMOVE_GRADING_UI') {
    removeGradingUI();
    sendResponse({ success: true });
  } else if (message.type === 'START_CAPTURE') {
    handleStartCapture(message.captureType);
    sendResponse({ success: true });
  } else if (message.type === 'HANDLE_DESKTOP_CAPTURE') {
    // Handle desktop capture directly in content script
    console.log('🔵 Content script handling desktop capture for:', message.captureType);
    handleDesktopCapture(message.captureType);
    sendResponse({ success: true });
  } else if (message.type === 'CAPTURE_COMPLETE' || message.type === 'CAPTURE_ERROR') {
    // Forward capture results to the injected UI
    console.log('🔵 Forwarding capture result to injected UI:', message);
    console.log('🔵 Message details:', {
      type: message.type,
      captureType: message.captureType,
      success: message.success,
      hasImageData: !!message.imageData,
      imageDataLength: message.imageData ? message.imageData.length : 0
    });

    const resultEvent = new CustomEvent('nous-grade-capture-result', {
      detail: message
    });
    
    console.log('🔵 Dispatching nous-grade-capture-result event with detail:', resultEvent.detail);
    document.dispatchEvent(resultEvent);
    
    // Also log if there are any listeners
    console.log('🔵 Event dispatched. Current DOM ready state:', document.readyState);

    sendResponse({ success: true });
  } else if (message.type === 'PROCESSING_STATE_UPDATE') {
    // Forward processing state updates to the injected UI
    console.log('🔵 Forwarding processing state update to injected UI:', message);

    const stateEvent = new CustomEvent('nous-grade-processing-update', {
      detail: message.state
    });
    document.dispatchEvent(stateEvent);

    sendResponse({ success: true });
  } else if (message.type === 'MARKDOWN_CONVERSION_COMPLETE') {
    // Forward markdown conversion results to the injected UI
    console.log('🔵 Forwarding markdown conversion to injected UI:', message);

    const markdownEvent = new CustomEvent('nous-grade-markdown-complete', {
      detail: message
    });
    document.dispatchEvent(markdownEvent);

    sendResponse({ success: true });
  } else if (message.type === 'GRADING_COMPLETE') {
    // Forward grading results to the injected UI
    console.log('🔵 Forwarding grading results to injected UI:', message);

    const gradingEvent = new CustomEvent('nous-grade-grading-complete', {
      detail: message
    });
    document.dispatchEvent(gradingEvent);

    sendResponse({ success: true });
  } else if (message.type === 'SHOW_SCREEN_SELECTOR') {
    // Show full-browser screen selector overlay
    console.log('🔵 Showing full-browser screen selector for:', message.captureType);
    
    showFullBrowserScreenSelector(message.screenImageData, message.captureType);
    sendResponse({ success: true });
  }
  
  return true; // Keep the message channel open for async responses
});

// Function to inject the React grading UI
function injectGradingUI() {
  // Check if grading UI already exists
  if (gradingUI) {
    console.log('Grading UI already exists, removing first');
    removeGradingUI();
  }
  
  // Create container for React app
  gradingUI = document.createElement('div');
  gradingUI.id = 'nous-grade-grading-ui';
  gradingUI.className = 'nous-grade-overlay';
  
  // Inject into the page
  document.body.appendChild(gradingUI);
  
  // Create React root and render the component
  reactRoot = createRoot(gradingUI);
  reactRoot.render(React.createElement(GradingOverlay, {
    onClose: removeGradingUI
  }));
  
  console.log('Grading UI injected successfully');
}

// Function to remove the grading UI
function removeGradingUI() {
  if (gradingUI && reactRoot) {
    reactRoot.unmount();
    gradingUI.remove();
    gradingUI = null;
    reactRoot = null;
    console.log('Grading UI removed successfully');
  }
}

// Function to handle capture requests
function handleStartCapture(captureType: 'student' | 'professor') {
  console.log(`Starting capture for ${captureType}`);
  
  // For now, we'll simulate the capture process
  // In Phase 3, this will integrate with the actual screen capture API
  
  // Simulate successful capture after a short delay
  setTimeout(() => {
    const mockImageData = `data:image/png;base64,mock-${captureType}-image-data-${Date.now()}`;
    
    // Send capture complete message back to service worker
    chrome.runtime.sendMessage({
      type: 'CAPTURE_COMPLETE',
      captureType,
      imageData: mockImageData
    });
    
    console.log(`Mock capture completed for ${captureType}`);
  }, 1000);
}

// Function to show full-browser screen selector
async function showFullBrowserScreenSelector(screenImageData: string, captureType: 'student' | 'professor') {
  console.log('🔵 Starting full-browser screen selector for:', captureType);
  
  try {
    await contentScriptScreenSelector.showSelector({
      screenImageData: screenImageData,
      captureType: captureType,
      onComplete: (selectionArea, croppedImageData) => {
        console.log('🔵 Full-browser selection completed:', selectionArea);
        console.log('🔵 Cropped image data length:', croppedImageData.length);
        console.log('🔵 About to send CAPTURE_COMPLETE_FROM_CONTENT_SCRIPT message...');
        
        // Check if extension context is still valid
        if (!chrome.runtime?.id) {
          console.error('🔴 Extension context invalidated during completion');
          return;
        }
        
        // Send the cropped image data back to the service worker
        const message = {
          type: 'CAPTURE_COMPLETE_FROM_CONTENT_SCRIPT',
          imageData: croppedImageData,
          captureType: captureType,
          selectionArea: selectionArea
        };
        
        console.log('🔵 Sending message to service worker:', message);
        
        chrome.runtime.sendMessage(message).then(response => {
          console.log('🔵 Service worker response received:', response);
        }).catch(error => {
          console.error('🔴 Error sending cropped image to service worker:', error);
          console.error('🔴 Error details:', error.message);
        });
      },
      onCancel: () => {
        console.log('🔵 Full-browser selection cancelled');
        
        // Send cancellation message to service worker
        chrome.runtime.sendMessage({
          type: 'CAPTURE_CANCELLED',
          captureType: captureType
        }).catch(error => {
          console.error('🔴 Error sending cancellation to service worker:', error);
        });
      }
    });
    
  } catch (error) {
    console.error('🔴 Error showing full-browser screen selector:', error);
  }
}

// Function to handle desktop capture requests from service worker
async function handleDesktopCapture(captureType: 'student' | 'professor') {
  console.log('🔵 Content script attempting desktop capture for:', captureType);
  
  try {
    // Content scripts can't directly use chrome.desktopCapture API
    // We need to send a message to trigger popup-based capture
    
    // Send a message to the injected UI to show a notification
    const notificationEvent = new CustomEvent('nous-grade-capture-notification', {
      detail: {
        type: 'CAPTURE_INSTRUCTION',
        captureType: captureType,
        message: `Please use the extension popup to capture ${captureType} answer. Click the extension icon and use the "Capture ${captureType} Answer" button.`
      }
    });
    document.dispatchEvent(notificationEvent);
    
    console.log('🔵 Desktop capture instruction sent to injected UI');
    
  } catch (error) {
    console.error('🔴 Error in handleDesktopCapture:', error);
    
    // Send error event to injected UI
    const errorEvent = new CustomEvent('nous-grade-capture-error', {
      detail: {
        captureType: captureType,
        error: 'Desktop capture must be initiated from extension popup'
      }
    });
    document.dispatchEvent(errorEvent);
  }
}
