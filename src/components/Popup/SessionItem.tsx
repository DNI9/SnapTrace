import React, { useState } from 'react';
import type { SessionSummary } from '../../utils/storage';

interface SessionItemProps {
  session: SessionSummary;
  isActive: boolean;
  onActivate: (id: string) => void;
  onRename: (id: string, newName: string) => Promise<void>;
  onExportDocx: (summary: SessionSummary) => Promise<void>;
  onExportPdf: (summary: SessionSummary) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isExporting: boolean;
  exportType: string | null;
  activeTab: 'active' | 'archived';
}

const SessionItem: React.FC<SessionItemProps> = ({
  session,
  isActive,
  onActivate,
  onRename,
  onExportDocx,
  onExportPdf,
  onDelete,
  isExporting,
  exportType,
  activeTab,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(session.name);

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditName(session.name);
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    await onRename(session.id, editName);
    setIsEditing(false);
  };

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
    setEditName(session.name);
  };

  return (
    <div
      onClick={() => onActivate(session.id)}
      className={`group relative p-4 rounded-xl border transition-all duration-200 cursor-pointer mb-3 ${
        isActive
          ? 'bg-white border-violet-400 shadow-md shadow-violet-100 ring-1 ring-violet-400'
          : 'bg-white border-violet-200 hover:border-violet-300 hover:shadow-md'
      }`}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0 pr-6">
          {isEditing ? (
            <form onSubmit={handleRenameSubmit} className="flex items-center gap-2">
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
                <h3 className="font-bold text-base truncate text-indigo-900">{session.name}</h3>
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-slate-300'}`}
                ></span>
              </div>
              <p className="text-xs text-slate-500">
                {session.itemCount} items
                <span className="mx-1.5 opacity-50">|</span>
                <span>
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
        {!isEditing && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur pl-2 rounded-l-lg shadow-sm border border-slate-100 py-1">
            <button
              onClick={startEditing}
              title="Rename"
              aria-label="Rename Session"
              className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-md transition-colors"
              disabled={isExporting}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              onClick={() => onExportDocx(session)}
              title={isExporting && exportType === 'docx' ? 'Exporting...' : 'Export DOCX'}
              aria-label="Export DOCX"
              disabled={isExporting}
              className={`p-1.5 rounded-md transition-colors ${
                isExporting && exportType === 'docx'
                  ? 'text-blue-600 animate-pulse bg-blue-50'
                  : 'text-blue-400 hover:text-blue-600 hover:bg-blue-50'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                ></path>
              </svg>
            </button>
            <button
              onClick={() => onExportPdf(session)}
              title={isExporting && exportType === 'pdf' ? 'Exporting...' : 'Export PDF'}
              aria-label="Export PDF"
              disabled={isExporting}
              className={`p-1.5 rounded-md transition-colors ${
                isExporting && exportType === 'pdf'
                  ? 'text-rose-600 animate-pulse bg-rose-50'
                  : 'text-rose-400 hover:text-rose-600 hover:bg-rose-50'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              onClick={() => onDelete(session.id)}
              title={activeTab === 'active' ? 'Archive' : 'Delete Permanently'}
              aria-label={activeTab === 'active' ? 'Archive Session' : 'Delete Session Permanently'}
              disabled={isExporting}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  );
};

export default SessionItem;
