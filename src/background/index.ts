import { createNewSession, getActiveSessionId, addEvidenceToSession } from '../utils/storage';

console.log('SnapTrace Background Service Worker Running');

chrome.commands.onCommand.addListener(async command => {
  if (command === 'toggle-capture') {
    handleToggleCapture();
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
    return true; // async response
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
});

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
    // Capture the visible tab
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

  // After creation, immediately trigger capture mode?
  // PRD 4.1. "System Action: 3. Immediately transitions to Capture Mode ... Do not make the user press the shortcut again."

  // So we should send START_CAPTURE message to the tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    const tabId = tab.id;
    // Send capture command again to trigger the flow above
    // But we can't easily call handleToggleCapture from here with correct context if we need windowId from tab query again
    // Easier to just call captureVisibleTab here too or refactor.

    // Let's refactor capture logic? Or just duplicate for now to be safe.
    // Actually, if we just set activeSessionId, the user can press Alt+S.
    // But PRD says "Immediately transitions".

    // We need to wait for storage to sync?
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
