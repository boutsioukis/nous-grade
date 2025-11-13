// Content Script for Nous-Grade Extension
// This script runs in the context of web pages and injects the React grading UI

import React from 'react';
import { createRoot } from 'react-dom/client';
import GradingOverlay from '../components/GradingOverlay';
import { contentScriptScreenSelector } from '../components/ContentScriptScreenSelector';

console.log('Nous Grade content script ready');

let gradingUI: HTMLElement | null = null;
let reactRoot: any = null;

// Listen for custom events from injected UI
document.addEventListener('nous-grade-capture-request', (event: Event) => {
  const { captureType } = (event as CustomEvent<{ captureType: 'student' | 'professor' }>).detail;
  
  if (!chrome.runtime?.id) {
    const errorEvent = new CustomEvent('nous-grade-capture-error', {
      detail: {
        captureType,
        error: 'Extension context invalidated. Please reload the page and try again.',
      },
    });
    document.dispatchEvent(errorEvent);
    return;
  }
  
  hideGradingUI();
  
  chrome.runtime
    .sendMessage({
    type: 'START_CAPTURE',
      captureType,
    })
    .catch((error: unknown) => {
      const rawMessage =
        error instanceof Error ? error.message : 'Capture request failed. Please try again.';

    showGradingUI();
    
      const friendly =
        rawMessage.includes('Extension context invalidated')
          ? 'Extension was reloaded. Please refresh the page and try again.'
          : rawMessage;

    const errorEvent = new CustomEvent('nous-grade-capture-error', {
      detail: {
          captureType,
          error: friendly,
        },
    });
    document.dispatchEvent(errorEvent);
  });
});

// Listen for markdown conversion requests from injected UI
document.addEventListener('nous-grade-convert-to-markdown', (event: Event) => {
  const { studentImages, professorImages } = (event as CustomEvent<{
    studentImages: Array<unknown>;
    professorImages: Array<unknown>;
  }>).detail;

  if (!chrome.runtime?.id) {
    return;
  }
  
  chrome.runtime.sendMessage({
    type: 'CONVERT_MULTIPLE_IMAGES_TO_MARKDOWN',
    studentImages,
    professorImages,
  });
});

// Listen for grading requests from injected UI
document.addEventListener('nous-grade-grading-request', () => {
  if (!chrome.runtime?.id) {
    return;
  }
  
  chrome.runtime.sendMessage({ type: 'PROCESS_GRADING' });
});

// Listen for messages from the service worker
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!chrome.runtime?.id) {
    sendResponse({ success: false, error: 'Extension context invalidated' });
    return false;
  }
  
  switch (message.type) {
    case 'INJECT_GRADING_UI':
    injectGradingUI();
    sendResponse({ success: true });
      break;
    case 'REMOVE_GRADING_UI':
    removeGradingUI();
    sendResponse({ success: true });
      break;
    case 'CAPTURE_COMPLETE':
    case 'CAPTURE_ERROR':
    showGradingUI();
      document.dispatchEvent(
        new CustomEvent('nous-grade-capture-result', {
          detail: message,
        })
      );
    sendResponse({ success: true });
      break;
    case 'PROCESSING_STATE_UPDATE':
      document.dispatchEvent(
        new CustomEvent('nous-grade-processing-update', {
          detail: message.state,
        })
      );
    sendResponse({ success: true });
      break;
    case 'MARKDOWN_CONVERSION_COMPLETE':
    case 'MARKDOWN_CONVERSION_ALL_COMPLETE':
      document.dispatchEvent(
        new CustomEvent('nous-grade-markdown-complete', {
          detail: message,
        })
      );
    sendResponse({ success: true });
      break;
    case 'GRADING_COMPLETE':
      document.dispatchEvent(
        new CustomEvent('nous-grade-grading-complete', {
          detail: message,
        })
      );
    sendResponse({ success: true });
      break;
    case 'SHOW_SCREEN_SELECTOR':
    showFullBrowserScreenSelector(message.screenImageData, message.captureType);
    sendResponse({ success: true });
      break;
    default:
      sendResponse({ success: false, error: 'Unknown message type' });
      break;
  }
  
  return true;
});

// Function to inject the React grading UI
function injectGradingUI() {
  // Check if grading UI already exists
  if (gradingUI) {
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
}

// Function to temporarily hide the grading UI during capture
function hideGradingUI() {
  if (gradingUI) {
    gradingUI.style.display = 'none';
  }
}

// Function to show the grading UI after capture
function showGradingUI() {
  if (gradingUI) {
    gradingUI.style.display = 'block';
  }
}

// Function to remove the grading UI
function removeGradingUI() {
  if (gradingUI && reactRoot) {
    reactRoot.unmount();
    gradingUI.remove();
    gradingUI = null;
    reactRoot = null;
  }
}

// Function to handle capture requests
// DEPRECATED: Old mock capture function - no longer used
// Direct tab capture is now handled in the service worker

// Function to show full-browser screen selector
async function showFullBrowserScreenSelector(screenImageData: string, captureType: 'student' | 'professor') {
  try {
    await contentScriptScreenSelector.showSelector({
      screenImageData,
      captureType,
      onComplete: (selectionArea, croppedImageData) => {
        if (!chrome.runtime?.id) {
          return;
        }
        
        chrome.runtime
          .sendMessage({
          type: 'CAPTURE_COMPLETE_FROM_CONTENT_SCRIPT',
          imageData: croppedImageData,
            captureType,
            selectionArea,
          })
          .catch((error: unknown) => {
            console.error('Failed to send cropped image to service worker:', error);
        });
      },
      onCancel: () => {
        showGradingUI();
        chrome.runtime
          .sendMessage({
          type: 'CAPTURE_CANCELLED',
            captureType,
          })
          .catch((error: unknown) => {
            console.error('Failed to notify service worker about cancellation:', error);
        });
      }
    });
  } catch (error) {
    console.error('Failed to show screen selector:', error);
    showGradingUI();
  }
}

// DEPRECATED: Old desktop capture function - no longer used
// Direct tab capture is now handled in the service worker
