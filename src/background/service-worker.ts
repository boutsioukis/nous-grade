// Service Worker for Nous-Grade Extension
// Handles toolbar icon clicks and coordinates with content scripts

console.log('Nous-Grade Service Worker loaded');

// Listen for extension icon clicks
chrome.action.onClicked.addListener((tab) => {
  console.log('Extension icon clicked on tab:', tab.id);
  
  if (!tab.id) {
    console.error('No tab ID available');
    return;
  }
  
  // Send message to content script to inject the grading UI
  chrome.tabs.sendMessage(tab.id, { type: 'INJECT_GRADING_UI' })
    .then((response) => {
      console.log('Grading UI injection response:', response);
    })
    .catch((error) => {
      console.error('Error injecting grading UI:', error);
      // Fallback: try to inject via scripting API
      chrome.scripting.executeScript({
        target: { tabId: tab.id! },
        func: () => {
          console.log('Fallback injection triggered');
        }
      });
    });
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Service worker received message:', message);
  
  switch (message.type) {
    case 'START_CAPTURE':
      handleStartCapture(message.captureType, sender.tab?.id);
      sendResponse({ success: true });
      break;
      
    case 'CAPTURE_COMPLETE':
      handleCaptureComplete(message.captureType, message.imageData);
      sendResponse({ success: true });
      break;
      
    case 'START_GRADING':
      handleStartGrading(message.studentImageData, message.professorImageData);
      sendResponse({ success: true });
      break;
      
    default:
      console.log('Unknown message type:', message.type);
      sendResponse({ success: false, error: 'Unknown message type' });
  }
  
  return true; // Keep the message channel open for async responses
});

// Handle capture start requests
function handleStartCapture(captureType: 'student' | 'professor', tabId?: number) {
  console.log(`Starting capture for ${captureType} on tab ${tabId}`);
  
  // For now, we'll just log the request
  // In Phase 3, this will integrate with the Desktop Capture API
  console.log(`Capture request received for ${captureType}`);
}

// Handle capture completion
function handleCaptureComplete(captureType: 'student' | 'professor', imageData: string) {
  console.log(`Capture completed for ${captureType}`);
  console.log(`Image data length: ${imageData.length} characters`);
  
  // Store the captured image data
  // In a real implementation, this would be stored in chrome.storage
  console.log(`Mock ${captureType} image captured successfully`);
}

// Handle grading start requests
function handleStartGrading(studentImageData: string, professorImageData: string) {
  console.log('Starting grading process...');
  console.log(`Student image data length: ${studentImageData.length}`);
  console.log(`Professor image data length: ${professorImageData.length}`);
  
  // For now, we'll simulate the grading process
  // In Phase 4, this will integrate with the backend API
  
  setTimeout(() => {
    const mockResult = {
      gradedAnswer: 'Mock graded answer with points allocated',
      points: 8,
      maxPoints: 10,
      reasoning: 'Student demonstrated good understanding of the concept but missed some key details.',
      feedback: 'Good work! Consider reviewing the specific requirements mentioned in the question.'
    };
    
    console.log('Mock grading completed:', mockResult);
    
    // Send result back to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'GRADING_COMPLETE',
          result: mockResult
        });
      }
    });
  }, 2000);
}
