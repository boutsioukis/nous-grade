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
    
    // Use scripting API to inject the grading UI directly
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: injectGradingUIFromPopup
    });
    
    updateStatus('Grading UI injected!');
  } catch (error) {
    console.error('Error injecting grading UI:', error);
    updateStatus('Error: Injection failed');
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
    
    // Use scripting API to remove the grading UI directly
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: removeGradingUIFromPopup
    });
    
    updateStatus('Grading UI removed!');
  } catch (error) {
    console.error('Error removing grading UI:', error);
    updateStatus('Error: Removal failed');
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
    
    <div style="margin-bottom: 24px;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
        <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; border: 2px solid #e9ecef;">
          <h3 style="margin: 0 0 16px 0; color: #495057; font-size: 16px; font-weight: 600;">Student Answer</h3>
          <div style="min-height: 200px; display: flex; align-items: center; justify-content: center;">
            <button id="capture-student" style="background: #4CAF50; color: white; border: none; border-radius: 8px; padding: 16px 24px; font-size: 14px; font-weight: 600; cursor: pointer;">
              + Capture Student Answer
            </button>
          </div>
        </div>
        
        <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; border: 2px solid #e9ecef;">
          <h3 style="margin: 0 0 16px 0; color: #495057; font-size: 16px; font-weight: 600;">Professor Answer</h3>
          <div style="min-height: 200px; display: flex; align-items: center; justify-content: center;">
            <button id="capture-professor" style="background: #4CAF50; color: white; border: none; border-radius: 8px; padding: 16px 24px; font-size: 14px; font-weight: 600; cursor: pointer;">
              + Capture Professor Answer
            </button>
          </div>
        </div>
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
  
  // Add event listeners
  document.getElementById('close-grading-ui')?.addEventListener('click', () => {
    overlay.remove();
  });
  
  document.getElementById('capture-student')?.addEventListener('click', () => {
    const button = document.getElementById('capture-student');
    const status = document.getElementById('student-status');
    if (button && status) {
      button.textContent = '✓ Captured';
      button.style.background = '#45a049';
      status.style.background = '#4CAF50';
      status.style.boxShadow = '0 0 8px rgba(76, 175, 80, 0.5)';
    }
  });
  
  document.getElementById('capture-professor')?.addEventListener('click', () => {
    const button = document.getElementById('capture-professor');
    const status = document.getElementById('professor-status');
    if (button && status) {
      button.textContent = '✓ Captured';
      button.style.background = '#45a049';
      status.style.background = '#4CAF50';
      status.style.boxShadow = '0 0 8px rgba(76, 175, 80, 0.5)';
    }
  });
  
  document.getElementById('start-grading')?.addEventListener('click', () => {
    const button = document.getElementById('start-grading') as HTMLButtonElement;
    if (button) {
      button.textContent = 'Processing...';
      button.style.background = '#ccc';
      button.disabled = true;
      
      // Simulate grading process
      setTimeout(() => {
        button.textContent = 'Grading Complete!';
        button.style.background = '#4CAF50';
      }, 2000);
    }
  });
  
  console.log('Grading UI injected successfully');
}

// Function to remove grading UI (to be executed in page context)
function removeGradingUIFromPopup() {
  const existingUI = document.getElementById('nous-grade-grading-ui');
  if (existingUI) {
    existingUI.remove();
    console.log('Grading UI removed successfully');
  }
}
