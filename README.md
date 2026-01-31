# SnapTrace

> A high-velocity evidence collector for manual QA testing.

SnapTrace is a Chrome/Edge Browser Extension designed to streamline the workflow of manual QA testers. It allows you to capture, annotate, and organize screenshots into distinct "Sessions" using primarily keyboard shortcuts, minimizing context switching and speeding up the documentation process.

## 🚀 Features

- **Keyboard-First Workflow**: Control almost everything without touching the mouse.
- **Session Management**: Organize evidence into distinct sessions (e.g., "Login Tests", "Checkout v2").
- **Rapid Capture**: Instantly capture screenshots with `Alt+S`.
- **Built-in Annotation**: Annotate screenshots with rectangles, arrows, and text.
- **Export to DOCX/PDF**: Generate professional reports with a single click.
- **Persistent Storage**: Uses IndexedDB to store large amounts of evidence without the 5MB localStorage limit.

## 🛠️ Installation (Development)

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/yourusername/snaptrace.git
    cd snaptrace
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Build the extension:**

    ```bash
    npm run build
    ```

    Or run in watch mode for development:

    ```bash
    npm run dev
    ```

4.  **Load into Chrome/Edge:**
    - Open `chrome://extensions/`
    - Enable **Developer mode** (top right toggle).
    - Click **Load unpacked**.
    - Select the `dist` folder in your project directory.

## 📖 Usage Guide

### Shortcuts

| Action                             | Shortcut     | Context          |
| :--------------------------------- | :----------- | :--------------- |
| **Start Capture / Create Session** | `Alt+S`      | Global (Browser) |
| **Open Popup / Manage Sessions**   | `Alt+P`      | Global (Browser) |
| **Save Notification**              | `Ctrl+Enter` | Annotation Modal |
| **Cancel Capture**                 | `Esc`        | Annotation Modal |
| **Viewport Snap**                  | `Enter`      | Capture Mode     |

### Workflows

#### 1. Cold Start (New Session)

- Press `Alt+S` when no session is active.
- Enter a name for the new session (e.g., "Smoke Test").
- Press `Enter` to start capturing immediately.

#### 2. Rapid Capture

- Press `Alt+S` during an active session.
- Drag to select an area OR press `Enter` to capture the visible viewport.
- The Annotation Modal appears.
- Add annotations if needed.
- Type a description and press `Ctrl+Enter` to save.

#### 3. Exporting Evidence

- Click the extension icon or press `Alt+P`.
- Click **Export** on the desired session.
- Choose **DOCX** or **PDF** format.

## 💻 Tech Stack

- **Core**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Storage**: IndexedDB (idb)
- **Canvas**: Fabric.js
- **Export**: docx, jspdf

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
