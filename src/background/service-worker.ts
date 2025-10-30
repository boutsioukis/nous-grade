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
      // Use the new direct tab capture flow
      console.log('🟢 Starting direct tab capture for:', message.captureType);
      
      if (sender.tab?.id) {
        handleStartCapture(message.captureType, sender.tab.id);
      } else {
        console.error('🔴 No tab ID available for capture');
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
          handleConvertToMarkdown(sender);
          sendResponse({ success: true });
          break;

        case 'CONVERT_MULTIPLE_IMAGES_TO_MARKDOWN':
          handleConvertMultipleImagesToMarkdown(message.studentImages, message.professorImages, sender);
          sendResponse({ success: true });
          break;

        case 'PROCESS_GRADING':
          handleProcessGrading(sender);
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

        case 'CAPTURE_COMPLETE_FROM_CONTENT_SCRIPT':
          handleCaptureCompleteFromContentScript(message.imageData, message.captureType, message.selectionArea, sender);
          sendResponse({ success: true });
          break;

        case 'CAPTURE_CANCELLED':
          handleCaptureCancelled(message.captureType, sender);
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
  console.log(`🟢 Starting direct tab capture for ${captureType} on tab ${tabId}`);
  
  try {
    // Ensure we have a valid tab ID
    if (!tabId) {
      throw new Error('No tab ID available for tab capture');
    }
    
    console.log('🟢 Capturing current tab directly...');
    
    // Capture the current tab directly using chrome.tabs.captureVisibleTab
    const tabImageData = await new Promise<string>((resolve, reject) => {
      chrome.tabs.captureVisibleTab(
        { format: 'png', quality: 100 },
        (dataUrl) => {
          if (chrome.runtime.lastError) {
            console.error('Tab capture error:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message || 'Tab capture failed'));
            return;
          }
          
          if (dataUrl) {
            console.log('🟢 Tab captured successfully, data length:', dataUrl.length);
            resolve(dataUrl);
          } else {
            reject(new Error('No image data received from tab capture'));
          }
        }
      );
    });

    console.log('🟢 Sending tab image to content script for area selection...');
    
    // Send the tab image directly to content script for area selection
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'SHOW_SCREEN_SELECTOR',
      screenImageData: tabImageData,
      captureType: captureType
    });

    if (response?.success) {
      console.log(`🟢 Tab capture initiated successfully for ${captureType}`);
    } else {
      throw new Error('Content script failed to show area selector');
    }

  } catch (error) {
    console.error(`🔴 Error starting capture for ${captureType}:`, error);
    
    // Update session with error
    const session = sessionManager.getCurrentSession();
    if (session) {
      sessionManager.updateProcessingState({
        status: 'error',
        progress: 0,
        message: `Capture failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
    
    // Send error to content script
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        type: 'CAPTURE_ERROR',
        captureType: captureType,
        error: error instanceof Error ? error.message : 'Unknown capture error'
      }).catch(() => {
        // Ignore if content script not available
      });
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

    // Check if both images are captured and update UI state
    const session = sessionManager.getCurrentSession();
    if (session && session.studentImageData && session.professorImageData) {
      console.log('🟢 Both images captured, ready for manual markdown conversion');
      
      // Update processing state to show both images are ready
      sessionManager.updateProcessingState({
        status: 'processing',
        progress: 30,
        message: 'Both images captured. Click "Translate to Markdown" to continue.'
      });
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

// Handle convert to markdown button click
async function handleConvertToMarkdown(sender: chrome.runtime.MessageSender) {
  console.log('🟢 Starting manual markdown conversion for both images');
  
  try {
    const session = sessionManager.getCurrentSession();
    if (!session?.studentImageData || !session?.professorImageData) {
      throw new Error('Both images must be captured before conversion');
    }

    // Ensure backend session is created before starting conversions
    try {
      await backendAPI.createSession();
      console.log('🟢 Backend session ensured before image conversions');
    } catch (error) {
      console.error('🔴 Failed to ensure backend session:', error);
      throw error;
    }

    // Convert both images sequentially to avoid race conditions
    await handleImageToMarkdown(session.studentImageData, 'student', sender);
    await handleImageToMarkdown(session.professorImageData, 'professor', sender);

    // Update final state
    sessionManager.updateProcessingState({
      status: 'editing',
      progress: 70,
      message: 'Both answers converted. Review and edit if needed.'
    });

    // Notify UI that markdown conversion is complete
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'MARKDOWN_CONVERSION_ALL_COMPLETE',
        success: true
      }).catch(() => {
        // Ignore if content script not available
      });
    }

  } catch (error) {
    console.error('🔴 Manual markdown conversion failed:', error);
    sessionManager.updateProcessingState({
      status: 'error',
      progress: 0,
      message: `Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Handle multiple images to markdown conversion
async function handleConvertMultipleImagesToMarkdown(
  studentImages: Array<{id: string, imageData: string, timestamp: number}>, 
  professorImages: Array<{id: string, imageData: string, timestamp: number}>, 
  sender: chrome.runtime.MessageSender
) {
  console.log('🟢 Starting multiple images markdown conversion');
  console.log(`🟢 Student images: ${studentImages.length}, Professor images: ${professorImages.length}`);
  
  try {
    // Ensure backend session is created before starting conversions
    try {
      await backendAPI.createSession();
      console.log('🟢 Backend session ensured before multiple image conversions');
    } catch (error) {
      console.error('🔴 Failed to ensure backend session:', error);
      throw error;
    }

    // Convert all student images and combine results
    let combinedStudentMarkdown = '';
    for (let i = 0; i < studentImages.length; i++) {
      const image = studentImages[i];
      console.log(`🟢 Converting student image ${i + 1}/${studentImages.length}`);
      
      sessionManager.updateProcessingState({
        status: 'converting-student',
        progress: 20 + (i / studentImages.length) * 20,
        message: `Converting student image ${i + 1} of ${studentImages.length}...`
      });

      const request = {
        imageData: image.imageData,
        type: 'student' as const
      };

      const result = await backendAPI.convertImageToMarkdown(request);
      
      if (result.success) {
        if (studentImages.length > 1) {
          combinedStudentMarkdown += `## Student Answer - Image ${i + 1}\n\n${result.markdown}\n\n`;
        } else {
          combinedStudentMarkdown = result.markdown;
        }
      } else {
        throw new Error(`Failed to convert student image ${i + 1}: ${result.error}`);
      }
    }

    // Convert all professor images and combine results
    let combinedProfessorMarkdown = '';
    for (let i = 0; i < professorImages.length; i++) {
      const image = professorImages[i];
      console.log(`🟢 Converting professor image ${i + 1}/${professorImages.length}`);
      
      sessionManager.updateProcessingState({
        status: 'converting-professor',
        progress: 40 + (i / professorImages.length) * 20,
        message: `Converting professor image ${i + 1} of ${professorImages.length}...`
      });

      const request = {
        imageData: image.imageData,
        type: 'professor' as const
      };

      const result = await backendAPI.convertImageToMarkdown(request);
      
      if (result.success) {
        if (professorImages.length > 1) {
          combinedProfessorMarkdown += `## Professor Answer - Image ${i + 1}\n\n${result.markdown}\n\n`;
        } else {
          combinedProfessorMarkdown = result.markdown;
        }
      } else {
        throw new Error(`Failed to convert professor image ${i + 1}: ${result.error}`);
      }
    }

    // Store combined markdown in session
    await sessionManager.storeMarkdown('student', combinedStudentMarkdown);
    await sessionManager.storeMarkdown('professor', combinedProfessorMarkdown);

    // Update final state
    sessionManager.updateProcessingState({
      status: 'editing',
      progress: 70,
      message: 'All images converted. Review and edit if needed.'
    });

    // Send success messages to UI for both types
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      // Send student markdown completion
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'MARKDOWN_CONVERSION_COMPLETE',
        captureType: 'student',
        markdown: combinedStudentMarkdown,
        confidence: 0.95, // Average confidence
        success: true
      }).catch(() => {
        // Ignore if content script not available
      });

      // Send professor markdown completion
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'MARKDOWN_CONVERSION_COMPLETE',
        captureType: 'professor',
        markdown: combinedProfessorMarkdown,
        confidence: 0.95, // Average confidence
        success: true
      }).catch(() => {
        // Ignore if content script not available
      });

      // Send overall completion
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'MARKDOWN_CONVERSION_ALL_COMPLETE',
        success: true
      }).catch(() => {
        // Ignore if content script not available
      });
    }

    console.log('🟢 Multiple images markdown conversion completed successfully');

  } catch (error) {
    console.error('🔴 Multiple images markdown conversion failed:', error);
    sessionManager.updateProcessingState({
      status: 'error',
      progress: 0,
      message: `Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
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
async function handleProcessGrading(sender: chrome.runtime.MessageSender) {
  console.log('🟢 Starting AI grading process');
  
  try {
    // Get current session data
    const session = sessionManager.getCurrentSession();
    
    if (!session) {
      throw new Error('No active session found. Please capture screenshots first.');
    }
    
    if (!session.studentMarkdown || !session.professorMarkdown) {
      throw new Error('Missing markdown data. Please convert images to markdown first.');
    }

    sessionManager.updateProcessingState({
      status: 'grading',
      progress: 80,
      message: 'AI is grading the student answer...'
    });

    const request: GradeAnswerRequest = {
      studentAnswer: session.studentMarkdown,
      modelAnswer: session.professorMarkdown,
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

/**
 * Handle capture completion from content script (after region selection)
 */
async function handleCaptureCompleteFromContentScript(
  imageData: string, 
  captureType: 'student' | 'professor', 
  selectionArea: any,
  sender: chrome.runtime.MessageSender
) {
  console.log('🟢 Handling capture completion from content script for:', captureType);
  console.log('🟢 Image data length:', imageData.length);
  console.log('🟢 Selection area:', selectionArea);
  
  try {
    // Store the captured image data
    await sessionManager.storeCapturedImage(captureType, imageData);
    
    // Send capture complete message to content script
    if (sender.tab?.id) {
      await chrome.tabs.sendMessage(sender.tab.id, {
        type: 'CAPTURE_COMPLETE',
        captureType: captureType,
        imageData: imageData,
        success: true
      });
    }
    
    console.log('🟢', captureType, 'capture data stored successfully');
    
    // Check if we have both images and update UI state
    const session = sessionManager.getCurrentSession();
    if (session?.studentImageData && session?.professorImageData) {
      console.log('🟢 Both images captured, ready for manual markdown conversion');
      
      // Update processing state to show both images are ready
      sessionManager.updateProcessingState({
        status: 'processing',
        progress: 30,
        message: 'Both images captured. Click "Translate to Markdown" to continue.'
      });
    }
    
  } catch (error) {
    console.error('🔴 Error handling capture completion from content script:', error);
    
    // Send error message to content script
    if (sender.tab?.id) {
      await chrome.tabs.sendMessage(sender.tab.id, {
        type: 'CAPTURE_ERROR',
        captureType: captureType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

/**
 * Handle capture cancellation from content script
 */
async function handleCaptureCancelled(captureType: 'student' | 'professor', sender: chrome.runtime.MessageSender) {
  console.log('🟢 Capture cancelled by user for:', captureType);
  
  try {
    // Update processing state
    sessionManager.updateProcessingState({
      status: 'idle',
      progress: 0,
      message: `${captureType} capture cancelled by user`
    });
    
    // Send cancellation message to content script
    if (sender.tab?.id) {
      await chrome.tabs.sendMessage(sender.tab.id, {
        type: 'CAPTURE_CANCELLED',
        captureType: captureType
      });
    }
    
    console.log('🟢 Capture cancellation handled successfully');
  } catch (error) {
    console.error('🔴 Error handling capture cancellation:', error);
  }
}
