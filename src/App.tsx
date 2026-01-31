import { useState } from 'react';
import { useSession } from './context/useSession';
import { type Session } from './utils/storage';

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
  const [includeUrl, setIncludeUrl] = useState(() => {
    const saved = localStorage.getItem('snaptrace-include-url');
    return saved !== 'false'; // Default to true
  });

  const toggleIncludeUrl = () => {
    const newValue = !includeUrl;
    setIncludeUrl(newValue);
    localStorage.setItem('snaptrace-include-url', String(newValue));
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

  const handleExportDocx = async (e: React.MouseEvent, session: Session) => {
    e.stopPropagation();
    try {
      // Delegate to background worker to prevent browser crash
      const response = await chrome.runtime.sendMessage({
        type: 'EXPORT_DOCX',
        payload: { session, options: { includeUrl } },
      });
      if (!response?.success) {
        throw new Error(response?.error || 'Export failed');
      }
    } catch (err) {
      console.error('Export failed', err);
      alert('Export failed');
    }
  };

  const handleExportPdf = async (e: React.MouseEvent, session: Session) => {
    e.stopPropagation();
    try {
      // Delegate to background worker to prevent browser crash
      const response = await chrome.runtime.sendMessage({
        type: 'EXPORT_PDF',
        payload: { session, options: { includeUrl } },
      });
      if (!response?.success) {
        throw new Error(response?.error || 'Export failed');
      }
    } catch (err) {
      console.error('PDF Export failed', err);
      alert('PDF Export failed');
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this session?')) {
      await deleteSession(id);
    }
  };

  const startEditing = (e: React.MouseEvent, session: Session) => {
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
    <div className="w-80 h-[500px] flex flex-col bg-gray-50">
      <header className="bg-blue-600 text-white p-4 flex justify-between items-center shadow-md">
        <h1 className="font-bold text-lg">SnapTrace</h1>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1 hover:bg-white/20 rounded text-white"
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
            className="text-sm bg-white/20 hover:bg-white/30 px-2 py-1 rounded"
          >
            + New
          </button>
        </div>
      </header>

      {showSettings && (
        <div className="p-4 bg-gray-100 border-b shadow-inner">
          <h2 className="font-semibold text-gray-700 mb-2 text-sm">Settings</h2>
          <label className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={includeUrl}
              onChange={toggleIncludeUrl}
              className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
            />
            <span>Include Source URL in Exports</span>
          </label>
        </div>
      )}

      {isCreating && (
        <div className="p-4 bg-white border-b">
          <form onSubmit={handleCreate}>
            <input
              autoFocus
              type="text"
              className="w-full px-3 py-2 border rounded mb-2"
              placeholder="Session Name"
              value={newSessionName}
              onChange={e => setNewSessionName(e.target.value)}
            />
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-sm text-gray-500"
              >
                Cancel
              </button>
              <button type="submit" className="text-sm bg-blue-600 text-white px-3 py-1 rounded">
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {sessions.length === 0 ? (
          <div className="text-center text-gray-400 mt-10">
            No sessions yet.
            <br />
            Press <kbd className="font-mono bg-gray-200 px-1 rounded">Alt+S</kbd> to start.
          </div>
        ) : (
          sessions.map(session => (
            <div
              key={session.id}
              onClick={() => activateSession(session.id)}
              className={`bg-white p-3 rounded shadow-sm border-l-4 cursor-pointer transition-colors group relative ${
                session.id === activeSessionId
                  ? 'border-green-500 ring-1 ring-green-100'
                  : 'border-transparent hover:border-gray-300'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  {editingId === session.id ? (
                    <form onSubmit={e => handleRename(e, session.id)} className="flex gap-1">
                      <input
                        autoFocus
                        type="text"
                        className="flex-1 px-2 py-1 text-sm border rounded"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onClick={e => e.stopPropagation()}
                      />
                      <button
                        type="submit"
                        className="text-xs bg-blue-600 text-white px-2 py-1 rounded"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="text-xs text-gray-500 px-1"
                      >
                        ✕
                      </button>
                    </form>
                  ) : (
                    <>
                      <h3
                        className={`font-medium truncate ${session.id === activeSessionId ? 'text-green-700' : 'text-gray-900'}`}
                      >
                        {session.name}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {new Date(session.createdAt).toLocaleDateString()} • {session.items.length}{' '}
                        items
                      </p>
                    </>
                  )}
                </div>
                {session.id === activeSessionId && editingId !== session.id && (
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full absolute top-3 right-3">
                    Active
                  </span>
                )}

                {/* Actions (visible on hover) */}
                {editingId !== session.id && (
                  <div className="hidden group-hover:flex absolute bottom-2 right-2 space-x-2 bg-white/90 p-1 rounded">
                    <button
                      onClick={e => startEditing(e, session)}
                      title="Rename"
                      className="text-gray-600 hover:text-gray-800"
                    >
                      <svg
                        className="w-4 h-4"
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
                    <button
                      onClick={e => handleExportDocx(e, session)}
                      title="Export DOCX"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        ></path>
                      </svg>
                    </button>
                    <button
                      onClick={e => handleExportPdf(e, session)}
                      title="Export PDF"
                      className="text-purple-600 hover:text-purple-800"
                    >
                      <svg
                        className="w-4 h-4"
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
                    <button
                      onClick={e => handleDelete(e, session.id)}
                      title="Delete"
                      className="text-red-500 hover:text-red-700"
                    >
                      <svg
                        className="w-4 h-4"
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
