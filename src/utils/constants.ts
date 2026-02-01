export const STORAGE_KEYS = {
  INCLUDE_URL: 'snaptrace-include-url',
  SCALE_DOWN_IMAGES: 'snaptrace-scale-down-images',
  MAX_ARCHIVED_SESSIONS: 'snaptrace-max-archived',
  ANNOTATION_TOOL: 'snaptrace-annotation-tool',
} as const;

export const DEFAULTS = {
  INCLUDE_URL: true,
  SCALE_DOWN_IMAGES: false,
  MAX_ARCHIVED_SESSIONS: 10,
  ANNOTATION_TOOL: 'none',
} as const;

export const EVENTS = {
  SAVE_EVIDENCE: 'SAVE_EVIDENCE',
  EXPORT_DOCX: 'EXPORT_DOCX',
  EXPORT_PDF: 'EXPORT_PDF',
  CREATE_SESSION: 'CREATE_SESSION',
  SHOW_CAPTURE_UI: 'SHOW_CAPTURE_UI',
  OPEN_COLD_START: 'OPEN_COLD_START',
} as const;
