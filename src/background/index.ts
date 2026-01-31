import {
  createNewSession,
  getActiveSessionId,
  addEvidenceToSession,
  type Session,
} from '../utils/storage';

console.log('SnapTrace Background Service Worker Running');

// Offscreen document management
const OFFSCREEN_DOCUMENT_PATH = 'src/offscreen/offscreen.html';
let creatingOffscreen: Promise<void> | null = null;

async function hasOffscreenDocument(): Promise<boolean> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)],
  });
  return contexts.length > 0;
}

async function setupOffscreenDocument(): Promise<void> {
  if (await hasOffscreenDocument()) {
    return;
  }

  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  creatingOffscreen = chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: [chrome.offscreen.Reason.DOM_PARSER],
    justification: 'Export session data to PDF/DOCX using DOM APIs',
  });

  await creatingOffscreen;
  creatingOffscreen = null;
}

chrome.commands.onCommand.addListener(async command => {
  if (command === 'toggle-capture') {
    handleToggleCapture();
  } else if (command === 'open-popup') {
    chrome.action.openPopup();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'CREATE_SESSION') {
    handleCreateSession(message.payload.name)
      .then(() => sendResponse({ success: true }))
      .catch(err => {
        console.error('Create Session Error:', err);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }
  if (message.type === 'SAVE_EVIDENCE') {
    handleSaveEvidence(message.payload)
      .then(() => sendResponse({ success: true }))
      .catch(err => {
        console.error('Save Evidence Error:', err);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }
  if (message.type === 'EXPORT_DOCX') {
    const session: Session = message.payload.session;
    handleExport('OFFSCREEN_EXPORT_DOCX', session)
      .then(() => sendResponse({ success: true }))
      .catch(err => {
        console.error('DOCX Export Error:', err);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }
  if (message.type === 'EXPORT_PDF') {
    const session: Session = message.payload.session;
    handleExport('OFFSCREEN_EXPORT_PDF', session)
      .then(() => sendResponse({ success: true }))
      .catch(err => {
        console.error('PDF Export Error:', err);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }
});

async function handleExport(
  type: 'OFFSCREEN_EXPORT_DOCX' | 'OFFSCREEN_EXPORT_PDF',
  session: Session
): Promise<void> {
  await setupOffscreenDocument();
  const response = await chrome.runtime.sendMessage({
    type,
    payload: { session },
  });
  if (!response?.success) {
    throw new Error(response?.error || 'Export failed');
  }

  // Download the file using the data URL returned from offscreen document
  await chrome.downloads.download({
    url: response.dataUrl,
    filename: response.filename,
    saveAs: true,
  });
}

async function handleToggleCapture() {
  console.log('Toggle Capture Triggered');

  const result = await chrome.storage.local.get('activeSessionId');
  let activeId = result.activeSessionId;

  if (!activeId) {
    activeId = await getActiveSessionId();
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  if (activeId) {
    console.log('Active Session:', activeId);
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
      chrome.tabs.sendMessage(tab.id, {
        type: 'SHOW_CAPTURE_UI',
        payload: { image: dataUrl },
      });
    } catch (err) {
      console.error('Capture failed:', err);
    }
  } else {
    console.log('No active session. Open Cold Start.');
    chrome.tabs.sendMessage(tab.id, { type: 'OPEN_COLD_START' });
  }
}

async function handleCreateSession(name: string) {
  console.log('Creating Session:', name);
  const session = await createNewSession(name);
  console.log('Session Created:', session);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    const tabId = tab.id;
    setTimeout(async () => {
      try {
        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
        chrome.tabs.sendMessage(tabId, {
          type: 'SHOW_CAPTURE_UI',
          payload: { image: dataUrl },
        });
      } catch (e) {
        console.error('Auto-capture failed', e);
      }
    }, 500);
  }
}

async function handleSaveEvidence(payload: { description: string; imageUrl: string; url: string }) {
  console.log('Saving Evidence...');
  const activeId = await getActiveSessionId();
  if (!activeId) throw new Error('No active session');

  await addEvidenceToSession(activeId, {
    description: payload.description,
    imageUrl: payload.imageUrl,
    url: payload.url,
  });
  console.log('Evidence Saved to Session:', activeId);
}
