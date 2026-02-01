import React from 'react';
import type { SessionSummary } from '../../utils/storage';
import SessionItem from './SessionItem';

interface SessionListProps {
  sessions: SessionSummary[];
  activeSessionId: string | null;
  activeTab: 'active' | 'archived';
  onActivate: (id: string) => void;
  onRename: (id: string, newName: string) => Promise<void>;
  onExportDocx: (summary: SessionSummary) => Promise<void>;
  onExportPdf: (summary: SessionSummary) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isExporting: boolean;
  exportType: string | null;
}

const SessionList: React.FC<SessionListProps> = ({
  sessions,
  activeSessionId,
  activeTab,
  onActivate,
  onRename,
  onExportDocx,
  onExportPdf,
  onDelete,
  isExporting,
  exportType,
}) => {
  const filteredSessions = sessions.filter(s =>
    activeTab === 'active' ? !s.archived : s.archived
  );

  if (filteredSessions.length === 0) {
    return (
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
        <p className="font-medium text-slate-600">
          {activeTab === 'active' ? 'No active sessions' : 'No archived sessions'}
        </p>
        <p className="text-sm mt-1">
          Press{' '}
          <kbd className="font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600 text-xs shadow-sm">
            Alt+S
          </kbd>{' '}
          to start capturing
        </p>
      </div>
    );
  }

  return (
    <>
      {filteredSessions.map(session => (
        <SessionItem
          key={session.id}
          session={session}
          isActive={session.id === activeSessionId}
          onActivate={onActivate}
          onRename={onRename}
          onExportDocx={onExportDocx}
          onExportPdf={onExportPdf}
          onDelete={onDelete}
          isExporting={isExporting}
          exportType={exportType}
          activeTab={activeTab}
        />
      ))}
    </>
  );
};

export default SessionList;
