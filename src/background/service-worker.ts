// Service Worker for Nous-Grade Extension
// Handles toolbar icon clicks and coordinates with content scripts

import { backendAPI } from '../services/backend-api';
import { sessionManager } from '../services/session-manager';
import { ImageToMarkdownRequest, GradeAnswerRequest } from '../types/backend';

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

// Listen for messages from content scripts and offscreen documents
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('🟢 Service worker received message:', message, 'from:', sender);
  
  switch (message.type) {
    case 'START_CAPTURE':
      // Instead of handling capture in service worker, delegate back to content script
      // This is because Desktop Capture API in Manifest V3 has restrictions when called from service worker
      console.log('🟢 Delegating capture back to content script for tab:', sender.tab?.id);
      
      if (sender.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, {
          type: 'HANDLE_DESKTOP_CAPTURE',
          captureType: message.captureType
        }).then(() => {
          console.log('🟢 Desktop capture delegation sent to content script');
        }).catch(error => {
          console.error('🔴 Error delegating to content script:', error);
        });
      }
      
      sendResponse({ success: true });
      break;
      
    case 'CAPTURE_COMPLETE':
      handleOffscreenCaptureComplete(message.requestId, message.imageData);
      sendResponse({ success: true });
      break;
      
    case 'CAPTURE_ERROR':
      handleOffscreenCaptureError(message.requestId, message.error);
      sendResponse({ success: true });
      break;
      
        case 'PROCESS_STREAM':
          handleProcessStream(message.streamId, message.captureType, sender);
          sendResponse({ success: true });
          break;

        case 'CAPTURE_COMPLETE_FROM_POPUP':
          handleCaptureCompleteFromPopup(message.imageData, message.captureType, sender);
          sendResponse({ success: true });
          break;

        case 'START_GRADING':
          handleStartGrading(message.studentImageData, message.professorImageData);
          sendResponse({ success: true });
          break;

        case 'CONVERT_IMAGE_TO_MARKDOWN':
          handleImageToMarkdown(message.imageData, message.type, sender);
          sendResponse({ success: true });
          break;

        case 'PROCESS_GRADING':
          handleProcessGrading(message.studentMarkdown, message.professorMarkdown, sender);
          sendResponse({ success: true });
          break;

        case 'GET_SESSION_STATE':
          handleGetSessionState(sender);
          sendResponse({ success: true });
          break;

        case 'CLEAR_SESSION':
          handleClearSession(sender);
          sendResponse({ success: true });
          break;

        default:
          console.log('Unknown message type:', message.type);
          sendResponse({ success: false, error: 'Unknown message type' });
  }
  
  return true; // Keep the message channel open for async responses
});

// Handle capture start requests
async function handleStartCapture(captureType: 'student' | 'professor', tabId?: number) {
  console.log(`🟢 Starting capture for ${captureType} on tab ${tabId}`);
  
  try {
    // Generate unique request ID
    const requestId = `capture_${captureType}_${Date.now()}`;
    
    // Request desktop media access
    console.log('Requesting desktop media access...');
    
    // Ensure we have a valid tab ID
    console.log('🟢 Tab ID received:', tabId);
    if (!tabId) {
      throw new Error('No tab ID available for desktop capture');
    }
    
    const streamId = await new Promise<string>((resolve, reject) => {
      console.log('🟢 Calling chrome.desktopCapture.chooseDesktopMedia...');
      
      // Call the API with proper error handling
      const requestId = chrome.desktopCapture.chooseDesktopMedia(
        ['screen', 'window', 'tab'],
        (streamId) => {
          console.log('🟢 Desktop capture callback called with streamId:', streamId);
          console.log('🟢 chrome.runtime.lastError:', chrome.runtime.lastError);
          
          if (chrome.runtime.lastError) {
            console.error('Desktop capture error:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message || 'Desktop capture failed'));
            return;
          }
          
          if (streamId) {
            console.log('Stream ID received successfully:', streamId);
            resolve(streamId);
          } else {
            console.log('No stream ID received - user likely cancelled');
            reject(new Error('User cancelled screen selection or no stream available'));
          }
        }
      );
      
      console.log('🟢 Desktop capture request ID:', requestId);
      
      // Set a timeout to detect if the dialog never appears
      setTimeout(() => {
        console.log('🔴 Desktop capture timeout - dialog may not have appeared');
        reject(new Error('Desktop capture dialog timeout - dialog may not have appeared'));
      }, 30000); // 30 second timeout
    });

    console.log(`Desktop media stream ID obtained: ${streamId}`);

    // Create offscreen document if it doesn't exist
    await ensureOffscreenDocument();

    // Store the tab ID for this capture request
    await chrome.storage.local.set({
      [`request_${requestId}`]: {
        tabId,
        captureType,
        timestamp: Date.now()
      }
    });

    // Send capture request to offscreen document
    chrome.runtime.sendMessage({
      type: 'START_CAPTURE',
      streamId,
      requestId
    });

    console.log(`Capture request sent to offscreen document for ${captureType}`);

  } catch (error) {
    console.error('Error starting capture:', error);
    
    // Determine error type and provide appropriate message
    let errorMessage = 'Unknown capture error';
    if (error instanceof Error) {
      if (error.message.includes('User cancelled')) {
        errorMessage = 'Screen selection was cancelled. Please try again and select a screen to capture.';
      } else if (error.message.includes('no stream available')) {
        errorMessage = 'No screen available for capture. Please ensure you have screens to share.';
      } else {
        errorMessage = error.message;
      }
    }
    
    // Send error back to content script
    if (tabId) {
      try {
        await chrome.tabs.sendMessage(tabId, {
          type: 'CAPTURE_ERROR',
          captureType,
          error: errorMessage
        });
      } catch (messageError) {
        console.log('Could not send error message to tab:', messageError);
      }
    }
  }
}

// Ensure offscreen document exists
async function ensureOffscreenDocument() {
  // Check if offscreen document already exists
  try {
    const existingContexts = await (chrome.runtime as any).getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });

    if (existingContexts.length > 0) {
      console.log('Offscreen document already exists');
      return;
    }
  } catch (error) {
    console.log('getContexts not available, proceeding to create offscreen document');
  }

  // Create offscreen document
  console.log('Creating offscreen document...');
  await chrome.offscreen.createDocument({
    url: 'offscreen/offscreen-document.html',
    reasons: [chrome.offscreen.Reason.USER_MEDIA],
    justification: 'Screen capture for grading interface'
  });

  console.log('Offscreen document created');
}

// Handle capture completion from offscreen document
async function handleOffscreenCaptureComplete(requestId: string, imageData: string) {
  console.log(`Offscreen capture completed for request: ${requestId}`);
  console.log(`Image data length: ${imageData.length} characters`);
  
  try {
    // Get the stored request info
    const result = await chrome.storage.local.get(`request_${requestId}`);
    const requestInfo = result[`request_${requestId}`];
    
    if (!requestInfo) {
      console.error('Request info not found for:', requestId);
      return;
    }
    
    const { tabId, captureType } = requestInfo;
    
    // Store the captured image data
    await chrome.storage.local.set({
      [`capture_${captureType}`]: {
        imageData,
        timestamp: Date.now(),
        requestId
      }
    });
    
    console.log(`${captureType} capture data stored successfully`);
    
    // Send success message to the specific tab
    if (tabId) {
      try {
        await chrome.tabs.sendMessage(tabId, {
          type: 'CAPTURE_COMPLETE',
          captureType,
          imageData,
          success: true
        });
        console.log(`Capture complete message sent to tab ${tabId}`);
      } catch (error) {
        console.log('Could not send message to tab:', error);
      }
    }
    
    // Clean up request info
    await chrome.storage.local.remove(`request_${requestId}`);
    
  } catch (error) {
    console.error('Error handling capture completion:', error);
  }
}

// Handle capture error from offscreen document
async function handleOffscreenCaptureError(requestId: string, error: string) {
  console.error(`Offscreen capture error for request ${requestId}:`, error);
  
  try {
    // Get the stored request info
    const result = await chrome.storage.local.get(`request_${requestId}`);
    const requestInfo = result[`request_${requestId}`];
    
    if (!requestInfo) {
      console.error('Request info not found for:', requestId);
      return;
    }
    
    const { tabId, captureType } = requestInfo;
    
    // Send error message to the specific tab
    if (tabId) {
      try {
        await chrome.tabs.sendMessage(tabId, {
          type: 'CAPTURE_ERROR',
          captureType,
          error,
          success: false
        });
        console.log(`Capture error message sent to tab ${tabId}`);
      } catch (error) {
        console.log('Could not send error message to tab:', error);
      }
    }
    
    // Clean up request info
    await chrome.storage.local.remove(`request_${requestId}`);
    
  } catch (error) {
    console.error('Error handling capture error:', error);
  }
}

// Handle capture completion from popup
async function handleCaptureCompleteFromPopup(imageData: string, captureType: 'student' | 'professor', sender: chrome.runtime.MessageSender) {
  console.log('🟢 Handling capture completion from popup for:', captureType);
  console.log('🟢 Image data length:', imageData.length);
  
  try {
    // Store in session manager
    await sessionManager.storeCapturedImage(captureType, imageData);

    // Also store in legacy format for backward compatibility
    await chrome.storage.local.set({
      [`capture_${captureType}`]: {
        imageData,
        timestamp: Date.now(),
        source: 'popup'
      }
    });

    console.log(`🟢 ${captureType} capture data stored successfully`);

    // Find the active tab to send success message
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];

    if (activeTab?.id) {
      try {
        await chrome.tabs.sendMessage(activeTab.id, {
          type: 'CAPTURE_COMPLETE',
          captureType,
          imageData,
          success: true
        });
        console.log(`🟢 Capture complete message sent to tab ${activeTab.id}`);
      } catch (error) {
        console.log('Could not send message to active tab:', error);
      }
    }

    // Auto-convert to markdown if both images are captured
    const session = sessionManager.getCurrentSession();
    if (session && session.studentImageData && session.professorImageData) {
      console.log('🟢 Both images captured, starting auto-conversion');
      
      // Convert student answer
      if (!session.studentMarkdown) {
        handleImageToMarkdown(session.studentImageData, 'student', sender);
      }
      
      // Convert professor answer
      if (!session.professorMarkdown) {
        handleImageToMarkdown(session.professorImageData, 'professor', sender);
      }
    }

  } catch (error) {
    console.error('🔴 Error handling capture completion from popup:', error);
  }
}

// Handle stream processing requests
async function handleProcessStream(streamId: string, captureType: 'student' | 'professor', sender: chrome.runtime.MessageSender) {
  console.log('🟢 Processing stream for:', captureType, 'streamId:', streamId);
  
  try {
    // Ensure offscreen document exists
    await ensureOffscreenDocument();
    
    // Generate a unique request ID
    const requestId = `${captureType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store request info for later reference
    await chrome.storage.local.set({
      [`request_${requestId}`]: {
        captureType,
        tabId: sender.tab?.id,
        timestamp: Date.now()
      }
    });
    
    console.log('🟢 Sending stream to offscreen document:', { requestId, streamId, captureType });
    
    // Send the stream to the offscreen document for processing
    await chrome.runtime.sendMessage({
      type: 'PROCESS_MEDIA_STREAM',
      streamId: streamId,
      captureType: captureType,
      requestId: requestId
    });
    
    console.log('🟢 Stream processing request sent to offscreen document');
    
  } catch (error) {
    console.error('🔴 Error processing stream:', error);
    
    // Send error back to popup if possible
    if (sender.tab?.id) {
      try {
        await chrome.tabs.sendMessage(sender.tab.id, {
          type: 'CAPTURE_ERROR',
          captureType,
          error: error instanceof Error ? error.message : 'Stream processing failed'
        });
      } catch (msgError) {
        console.log('Could not send error message to tab:', msgError);
      }
    }
  }
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

// Handle image to markdown conversion
async function handleImageToMarkdown(imageData: string, type: 'student' | 'professor', sender: chrome.runtime.MessageSender) {
  console.log('🟢 Starting image to markdown conversion for:', type);
  
  try {
    sessionManager.updateProcessingState({
      status: type === 'student' ? 'converting-student' : 'converting-professor',
      progress: type === 'student' ? 40 : 60,
      message: `Converting ${type} answer to markdown...`
    });

    const request: ImageToMarkdownRequest = {
      imageData,
      type
    };

    const result = await backendAPI.convertImageToMarkdown(request);

    if (result.success) {
      // Store markdown in session
      await sessionManager.storeMarkdown(type, result.markdown);

      // Send success message to UI
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'MARKDOWN_CONVERSION_COMPLETE',
          captureType: type,
          markdown: result.markdown,
          confidence: result.confidence,
          success: true
        }).catch(() => {
          // Ignore if content script not available
        });
      }

      console.log(`🟢 ${type} markdown conversion completed`);
    } else {
      throw new Error(result.error || 'Conversion failed');
    }

  } catch (error) {
    console.error(`🔴 ${type} markdown conversion failed:`, error);
    
    sessionManager.updateProcessingState({
      status: 'error',
      progress: 0,
      message: `Failed to convert ${type} answer: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Handle grading process
async function handleProcessGrading(studentMarkdown: string, professorMarkdown: string, sender: chrome.runtime.MessageSender) {
  console.log('🟢 Starting AI grading process');
  
  try {
    sessionManager.updateProcessingState({
      status: 'grading',
      progress: 80,
      message: 'AI is grading the student answer...'
    });

    const request: GradeAnswerRequest = {
      studentAnswer: studentMarkdown,
      modelAnswer: professorMarkdown,
      maxPoints: 10
    };

    const result = await backendAPI.gradeAnswer(request);

    if (result.success) {
      // Store grading result in session
      await sessionManager.storeGradingResult(result);

      // Send success message to UI
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'GRADING_COMPLETE',
          result: result,
          success: true
        }).catch(() => {
          // Ignore if content script not available
        });
      }

      console.log('🟢 AI grading completed:', result);
    } else {
      throw new Error(result.error || 'Grading failed');
    }

  } catch (error) {
    console.error('🔴 AI grading failed:', error);
    
    sessionManager.updateProcessingState({
      status: 'error',
      progress: 0,
      message: `Grading failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Handle session state requests
async function handleGetSessionState(sender: chrome.runtime.MessageSender) {
  const session = sessionManager.getCurrentSession();
  const processingState = sessionManager.getProcessingState();

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]?.id) {
    chrome.tabs.sendMessage(tabs[0].id, {
      type: 'SESSION_STATE_UPDATE',
      session: session,
      processingState: processingState,
      success: true
    }).catch(() => {
      // Ignore if content script not available
    });
  }
}

// Handle session clearing
async function handleClearSession(sender: chrome.runtime.MessageSender) {
  await sessionManager.clearSession();
  
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]?.id) {
    chrome.tabs.sendMessage(tabs[0].id, {
      type: 'SESSION_CLEARED',
      success: true
    }).catch(() => {
      // Ignore if content script not available
    });
  }
}
