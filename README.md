# Nous-Grade Chrome Extension

AI-powered grading assistant for university professors.

## Phase 1: Foundation & Hello World Injection

This phase establishes the basic Chrome Extension scaffolding and proves content injection capability.

### Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Build the Extension**
   ```bash
   npm run build
   ```

3. **Load in Chrome**
   - Open Chrome and go to `chrome://extensions`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked" and select the `dist` folder
   - The extension should appear in your extensions list

4. **Test the Extension**
   - Click the extension icon in the toolbar
   - A popup should appear with "Inject Hello World" button
   - Click the button to inject a Hello World div on the current page
   - The div should appear in the top-right corner of the page

### Success Criteria

✅ A "Hello World" `<div>` appears on the page when the extension icon is clicked

### File Structure

```
nous-grade-extension/
├── manifest.json                 # Extension configuration
├── package.json                  # Dependencies and scripts
├── webpack.config.js            # Build configuration
├── tsconfig.json                # TypeScript configuration
├── src/
│   ├── background/
│   │   └── service-worker.ts    # Background script
│   ├── content/
│   │   ├── content-script.ts    # Content injection script
│   │   └── content-script.css   # Content script styles
│   └── popup/
│       ├── popup.html           # Popup HTML
│       └── popup.tsx            # Popup script
└── dist/                        # Built extension files
```

### Next Phase

Once Phase 1 is complete and tested, proceed to Phase 2: UI Integration & Communication.
