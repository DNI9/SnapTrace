import { useState } from 'react';
import { useSession } from './context/useSession';
import { type SessionSummary, getDB } from './utils/storage';

function App() {
  const {
    sessions,
    activeSessionId,
    createSession,
    activateSession,
    deleteSession,
    renameSession,
  } = useSession();
  const [isCreating, setIsCreating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null); // 'docx' | 'pdf' | null
  const [includeUrl, setIncludeUrl] = useState(() => {
    const saved = localStorage.getItem('snaptrace-include-url');
    return saved !== 'false'; // Default to true
  });
  const [scaleDownImages, setScaleDownImages] = useState(() => {
    const saved = localStorage.getItem('snaptrace-scale-down-images');
    return saved === 'true'; // Default to false
  });

  const toggleIncludeUrl = () => {
    const newValue = !includeUrl;
    setIncludeUrl(newValue);
    localStorage.setItem('snaptrace-include-url', String(newValue));
  };

  const toggleScaleDownImages = () => {
    const newValue = !scaleDownImages;
    setScaleDownImages(newValue);
    localStorage.setItem('snaptrace-scale-down-images', String(newValue));
  };

  const [newSessionName, setNewSessionName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

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

  const handleExportDocx = async (e: React.MouseEvent, summary: SessionSummary) => {
    e.stopPropagation();
    if (isExporting) return;
    setIsExporting('docx');
    try {
      const session = await getFullSession(summary.id);
      if (!session) throw new Error('Session data not found');

      // Delegate to background worker to prevent browser crash
      const response = await chrome.runtime.sendMessage({
        type: 'EXPORT_DOCX',
        payload: { session, options: { includeUrl, scaleDownImages } },
      });
      if (!response?.success) {
        throw new Error(response?.error || 'Export failed');
      }
    } catch (err) {
      console.error('Export failed', err);
      alert('Export failed');
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportPdf = async (e: React.MouseEvent, summary: SessionSummary) => {
    e.stopPropagation();
    if (isExporting) return;
    setIsExporting('pdf');
    try {
      const session = await getFullSession(summary.id);
      if (!session) throw new Error('Session data not found');

      // Delegate to background worker to prevent browser crash
      const response = await chrome.runtime.sendMessage({
        type: 'EXPORT_PDF',
        payload: { session, options: { includeUrl, scaleDownImages } },
      });
      if (!response?.success) {
        throw new Error(response?.error || 'Export failed');
      }
    } catch (err) {
      console.error('PDF Export failed', err);
      alert('PDF Export failed');
    } finally {
      setIsExporting(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this session?')) {
      await deleteSession(id);
    }
  };

  const startEditing = (e: React.MouseEvent, session: SessionSummary) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditName(session.name);
  };

  const handleRename = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    if (!editName.trim()) return;
    await renameSession(id, editName);
    setEditingId(null);
    setEditName('');
  };

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
    setEditName('');
  };

  return (
    <div className="w-96 h-[500px] flex flex-col bg-slate-50 font-sans text-slate-800">
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-10 p-4 flex justify-between items-center border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-2">
          <h1 className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-violet-700 to-fuchsia-600">
            SnapTrace
          </h1>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-all duration-200 ${
              showSettings
                ? 'bg-violet-100 text-violet-700'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
            title="Settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors shadow-sm hover:shadow active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span>New</span>
          </button>
        </div>
      </header>

      {showSettings && (
        <div className="px-4 py-3 bg-white border-b border-slate-100 shadow-inner animate-in slide-in-from-top-2 duration-200 space-y-3">
          <label className="flex items-center space-x-3 text-sm text-slate-600 cursor-pointer select-none group">
            <div className="relative flex items-center">
              <input
                type="checkbox"
                checked={includeUrl}
                onChange={toggleIncludeUrl}
                className="peer h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500/30 transition-all cursor-pointer"
              />
            </div>
            <span className="group-hover:text-slate-900 transition-colors">
              Include Source URL in Exports
            </span>
          </label>
          <label className="flex items-center space-x-3 text-sm text-slate-600 cursor-pointer select-none group">
            <div className="relative flex items-center">
              <input
                type="checkbox"
                checked={scaleDownImages}
                onChange={toggleScaleDownImages}
                className="peer h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500/30 transition-all cursor-pointer"
              />
            </div>
            <span className="group-hover:text-slate-900 transition-colors">
              Scale Down Images for Smaller File Size
            </span>
          </label>
        </div>
      )}

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

      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center h-64 text-slate-400">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-300">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <p className="font-medium text-slate-600">No sessions yet</p>
            <p className="text-sm mt-1">
              Press{' '}
              <kbd className="font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600 text-xs shadow-sm">
                Alt+S
              </kbd>{' '}
              to start capturing
            </p>
          </div>
        ) : (
          sessions.map(session => (
            <div
              key={session.id}
              onClick={() => activateSession(session.id)}
              className={`group relative p-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                session.id === activeSessionId
                  ? 'bg-white border-violet-500 ring-2 ring-violet-500/10 shadow-md shadow-violet-100'
                  : 'bg-white border-slate-100 hover:border-violet-200 hover:shadow-md hover:-translate-y-0.5'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0 pr-6">
                  {editingId === session.id ? (
                    <form
                      onSubmit={e => handleRename(e, session.id)}
                      className="flex items-center gap-2"
                    >
                      <input
                        autoFocus
                        type="text"
                        className="flex-1 px-2 py-1 text-sm bg-slate-50 border border-violet-300 rounded focus:outline-none focus:ring-2 focus:ring-violet-200"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onClick={e => e.stopPropagation()}
                      />
                      <button
                        type="submit"
                        className="text-xs bg-violet-600 text-white px-2 py-1 rounded hover:bg-violet-700"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="text-xs text-slate-400 hover:text-slate-600 p-1"
                      >
                        ✕
                      </button>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <h3
                          className={`font-semibold text-sm truncate ${session.id === activeSessionId ? 'text-violet-900' : 'text-slate-700 group-hover:text-violet-700'}`}
                        >
                          {session.name}
                        </h3>
                        {session.id === activeSessionId && (
                          <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-medium">
                        {session.itemCount} items
                        <span className="mx-1.5 opacity-50">|</span>
                        <span className="font-normal opacity-75">
                          {new Date(session.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </p>
                    </>
                  )}
                </div>

                {/* Actions (Floating on hover) */}
                {editingId !== session.id && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur pl-2 rounded-l-lg shadow-sm border border-slate-100 py-1">
                    <button
                      onClick={e => startEditing(e, session)}
                      title="Rename"
                      className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-md transition-colors"
                      disabled={!!isExporting}
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        ></path>
                      </svg>
                    </button>
                    <div className="w-px h-3 bg-slate-200 mx-0.5"></div>
                    <button
                      onClick={e => handleExportDocx(e, session)}
                      title={isExporting === 'docx' ? 'Exporting...' : 'Export DOCX'}
                      disabled={!!isExporting}
                      className={`p-1.5 rounded-md transition-colors ${isExporting === 'docx' ? 'text-blue-600 animate-pulse bg-blue-50' : 'text-blue-400 hover:text-blue-600 hover:bg-blue-50'}`}
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        ></path>
                      </svg>
                    </button>
                    <button
                      onClick={e => handleExportPdf(e, session)}
                      title={isExporting === 'pdf' ? 'Exporting...' : 'Export PDF'}
                      disabled={!!isExporting}
                      className={`p-1.5 rounded-md transition-colors ${isExporting === 'pdf' ? 'text-rose-600 animate-pulse bg-rose-50' : 'text-rose-400 hover:text-rose-600 hover:bg-rose-50'}`}
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                        ></path>
                      </svg>
                    </button>
                    <div className="w-px h-3 bg-slate-200 mx-0.5"></div>
                    <button
                      onClick={e => handleDelete(e, session.id)}
                      title="Delete"
                      disabled={!!isExporting}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        ></path>
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default App;
