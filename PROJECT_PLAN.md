# Nous-Grade Chrome Extension Development Plan

## Project Overview

**Project Name:** Nous-Grade Tool (Open-Nous Grading Tool)  
**Type:** Google Chrome Extension (Manifest V3)  
**Target Users:** University Professors  
**Purpose:** AI-powered grading assistant for student work from any online platform

---

## Project Vision

The "open-nous grading tool" is an AI-powered assistant designed to help university professors grade student work efficiently. The tool integrates seamlessly into the professor's workflow by providing a screen overlay UI that allows them to:

1. **Capture student answers** via screenshot from any online platform
2. **Capture model answers** with grading schemes via screenshot
3. **Process images** through AI to convert them to markdown
4. **Edit and approve** both student and model answers
5. **Generate graded results** with point allocation and reasoning

### Core User Requirements

- **Clean UI** designed for university professors
- **Screen broadcasting** capability with integrated tools overlay
- **Screenshot capture** for student answers (bottom left) and professor answers (bottom right)
- **Markdown conversion** from captured images
- **Editable markdown** for both student and model answers
- **AI-powered grading** with point allocation and reasoning

---

## Critical Architectural Decision

**Why Chrome Extension?**  
The initial web application approach is not feasible due to browser security restrictions. Web pages cannot:
- Create persistent overlay UIs
- Reliably capture screen regions from other websites
- Access desktop capture APIs

**Solution:** Build as a Google Chrome Extension using Manifest V3

---

## Development Phases & Testing Checkpoints

### Phase 1: Foundation & "Hello World" Injection
**Goal:** Create basic Chrome Extension scaffolding and prove content injection capability

#### Tasks:
1. **Create `manifest.json`** with basic extension configuration
2. **Set up build pipeline** for TypeScript/React compilation
3. **Create Service Worker** to handle toolbar icon clicks
4. **Create Content Script** to inject basic HTML onto pages

#### Key Files to Create:
- `manifest.json` - Extension configuration
- `src/background/service-worker.ts` - Background script
- `src/content/content-script.ts` - Content injection script
- `webpack.config.js` or `vite.config.js` - Build configuration
- `package.json` - Dependencies and scripts

#### Required Permissions (Initial):
```json
{
  "permissions": ["activeTab", "scripting"],
  "host_permissions": ["<all_urls>"]
}
```

#### Resources:
- [Service Workers](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers)
- [Content Scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)

#### 🛑 **TEST CHECKPOINT #1** 🛑
**Goal:** Verify basic extension setup  
**Procedure:** 
1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the extension directory
4. Click the extension icon on any webpage

**Success Criteria:** A "Hello World" `<div>` appears on the page

---

### Phase 2: UI Integration & Communication
**Goal:** Replace basic HTML with React UI and establish message passing

#### Tasks:
1. **Modify Content Script** to inject and render React component
2. **Create React UI Components** for the grading interface
3. **Establish Message Passing** between Content Script and Service Worker
4. **Implement basic UI interactions** (buttons, overlays)

#### Key Components to Build:
- `src/components/GradingOverlay.tsx` - Main overlay component
- `src/components/StudentAnswerCapture.tsx` - Student answer capture UI
- `src/components/ProfessorAnswerCapture.tsx` - Professor answer capture UI
- `src/components/MarkdownEditor.tsx` - Markdown editing interface
- `src/components/GradingResults.tsx` - Results display

#### Message Types:
```typescript
interface MessageTypes {
  'START_CAPTURE': { type: 'student' | 'professor' };
  'CAPTURE_COMPLETE': { type: 'student' | 'professor', imageData: string };
  'START_GRADING': { studentMarkdown: string, professorMarkdown: string };
  'GRADING_COMPLETE': { result: GradingResult };
}
```

#### Resources:
- [Scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting)
- [Message Passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)

#### 🛑 **TEST CHECKPOINT #2** 🛑
**Goal:** Verify UI injection and communication bridge  
**Procedure:** 
1. Reload the extension
2. Activate the UI on a webpage
3. Click a button in the UI
4. Inspect Service Worker console

**Success Criteria:** 
- Full grading UI overlay appears
- Message from UI is logged in Service Worker console

---

### Phase 3: Core Feature - Screen Capture Implementation
**Goal:** Implement screen capture workflow using Chrome Extension APIs

#### Tasks:
1. **Update `manifest.json`** with required permissions
2. **Implement Desktop Capture API** integration
3. **Create Offscreen Document** for image processing
4. **Build canvas cropping logic** for region selection
5. **Handle image data transfer** between components

#### Required Permissions:
```json
{
  "permissions": [
    "activeTab",
    "scripting",
    "desktopCapture",
    "offscreen"
  ],
  "host_permissions": ["<all_urls>"]
}
```

#### Implementation Flow:
1. UI sends "startCapture" message to Service Worker
2. Service Worker calls `chrome.desktopCapture.chooseDesktopMedia()`
3. User selects screen/window/tab
4. Service Worker creates Offscreen Document with `streamId`
5. Offscreen Document processes MediaStream and crops image
6. Cropped image data sent back to Service Worker
7. Service Worker forwards image data to UI

#### Key Files:
- `src/offscreen/offscreen-document.ts` - Offscreen document logic
- `src/utils/image-processing.ts` - Canvas cropping utilities
- `src/types/capture.ts` - Type definitions for capture data

#### Resources:
- [Desktop Capture API](https://developer.chrome.com/docs/extensions/reference/api/desktopCapture)
- [Offscreen Documents API](https://developer.chrome.com/docs/extensions/reference/api/offscreen)

#### 🛑 **TEST CHECKPOINT #3** 🛑
**Goal:** Verify complete screen capture pipeline  
**Procedure:** 
1. Reload the extension
2. Click the `+` capture button
3. Select a screen/window
4. Draw selection box on the screen

**Success Criteria:** Base64 string of captured image region is logged to Service Worker console

---

### Phase 4: Full Loop Backend Integration
**Goal:** Connect captured images to backend API and complete user workflow

#### Tasks:
1. **Update `manifest.json`** with backend API permissions
2. **Implement API communication** in Service Worker
3. **Handle image-to-markdown conversion** via backend
4. **Implement grading workflow** with AI processing
5. **Display final results** with point allocation and reasoning
6. **Add session data persistence** using Storage API

#### Backend Integration:
```typescript
interface BackendAPI {
  '/api/image-to-markdown': {
    method: 'POST';
    body: { imageData: string };
    response: { markdown: string };
  };
  '/api/grade-answer': {
    method: 'POST';
    body: { 
      studentAnswer: string; 
      modelAnswer: string; 
      gradingScheme: string;
    };
    response: { 
      gradedAnswer: string; 
      points: number; 
      reasoning: string;
    };
  };
}
```

#### Complete User Workflow:
1. **Capture Phase:** User captures student and professor answers
2. **Processing Phase:** Images converted to markdown via backend
3. **Editing Phase:** User reviews and edits markdown content
4. **Grading Phase:** AI processes answers and generates graded result
5. **Results Phase:** Final graded answer displayed with points and reasoning

#### Key Features:
- **Session Management:** Store capture data between steps
- **Error Handling:** Graceful handling of API failures
- **Loading States:** User feedback during processing
- **Result Persistence:** Save grading results locally

#### Resources:
- [Network Requests (Fetch)](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)
- [Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)

#### 🛑 **FINAL MVP TEST CHECKPOINT** 🛑
**Goal:** Verify complete end-to-end functionality  
**Procedure:** 
1. Ensure backend server is running
2. Perform complete grading workflow:
   - Capture student answer
   - Capture professor answer
   - Review converted markdown
   - Edit if necessary
   - Generate final grading result

**Success Criteria:** 
- Final AI-annotated grading result is received from backend
- Result is correctly displayed in UI with points and reasoning
- All workflow steps complete successfully

---

## Technical Architecture

### File Structure
```
nous-grade-extension/
├── manifest.json
├── package.json
├── webpack.config.js
├── src/
│   ├── background/
│   │   └── service-worker.ts
│   ├── content/
│   │   └── content-script.ts
│   ├── offscreen/
│   │   └── offscreen-document.ts
│   ├── components/
│   │   ├── GradingOverlay.tsx
│   │   ├── StudentAnswerCapture.tsx
│   │   ├── ProfessorAnswerCapture.tsx
│   │   ├── MarkdownEditor.tsx
│   │   └── GradingResults.tsx
│   ├── utils/
│   │   ├── image-processing.ts
│   │   └── api-client.ts
│   ├── types/
│   │   ├── capture.ts
│   │   ├── grading.ts
│   │   └── messages.ts
│   └── styles/
│       └── overlay.css
├── build/
│   └── (compiled extension files)
└── README.md
```

### Key Technologies
- **TypeScript** - Type-safe development
- **React** - UI component library
- **Webpack/Vite** - Build tooling
- **Chrome Extension APIs** - Desktop capture, offscreen documents, messaging
- **Canvas API** - Image processing and cropping

---

## Debugging & Development Resources

### Essential Debugging Guide
- [Debug Extensions](https://developer.chrome.com/docs/extensions/get-started/tutorial/debug)

### Console Access Points
- **Service Worker:** `chrome://extensions` → Extension details → "Inspect views: service worker"
- **Content Scripts:** Browser DevTools → Console tab
- **Offscreen Documents:** `chrome://extensions` → Extension details → "Inspect views: offscreen document"

### Common Debugging Scenarios
1. **Extension not loading:** Check manifest.json syntax and permissions
2. **Content script not injecting:** Verify activeTab permission and URL matching
3. **Message passing failing:** Check message format and listener setup
4. **Screen capture not working:** Verify desktopCapture permission and user consent
5. **API calls failing:** Check host_permissions and CORS settings

---

## Final Deliverable

**Target:** Complete Chrome Extension package ready for installation

**Contents:**
- `build/` or `dist/` directory containing:
  - `manifest.json` - Extension configuration
  - Compiled JavaScript files
  - CSS stylesheets
  - Any required assets
- `README.md` - Installation and usage instructions
- Source code with proper TypeScript types and React components

**Success Criteria:**
- Extension passes all testing checkpoints
- Complete grading workflow functions end-to-end
- Clean, professional UI suitable for university professors
- Robust error handling and user feedback
- Proper TypeScript types and documentation

---

## Next Steps

1. **Begin Phase 1** - Set up basic extension scaffolding
2. **Follow testing checkpoints** - Verify each phase before proceeding
3. **Iterate based on feedback** - Refine UI and functionality
4. **Prepare for deployment** - Package extension for distribution

This plan provides a structured approach to building the nous-grade Chrome Extension, with clear milestones and testing criteria to ensure successful completion of the final deliverable.
