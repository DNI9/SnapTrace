# Product Requirement Document (PRD): SnapTrace Extension

## 1. Executive Summary

**Product Name:** SnapTrace
**Type:** Chrome/Edge Browser Extension
**Goal:** A high-velocity evidence collector for manual QA testing. It allows testers to capture, annotate, and organize screenshots into distinct "Sessions" using primarily keyboard shortcuts, with minimal context switching.
**Core Philosophy:** "Keyboard First." Users should rarely need to touch the mouse to manage the workflow.

## 2. Technical Stack

* **Core:** React (Vite), TypeScript, Manifest V3.
* **Styling:** Tailwind CSS (for rapid UI development).
* **Storage:** `IndexedDB` (via `idb-keyval` or `Dexie.js`) is **mandatory** to handle multiple sessions of image data without hitting the 5MB `localStorage` limit.
* **Annotation:** `Fabric.js` or HTML5 Canvas API.
* **Export:** `docx` (for Word), `jspdf` (for PDF).

## 3. Data Architecture

The application must support multiple, distinct containers of evidence called "Sessions."

**3.1. Data Models**

```typescript
// The fundamental unit of evidence
interface EvidenceItem {
  id: string;          // UUID
  timestamp: number;
  imageUrl: string;    // Base64 or Blob URL
  description: string; // User's annotation text
  url: string;         // The webpage URL
}

// The container for a testing run
interface Session {
  id: string;          // UUID
  name: string;        // e.g., "Login Module Tests"
  createdAt: number;
  items: EvidenceItem[];
}

// Global State
interface AppState {
  sessions: Session[];
  activeSessionId: string | null; // Pointer to the currently recording session
}

```

## 4. Key Workflows (The "Happy Paths")

### 4.1. The "Cold Start" Flow (No Active Session)

* **Trigger:** User presses `Alt+S`.
* **System Check:** Detects `activeSessionId` is `null`.
* **UI Action:** Opens a small, centered modal.
* **Focus:** Cursor immediately placed in "Session Name" input.
* **Placeholder:** "Enter Session Name (e.g., Checkout v2)..."


* **User Action:** Types name -> Presses `Enter`.
* **System Action:**
1. Creates new Session.
2. Sets it as `activeSessionId`.
3. **Immediately** transitions to **Capture Mode** (Crosshair/Area Select). *Do not make the user press the shortcut again.*



### 4.2. The "Rapid Capture" Flow (Active Session Exists)

* **Trigger:** User presses `Alt+S`.
* **System Check:** Detects valid `activeSessionId`.
* **UI Action:** Freezes screen, shows Crosshair cursor.
* **User Action:** Selects area (Mouse drag) OR presses `Enter` (for Viewport capture).
* **UI Action:** Opens **Annotation Modal**.
* **Focus:** Cursor immediately in "Description" input.
* **Image:** displayed in background.


* **User Action:** Types description (e.g., "Validation Error 404").
* **User Action (Save):** Presses `Ctrl+Enter`.
* **System Action:** Saves `EvidenceItem` to the current Session array, closes modal, shows brief "Saved" toast.

### 4.3. Session Management (Popup UI)

When the user clicks the Extension Icon (or keyboard shortcut `Alt+P` to open popup):

* **View:** Displays a list of all Sessions.
* **Indicators:** Highlights the currently **Active** session.
* **Actions per Session:**
* `Activate`: Switch recording to this session.
* `Export`: Download DOCX/PDF for this specific session.
* `Delete`: Remove session.
* `Edit`: Rename session.



## 5. Detailed Functional Requirements

### 5.1. Keyboard Shortcuts & Accessibility

| Action | Shortcut | Context | Behavior |
| --- | --- | --- | --- |
| **Start Capture** | `Alt+S` | Global | Checks session state -> Starts capture. |
| **Save Item** | `Ctrl+Enter` | Annotation Modal | Commits data to storage. |
| **Discard** | `Esc` | Annotation Modal | Cancels current capture. |
| **Viewport Snap** | `Enter` | Capture Mode | Captures visible screen without dragging. |

### 5.2. Annotation Modal Specs

* **Layout:**
* Top: Toolbar (hidden by default, accessible via `Tab`).
* Center: The captured screenshot (Canvas).
* Bottom: Large, auto-focused text input for "Description".


* **Default Tool:** "Pointer" (for selection).
* **Auto-persistence:** The chosen tool (e.g., "Red Rectangle") should persist between captures. If I used a red box last time, the red box tool is active next time.

### 5.3. Export Logic

* **Input:** A single `Session` object.
* **Process:**
1. Generate Document Title: `Session.name` + Date.
2. Iterate through `Session.items`.
3. Format:
* **Heading:** Item Description (Bold, Size 14).
* **Sub-heading:** URL + Timestamp (Grey, Size 10).
* **Image:** Fit to page width, maintain aspect ratio.




* **Output:** Trigger browser download.

## 6. Edge Cases & Error Handling

1. **Quota Exceeded:** If `IndexedDB` is full (rare), show an alert suggesting export & delete of old sessions.
2. **Session Deletion:** If the `activeSessionId` is deleted, set `activeSessionId` to `null`.
3. **Tab Change:** If user switches tabs, the `activeSessionId` remains the same (Session is global, not per-tab).
