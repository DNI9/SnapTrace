import { useState } from 'react';
import { useSession } from './context/useSession';
import { type SessionSummary, getDB } from './utils/storage';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import Header from './components/Popup/Header';
import SettingsPanel from './components/Popup/SettingsPanel';
import SessionList from './components/Popup/SessionList';
import Toast from './components/Toast';

function AppContent() {
  const {
    sessions,
    activeSessionId,
    createSession,
    activateSession,
    archiveSession,
    removeSession,
    renameSession,
  } = useSession();

  const { maxArchivedSessions, includeUrl, scaleDownImages } = useSettings();

  const [isCreating, setIsCreating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null); // 'docx' | 'pdf' | null
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [newSessionName, setNewSessionName] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionName.trim()) return;
    await createSession(newSessionName);
    setNewSessionName('');
    setIsCreating(false);
  };

  const getFullSession = async (id: string) => {
    const db = await getDB();
    return db.get('sessions', id);
  };

  const handleExportDocx = async (summary: SessionSummary) => {
    if (isExporting) return;
    setIsExporting('docx');
    try {
      const session = await getFullSession(summary.id);
      if (!session) throw new Error('Session data not found');

      const response = await chrome.runtime.sendMessage({
        type: 'EXPORT_DOCX',
        payload: { session, options: { includeUrl, scaleDownImages } },
      });
      if (!response?.success) {
        throw new Error(response?.error || 'Export failed');
      }
      showToast('Export successful!');
    } catch (err) {
      console.error('Export failed', err);
      showToast('Export failed. Check console.');
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportPdf = async (summary: SessionSummary) => {
    if (isExporting) return;
    setIsExporting('pdf');
    try {
      const session = await getFullSession(summary.id);
      if (!session) throw new Error('Session data not found');

      const response = await chrome.runtime.sendMessage({
        type: 'EXPORT_PDF',
        payload: { session, options: { includeUrl, scaleDownImages } },
      });
      if (!response?.success) {
        throw new Error(response?.error || 'Export failed');
      }
      showToast('PDF Export successful!');
    } catch (err) {
      console.error('PDF Export failed', err);
      showToast('PDF Export failed. Check console.');
    } finally {
      setIsExporting(null);
    }
  };

  const handleDelete = async (id: string) => {
    const isArchived = activeTab === 'archived';
    const msg = isArchived
      ? 'Are you sure you want to PERMANENTLY delete this session?'
      : 'Are you sure you want to archive this session?';

    if (confirm(msg)) {
      if (isArchived) {
        await removeSession(id);
      } else {
        await archiveSession(id, maxArchivedSessions);
      }
    }
  };

  return (
    <div className="w-96 h-[500px] flex flex-col bg-slate-50 font-sans text-slate-800">
      <Header
        onSettingsClick={() => setShowSettings(!showSettings)}
        showSettings={showSettings}
        onNewSessionClick={() => setIsCreating(true)}
      />

      {showSettings && <SettingsPanel />}

      {isCreating && (
        <div className="p-4 bg-white border-b border-slate-100 animate-in slide-in-from-top-2 duration-200">
          <form onSubmit={handleCreate}>
            <input
              autoFocus
              type="text"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all placeholder:text-slate-400"
              placeholder="Enter session name..."
              value={newSessionName}
              onChange={e => setNewSessionName(e.target.value)}
            />
            <div className="flex justify-end space-x-2 mt-3">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-xs font-medium text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-md hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="text-xs font-medium bg-violet-600 text-white px-3 py-1.5 rounded-md hover:bg-violet-700 shadow-sm shadow-violet-200 transition-colors"
              >
                Create Session
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex border-b border-slate-200 bg-white">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${
            activeTab === 'active' ? 'text-black' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Active
          {activeTab === 'active' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('archived')}
          className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${
            activeTab === 'archived' ? 'text-black' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Archived
          {activeTab === 'archived' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600" />
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
        <SessionList
          sessions={sessions}
          activeSessionId={activeSessionId}
          activeTab={activeTab}
          onActivate={activateSession}
          onRename={renameSession}
          onExportDocx={handleExportDocx}
          onExportPdf={handleExportPdf}
          onDelete={handleDelete}
          isExporting={!!isExporting}
          exportType={isExporting}
        />
      </div>

      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}
    </div>
  );
}

function App() {
  return (
    <SettingsProvider>
      <AppContent />
    </SettingsProvider>
  );
}

export default App;
