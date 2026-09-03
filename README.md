# AI Inbox

Chrome/Chromium extension that keeps one unread item per ChatGPT or DeepSeek conversation completed in the background.

## Develop

```sh
npm install
npm run check
npm run build
```

Load `dist/` through `chrome://extensions` → **Developer mode** → **Load unpacked**.

An item is cleared after its conversation remains in the active tab of the focused browser window for one second, or immediately with **Dismiss**. Unread items persist in `chrome.storage.local` even when their tab is closed.
