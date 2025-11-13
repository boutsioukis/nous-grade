# Nous-Grade Chrome Extension

AI-powered grading assistant for university professors with real-time screen capture capabilities.

## 🎯 Features

- **Professional Grading Interface** - Clean, modern UI designed for university professors
- **Real Screen Capture** - Capture student and professor answers from any website
- **Interactive Selection** - Drag-to-select interface for precise area capture
- **AI Integration Ready** - Built for Phase 4 backend integration
- **Chrome Extension** - Works on any website (except Chrome internal pages)

## 🚀 Quick Start

### 1. Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd nous-grade

# Install dependencies
npm install

# Build the extension
npm run build
```

### 2. Load in Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **"Developer mode"** (toggle in top right)
3. Click **"Load unpacked"** and select the `dist` folder
4. The extension should appear in your extensions list

### 3. Usage

1. **Navigate to a website** (e.g., Google, any educational platform)
   - ⚠️ **Important**: Cannot work on Chrome internal pages (`chrome://`)
   
2. **Click the extension icon** in the toolbar

3. **Click "Open Grading UI"** to launch the grading interface

4. **Capture Screenshots**:
   - Click **"+ Capture Student Answer"** → Select screen/window → Draw selection box
   - Click **"+ Capture Professor Answer"** → Select screen/window → Draw selection box

5. **Start Grading** (currently simulated, ready for Phase 4 backend)

## 🔧 Current Status: Phase 3 Complete

### ✅ Completed Features
- **Phase 1**: Basic extension scaffolding and content injection
- **Phase 2**: React UI integration and message passing
- **Phase 3**: Real screen capture with Desktop Capture API

### 🚧 Next Phase
- **Phase 4**: Backend integration for AI-powered grading

## 📁 Project Structure

```
nous-grade-extension/
├── manifest.json                    # Extension configuration
├── package.json                     # Dependencies and scripts
├── webpack.config.js               # Build configuration
├── src/
│   ├── background/
│   │   └── service-worker.ts       # Background script & Desktop Capture API
│   ├── content/
│   │   ├── content-script.ts       # Content injection script
│   │   └── content-script.css      # Content script styles
│   ├── popup/
│   │   ├── popup.html              # Popup HTML
│   │   └── popup.tsx               # Popup script with error handling
│   ├── offscreen/
│   │   ├── offscreen-document.ts   # Screen capture processing
│   │   └── offscreen-document.html # Offscreen document HTML
│   ├── components/
│   │   ├── GradingOverlay.tsx      # Main React grading component
│   │   └── GradingOverlay.css      # Professional styling
│   ├── utils/
│   │   └── image-processing.ts     # Canvas cropping utilities
│   └── types/
│       ├── messages.ts             # Message passing types
│       └── capture.ts              # Screen capture types
└── dist/                           # Built extension files
```

## 🛠️ Development

### Build Commands

```bash
npm run build      # Production build
npm run dev        # Development build with watch mode
npm run clean      # Clean dist folder
```

### Testing

1. **Basic Functionality**:
   - Extension loads without errors
   - Popup opens and displays correctly
   - UI injection works on regular websites

2. **Screen Capture**:
   - Desktop media selection dialog appears
   - Interactive selection overlay works
   - Image capture completes successfully
   - Base64 image data logged in Service Worker console

### Debugging

- **Service Worker Console**: `chrome://extensions` → Extension details → "Inspect views: service worker"
- **Content Scripts**: Browser DevTools → Console tab
- **Offscreen Documents**: `chrome://extensions` → Extension details → "Inspect views: offscreen document"

## ⚠️ Known Limitations

1. **Chrome Internal Pages**: Cannot inject on `chrome://`, `chrome-extension://`, or `about:` pages
2. **HTTPS Sites**: Some sites may have additional security restrictions
3. **Cross-Origin**: Limited by browser security policies

## 🔍 Troubleshooting

### "Cannot access a chrome:// URL" Error
- **Solution**: Navigate to a regular website (e.g., google.com, github.com)
- **Why**: Chrome extensions cannot inject scripts into browser internal pages

### "Injection failed" Error
- **Solution**: Refresh the page and try again
- **Check**: Ensure you're on a regular website, not a restricted page

### Screen Capture Not Working
- **Check**: Extension has `desktopCapture` permission in manifest
- **Verify**: User granted screen sharing permission
- **Debug**: Check Service Worker console for error messages

## 🤝 Contributing

This extension is built following Chrome Extension Manifest V3 best practices with TypeScript and React for maintainable, scalable code.
