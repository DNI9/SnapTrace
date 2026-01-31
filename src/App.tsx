import { useState } from 'react';
import { useSession } from './context/useSession';
import { exportSessionToDocx } from './utils/export';
import { type Session } from './utils/storage';

function App() {
  const { sessions, activeSessionId, createSession, activateSession, deleteSession } = useSession();
  const [isCreating, setIsCreating] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionName.trim()) return;
    await createSession(newSessionName);
    setNewSessionName('');
    setIsCreating(false);
  };

  const handleExport = async (e: React.MouseEvent, session: Session) => {
    e.stopPropagation();
    try {
      await exportSessionToDocx(session);
    } catch (err) {
      console.error('Export failed', err);
      alert('Export failed');
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this session?')) {
      await deleteSession(id);
    }
  };

  return (
    <div className="w-80 h-[500px] flex flex-col bg-gray-50">
      <header className="bg-blue-600 text-white p-4 flex justify-between items-center shadow-md">
        <h1 className="font-bold text-lg">SnapTrace</h1>
        <button
          onClick={() => setIsCreating(true)}
          className="text-sm bg-white/20 hover:bg-white/30 px-2 py-1 rounded"
        >
          + New
        </button>
      </header>

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
                  <h3
                    className={`font-medium truncate ${session.id === activeSessionId ? 'text-green-700' : 'text-gray-900'}`}
                  >
                    {session.name}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {new Date(session.createdAt).toLocaleDateString()} • {session.items.length}{' '}
                    items
                  </p>
                </div>
                {session.id === activeSessionId && (
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full absolute top-3 right-3">
                    Active
                  </span>
                )}

                {/* Actions (visible on hover) */}
                <div className="hidden group-hover:flex absolute bottom-2 right-2 space-x-2 bg-white/90 p-1 rounded">
                  <button
                    onClick={e => handleExport(e, session)}
                    title="Export DOCX"
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      ></path>
                    </svg>
                  </button>
                  <button
                    onClick={e => handleDelete(e, session.id)}
                    title="Delete"
                    className="text-red-500 hover:text-red-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      ></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default App;
