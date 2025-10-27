# Troubleshooting Guide - Nous-Grade Extension

## Common Issues and Solutions

### 1. "User cancelled screen selection or no stream available"

**What it means**: The user either cancelled the screen selection dialog or didn't grant permission for screen sharing.

**Solutions**:
- **Try again**: Click the capture button again and make sure to select a screen/window
- **Grant permission**: When the screen selection dialog appears, choose a screen and click "Share"
- **Check permissions**: Ensure the extension has the necessary permissions in Chrome settings

**Steps to capture successfully**:
1. Click "Capture Student Answer" or "Capture Professor Answer"
2. A dialog will appear asking you to choose what to share
3. Select either:
   - **Entire Screen** - Captures your full desktop
   - **Window** - Captures a specific application window
   - **Chrome Tab** - Captures a specific browser tab
4. Click **"Share"** (not Cancel)
5. Draw a selection box on the screen to choose the area to capture

### 2. "Cannot access a chrome:// URL"

**What it means**: You're trying to use the extension on a Chrome internal page.

**Solution**: Navigate to a regular website first:
- ✅ **Good**: `google.com`, `github.com`, `stackoverflow.com`, educational platforms
- ❌ **Bad**: `chrome://extensions`, `chrome://settings`, `about:blank`

### 3. "Injection failed" or UI doesn't appear

**Possible causes and solutions**:

**a) Restricted page**:
- Navigate to a regular website (not chrome:// pages)
- Refresh the page and try again

**b) Page not fully loaded**:
- Wait for the page to finish loading
- Refresh the page if needed

**c) Extension permissions**:
- Check that the extension is enabled in `chrome://extensions`
- Ensure "Allow on all sites" is enabled for the extension

### 4. Screen capture shows black screen or doesn't work

**Solutions**:
- **Try different capture source**: Select "Entire Screen" instead of "Window"
- **Check display settings**: Some displays or graphics drivers may cause issues
- **Browser restart**: Restart Chrome and try again
- **System permissions**: Ensure Chrome has screen recording permissions (macOS/Linux)

### 5. Selection overlay doesn't appear

**What to check**:
- Ensure you clicked "Share" in the screen selection dialog
- The overlay should appear after granting screen sharing permission
- Try selecting "Entire Screen" for better compatibility

### 6. Extension icon is grayed out or not working

**Solutions**:
- **Reload extension**: Go to `chrome://extensions`, find Nous-Grade, click reload
- **Check permissions**: Ensure all required permissions are granted
- **Developer mode**: Make sure "Developer mode" is enabled in `chrome://extensions`

## Debugging Steps

### For Developers:

1. **Check Service Worker Console**:
   - Go to `chrome://extensions`
   - Find "Nous-Grade Tool"
   - Click "Inspect views: service worker"
   - Look for error messages in the console

2. **Check Content Script Console**:
   - Open browser DevTools (F12) on the webpage
   - Look for messages starting with "Nous-Grade"

3. **Check Offscreen Document**:
   - Go to `chrome://extensions`
   - Look for "Inspect views: offscreen document" (appears during capture)

### Common Console Messages:

**Normal operation**:
```
Nous-Grade Service Worker loaded
Extension icon clicked on tab: [number]
Starting capture for student on tab [number]
Desktop media stream ID obtained: [string]
Offscreen document created
```

**Error indicators**:
```
Error starting capture: User cancelled screen selection
Could not send message to tab: [error]
Request info not found for: [requestId]
```

## Best Practices

### For Successful Screen Capture:

1. **Use on regular websites**: Avoid Chrome internal pages
2. **Grant permissions**: Always click "Share" when prompted
3. **Select appropriate source**: 
   - "Entire Screen" for full desktop capture
   - "Window" for specific application
   - "Chrome Tab" for browser content only
4. **Draw clear selection**: Make selection boxes at least 50x50 pixels
5. **Wait for completion**: Don't click multiple times rapidly

### For Better Performance:

1. **Close unnecessary tabs**: Reduces memory usage
2. **Use latest Chrome**: Ensure you have recent Chrome version
3. **Check system resources**: Ensure sufficient RAM/CPU available
4. **Restart if needed**: Restart Chrome if issues persist

## Getting Help

If you continue experiencing issues:

1. **Check the console**: Look for specific error messages
2. **Try different websites**: Test on multiple sites
3. **Restart Chrome**: Close and reopen the browser
4. **Reload extension**: Disable and re-enable the extension
5. **Check Chrome version**: Ensure you're using Chrome 88+ for Manifest V3 support

## Technical Requirements

- **Chrome Version**: 88 or higher
- **Permissions Required**: 
  - `activeTab`
  - `scripting`
  - `desktopCapture`
  - `offscreen`
  - `storage`
- **Supported Sites**: Any regular website (not chrome:// pages)
- **Screen Sharing**: Must grant permission when prompted
