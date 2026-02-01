import React, { createContext, useContext, useState, type ReactNode } from 'react';
import { STORAGE_KEYS, DEFAULTS } from '../utils/constants';

interface SettingsContextType {
  includeUrl: boolean;
  scaleDownImages: boolean;
  maxArchivedSessions: number;
  toggleIncludeUrl: () => void;
  toggleScaleDownImages: () => void;
  setMaxArchivedSessions: (val: number) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [includeUrl, setIncludeUrl] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.INCLUDE_URL);
    return saved !== 'false';
  });

  const [scaleDownImages, setScaleDownImages] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SCALE_DOWN_IMAGES);
    return saved === 'true';
  });

  const [maxArchivedSessions, setMaxArchivedSessionsVal] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.MAX_ARCHIVED_SESSIONS);
    return saved ? parseInt(saved, 10) : DEFAULTS.MAX_ARCHIVED_SESSIONS;
  });

  const toggleIncludeUrl = () => {
    setIncludeUrl(prev => {
      const newVal = !prev;
      localStorage.setItem(STORAGE_KEYS.INCLUDE_URL, String(newVal));
      return newVal;
    });
  };

  const toggleScaleDownImages = () => {
    setScaleDownImages(prev => {
      const newVal = !prev;
      localStorage.setItem(STORAGE_KEYS.SCALE_DOWN_IMAGES, String(newVal));
      return newVal;
    });
  };

  const setMaxArchivedSessions = (val: number) => {
    if (val < 0) return;
    setMaxArchivedSessionsVal(val);
    localStorage.setItem(STORAGE_KEYS.MAX_ARCHIVED_SESSIONS, String(val));
  };

  return (
    <SettingsContext.Provider
      value={{
        includeUrl,
        scaleDownImages,
        maxArchivedSessions,
        toggleIncludeUrl,
        toggleScaleDownImages,
        setMaxArchivedSessions,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
