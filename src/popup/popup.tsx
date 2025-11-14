console.log('Nous Grade popup loaded');

const openButton = document.getElementById('open-ui') as HTMLButtonElement | null;
const closeButton = document.getElementById('close-ui') as HTMLButtonElement | null;
const statusLabel = document.getElementById('status') as HTMLElement | null;

const RESTRICTED_PREFIXES = ['chrome://', 'chrome-extension://', 'moz-extension://', 'edge://', 'about:'];

const updateStatus = (message: string) => {
  if (statusLabel) {
    statusLabel.textContent = message;
}
};

const getActiveTab = async (): Promise<chrome.tabs.Tab | undefined> => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
};

const isRestrictedUrl = (url?: string): boolean => {
  if (!url) {
    return false;
  }
  return RESTRICTED_PREFIXES.some((prefix) => url.startsWith(prefix));
};

const handleOpenWorkspace = async () => {
  try {
    updateStatus('Opening grading workspace…');
    const tab = await getActiveTab();
    
    if (!tab?.id) {
      updateStatus('No active tab detected.');
      return;
    }
    
    if (isRestrictedUrl(tab.url)) {
      updateStatus('This page is restricted. Open a regular website instead.');
      return;
    }
    
    await chrome.tabs.sendMessage(tab.id, { type: 'INJECT_GRADING_UI' });
    updateStatus('Workspace ready on this tab.');
  } catch (error) {
    console.error('Error injecting grading UI:', error);
    const message =
      error instanceof Error ? error.message : 'Something went wrong while opening the workspace.';
    updateStatus(message);
  }
};

const handleCloseWorkspace = async () => {
  try {
    updateStatus('Closing grading workspace…');
    const tab = await getActiveTab();

    if (!tab?.id) {
      updateStatus('No active tab detected.');
      return;
    }
    
    if (isRestrictedUrl(tab.url)) {
      updateStatus('This page is restricted. Switch back to the site you were grading.');
      return;
    }
    
    await chrome.tabs.sendMessage(tab.id, { type: 'REMOVE_GRADING_UI' });
    updateStatus('Workspace hidden. Open it again when ready.');
  } catch (error) {
    console.error('Error removing grading UI:', error);
    const message =
      error instanceof Error ? error.message : 'Something went wrong while closing the workspace.';
    updateStatus(message);
  }
};

openButton?.addEventListener('click', handleOpenWorkspace);
closeButton?.addEventListener('click', handleCloseWorkspace);
