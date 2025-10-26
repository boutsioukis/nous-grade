// Content Script for Nous-Grade Extension
// This script runs in the context of web pages and injects the React grading UI

import React from 'react';
import { createRoot } from 'react-dom/client';
import GradingOverlay from '../components/GradingOverlay';

console.log('Nous-Grade Content Script loaded on:', window.location.href);

let gradingUI: HTMLElement | null = null;
let reactRoot: any = null;

// Listen for messages from the service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  if (message.type === 'INJECT_GRADING_UI') {
    injectGradingUI();
    sendResponse({ success: true });
  } else if (message.type === 'REMOVE_GRADING_UI') {
    removeGradingUI();
    sendResponse({ success: true });
  } else if (message.type === 'START_CAPTURE') {
    handleStartCapture(message.captureType);
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
